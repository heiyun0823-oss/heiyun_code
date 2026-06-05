/**
 * @heiyun/tools — read.ts
 * ========================
 * 文件读取工具。让 AI 能够读取工作目录中的文件内容。
 *
 * 功能：
 *   1. 读取文件全部内容（默认最多 5000 行）
 *   2. 支持 offset（起始行号）和 limit（读取行数）分段读取
 *   3. 自动添加行号前缀，方便 AI 引用具体行
 *
 * 安全措施：
 *   - 路径穿越检测：防止 AI 读取工作目录外的文件（如 ../../etc/passwd）
 *   - 敏感路径拦截：阻止读取 /etc、/proc 等系统路径
 *   - 目录检测：拒绝读取目录
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

/**
 * read 工具的定义（给 LLM 看的）
 * LLM 通过这个定义知道：有一个叫 "read" 的工具，
 * 需要 path 参数，可选 offset 和 limit 参数
 */
export const readDefinition = {
  name: "read",
  description:
    "Read a file from the filesystem. Returns content in ToolResult JSON format.",
  parameters: {
    type: "object",
    description: "Parameters for reading a file",
    properties: {
      path: { type: "string", description: "文件路径，相对于当前工作目录" },
      offset: { type: "number", description: "起始行号，从 1 开始" },
      limit: { type: "number", description: "读取行数" },
    },
    required: ["path"],  // path 是必填参数
  } as import("@heiyun/ai").ToolParameter,
};

/**
 * 工具执行上下文（本地类型）
 * 各工具文件中都有自己的 ToolContext 定义，实际使用时会统一为 index.ts 中的版本
 */
export interface ToolContext {
  workdir: string;
  signal?: AbortSignal;
}

/**
 * 路径安全检查函数
 * 这是整个工具系统最重要的安全防线之一。
 * 它确保 AI 只能访问工作目录内部的文件，不能越权读取系统文件。
 *
 * 安全检查分两层：
 *   第一层 — 路径穿越检测：
 *     如果 AI 传入 "../../etc/passwd"，展开后路径不在工作目录下，拒绝。
 *     原理：展开后的绝对路径必须以工作目录开头。
 *
 *   第二层 — 敏感路径拦截：
 *     即使在工作目录内，也不允许访问 /etc、/proc、/sys、/dev、/system、/windows
 *     这些系统目录（硬编码黑名单）。
 *
 * @param inputPath — AI 传入的路径（可能是绝对路径或相对路径）
 * @param workdir — 当前工作目录的绝对路径
 * @returns 安全检查通过后的规范绝对路径
 * @throws 路径不合规时抛出错误
 */
function resolveSafePath(inputPath: string, workdir: string): string {
  // 解析为绝对路径：
  //   - 如果已经是绝对路径（如 "/home/user/file.ts"），直接 resolve
  //   - 如果是相对路径（如 "src/index.ts"），以 workdir 为基准拼接
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workdir, inputPath);

  // === 第一层：路径穿越检测 ===
  // 确保展开后的绝对路径严格以工作目录开头
  // path.sep 是路径分隔符（Linux 是 "/"，Windows 是 "\"）
  // 加上 path.sep 是为了防止这种情况：
  //   工作目录 /home/user，AI 传入 "/home/user_evil/file"
  //   如果不加分隔符检查，startsWith 会返回 true（前缀匹配）
  const normalizedWorkdir = path.resolve(workdir);
  if (!resolved.startsWith(normalizedWorkdir + path.sep) && resolved !== normalizedWorkdir) {
    throw new Error(`路径穿越被拒绝: ${inputPath}`);
  }

  // === 第二层：敏感路径拦截 ===
  // 将路径转为小写进行比较（Linux 大小写敏感，但这里做保守处理）
  const normalized = path.normalize(resolved).toLowerCase();
  // 系统敏感路径黑名单
  const blockedPrefixes = ["/etc", "/proc", "/sys", "/dev", "/system", "/windows"];
  for (const bp of blockedPrefixes) {
    // 检查路径是否以黑名单路径开头
    // 或者路径中间包含黑名单路径（如 "/some/dir/etc/hosts"）
    if (normalized.startsWith(bp) || normalized.includes(path.sep + bp.slice(1) + path.sep)) {
      throw new Error(`敏感路径被拒绝: ${resolved}`);
    }
  }

  return resolved;
}

/**
 * 执行文件读取
 *
 * 读取流程：
 *   1. 安全检查：调用 resolveSafePath 验证和规范化路径
 *   2. 目录检测：statSync 获取文件信息，isDirectory() 判断是否目录
 *   3. 读取文件：readFileSync 同步读取整个文件内容
 *   4. 按行分割：split("\n") 将内容分割为行数组
 *   5. 应用 offset 和 limit：截取需要的行范围
 *   6. 添加行号：每行前面加上行号（6位右对齐），方便 AI 精确定位
 *
 * 错误处理：所有错误都被 catch 捕获，不抛出异常，
 * 而是返回 { success: false, error: "原因" }。
 * 这样 agent 循环不会崩溃，AI 可以读取错误信息后自行纠正。
 */
export async function executeRead(
  params: { path: string; offset?: number; limit?: number },
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    // 1. 路径安全检查
    const filePath = resolveSafePath(params.path, ctx.workdir);

    // 2. 获取文件信息（statSync 是同步方法，会阻塞直到返回）
    const stat = fs.statSync(filePath);

    // 如果是目录，拒绝读取（read 工具只读文件）
    if (stat.isDirectory()) {
      return { success: false, output: "", error: `路径是目录: ${params.path}` };
    }

    // 3. 读取文件全部内容（utf-8 编码）
    const content = fs.readFileSync(filePath, "utf-8");
    // 4. 按换行符分割成行数组
    const lines = content.split("\n");

    // 5. 确定读取范围
    // offset 至少为 1（行号从 1 开始）
    // limit 最多 5000 行（防止内容过长超出 token 限制）
    const offset = params.offset ? Math.max(1, params.offset) : 1;
    const limit = params.limit ? Math.min(params.limit, 5000) : 5000;

    // 计算数组索引（数组从 0 开始，行号从 1 开始）
    const startIdx = offset - 1;
    // Array.slice(start, end) 从 start 到 end（不含 end）
    const sliced = lines.slice(startIdx, startIdx + limit);

    // 6. 添加行号前缀
    // padStart(6, " ") 将数字补齐到 6 位宽度（右对齐），如 "     1"、"   100"
    const resultText = sliced
      .map((line, i) => `${String(startIdx + i + 1).padStart(6, " ")}| ${line}`)
      .join("\n");

    return {
      success: true,
      output: resultText,
      metadata: {
        // Buffer.byteLength 准确计算 UTF-8 编码的字节数
        // 注意：中文字符在 UTF-8 中占 3 字节
        bytes_read: Buffer.byteLength(content, "utf-8"),
      },
    };
  } catch (err) {
    // 错误处理：将所有异常转为 ToolResult 返回
    if (err instanceof Error) {
      // ENOENT = Error NO ENTry（文件/目录不存在）
      // NodeJS.ErrnoException 是 Node.js 系统错误的特殊类型，带有 code 属性
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, output: "", error: `文件不存在: ${params.path}` };
      }
      return { success: false, output: "", error: err.message };
    }
    // 极端情况：抛出的不是 Error 对象（如 throw "string"）
    return { success: false, output: "", error: String(err) };
  }
}
