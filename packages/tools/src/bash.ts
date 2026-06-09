/**
 * @heiyun/tools — bash.ts
 * ========================
 * Shell 命令执行工具。让 AI 能够运行 bash 命令（git、npm、ls 等）。
 *
 * 这是四个工具中最复杂的一个，因为它需要：
 *   1. 创建子进程执行命令
 *   2. 异步收集 stdout 和 stderr（标准输出和标准错误）
 *   3. 处理超时（防止命令卡死）
 *   4. 支持用户中断（Ctrl+C）
 *   5. 拦截危险命令（如 rm -rf /）
 *   6. 兼容 Windows 和 Linux/macOS
 *
 * spawn（子进程创建）是什么？
 * Node.js 的 spawn() 函数创建一个新的操作系统进程来运行命令。
 * 父进程（我们的程序）和子进程（被执行的命令）各自独立运行，
 * 通过管道（pipe）通信：stdout 是正常输出，stderr 是错误输出。
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";
import { platform } from "node:os";

/**
 * 解码子进程输出。
 * Windows cmd.exe 使用系统活动代码页（中文系统为 GBK/CP936）输出，
 * Node.js 默认以 UTF-8 解码会导致乱码。这里在 Windows 上优先用 GBK 解码。
 */
function decodeOutput(chunk: Buffer, isWindows: boolean): string {
  if (!isWindows) return chunk.toString("utf8");
  try {
    return new TextDecoder("gbk").decode(chunk);
  } catch {
    // GBK 解码失败时回退到 UTF-8
    return chunk.toString("utf8");
  }
}

/**
 * bash 工具定义
 * command 是必填参数，workdir 可选
 */
export const bashDefinition = {
  name: "bash",
  description: "Execute a shell command and return stdout and stderr.",
  parameters: {
    type: "object",
    description: "Parameters for executing a shell command",
    properties: {
      command: { type: "string", description: "要执行的命令" },
      workdir: { type: "string", description: "执行目录，覆盖会话 workdir" },
    },
    required: ["command"],
  } as import("@heiyun/ai").ToolParameter,
};

/**
 * 危险命令特征库（正则表达式黑名单）
 * 如果命令匹配这些模式中的任意一个，将被直接拒绝执行。
 *
 * /pattern/i 中 i 标志表示不区分大小写。
 * 各模式含义：
 *   rm -rf /       — 递归强制删除根目录（灾难性操作）
 *   sudo            — 提权操作（绕过权限限制）
 *   mkfs            — 格式化文件系统
 *   dd if=          — 磁盘直接读写
 *   :(){ :|:& };:   — Fork 炸弹（耗尽系统资源）
 *   > /dev/sda     — 直接写入磁盘设备
 *   chmod 777 /    — 将根目录权限改为 777（所有人可读写执行）
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,      // rm -rf /
  /sudo\s/i,              // sudo ...
  /mkfs/i,                // mkfs（make filesystem）
  /dd\s+if=/i,            // dd if=...
  /:\s*\(\s*\)\s*\{/,    // Fork bomb: :(){ :|:& };:
  />\s*\/dev\/sda/,      // 重定向到磁盘设备
  /chmod\s+777\s+\//,    // chmod 777 /
];

/**
 * 检测命令是否危险
 * Array.some() 遍历数组，只要有一个元素满足条件就返回 true
 */
function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}

/**
 * 执行 Shell 命令
 *
 * 执行流程：
 *   1. 危险命令检测
 *   2. 确定工作目录
 *   3. 选择 shell（Windows 用 cmd.exe，其他用 /bin/bash）
 *   4. 创建子进程（spawn）
 *   5. 收集 stdout 和 stderr（通过事件监听）
 *   6. 等待进程结束或超时
 *   7. 返回结果
 *
 * 为什么用 Promise 包装？
 * spawn 是基于事件的（event-based），不是 async/await 风格。
 * 我们用 new Promise 把事件模型包装成 async 函数可以 await 的形式。
 * resolve 是"成功完成"的回调。
 */
export async function executeBash(
  params: { command: string; workdir?: string },
  ctx: { workdir: string; signal?: AbortSignal; timeoutMs?: number }
): Promise<ToolResult> {
  try {
    // 1. 危险命令检测
    if (isDangerous(params.command)) {
      return {
        success: false,
        output: "",
        error: `危险命令被拒绝: ${params.command}`,
      };
    }

    // 2. 确定工作目录
    // 优先使用命令指定的 workdir，否则使用会话的 workdir
    const workdir = params.workdir
      ? path.isAbsolute(params.workdir)
        ? params.workdir                              // 已经是绝对路径，直接使用
        : path.resolve(ctx.workdir, params.workdir)    // 相对路径，拼接到会话目录
      : ctx.workdir;                                   // 使用会话默认目录

    // 3. 超时和 shell 配置
    // 默认超时 120 秒（2 分钟）
    const timeoutMs = ctx.timeoutMs ?? 120_000;
    // platform() 返回当前操作系统类型："win32"=Windows, "linux"=Linux, "darwin"=macOS
    const isWindows = platform() === "win32";
    // Windows 用 cmd.exe，参数为 /c + 命令
    // Linux/macOS 用 /bin/bash，参数为 -c + 命令
    const shell = isWindows ? "cmd.exe" : "/bin/bash";
    const shellArgs = isWindows ? ["/c", params.command] : ["-c", params.command];

    // 记录开始时间（用于计算执行耗时）
    const startTime = Date.now();

    // 4. 用 Promise 包装 spawn 子进程
    return new Promise<ToolResult>((resolve) => {
      // 创建子进程
      // cwd：子进程的工作目录
      // env：环境变量（继承当前进程的所有环境变量）
      // stdio: ["pipe", "pipe", "pipe"] = stdin/stdout/stderr 都用管道
      // signal：传递中断信号给子进程
      // Windows 上用 encoding: 'buffer' 获取原始字节，
      // 然后用 GBK 解码（cmd.exe 输出编码为系统活动代码页）。
      // Linux/macOS 保持默认 utf8。
      const spawnOpts: Record<string, any> = {
        cwd: workdir,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
        signal: ctx.signal,
      };
      if (isWindows) {
        spawnOpts.encoding = "buffer";
      }

      const child = spawn(shell, shellArgs, spawnOpts);

      // 缓冲区：用于收集子进程的所有输出
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      // 超时定时器：超时后强制杀死子进程
      // setTimeout 在 timeoutMs 毫秒后执行回调
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");  // SIGKILL 是立即终止信号（不可被进程忽略）
      }, timeoutMs);

      // --- 监听数据事件 ---
      // 子进程的 stdout 是 ReadableStream，通过 .on("data", callback) 监听
      // 每当子进程输出一段数据，callback 就会被调用
      child.stdout?.on("data", (chunk: any) => {
        stdout += isWindows ? decodeOutput(chunk as Buffer, true) : String(chunk);
      });

      child.stderr?.on("data", (chunk: any) => {
        stderr += isWindows ? decodeOutput(chunk as Buffer, true) : String(chunk);
      });

      // --- 进程结束事件 ---
      // exitCode：进程的退出码，0 = 正常，非 0 = 异常
      child.on("close", (exitCode) => {
        clearTimeout(timer);  // 取消超时定时器
        const duration = Date.now() - startTime;

        // 超时导致进程被杀
        if (timedOut) {
          resolve({
            success: false,
            output: `${stdout}\n\nstderr:\n${stderr}`,
            error: `命令执行超时 (${timeoutMs}ms)`,
            metadata: { exit_code: -1, duration_ms: duration },
          });
          return;
        }

        // 正常完成：成功与否取决于退出码
        // exitCode === 0 表示命令成功执行
        resolve({
          success: exitCode === 0,
          output: `stdout:\n${stdout}\n\nstderr:\n${stderr}\n\nexit code: ${exitCode}`,
          metadata: {
            exit_code: exitCode ?? -1,
            duration_ms: duration,
          },
        });
      });

      // --- 进程创建失败事件 ---
      // 例如：shell 不存在、命令名错误
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: "",
          error: err.message,
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
