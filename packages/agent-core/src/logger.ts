/**
 * @heiyun/agent-core — logger.ts
 * ===============================
 * Logger（日志记录器）— JSONL 格式的调试日志。
 *
 * 用途：
 *   记录 AI 工具调用过程的详细信息，方便开发者排查问题。
 *   比如：AI 调用了什么工具、传了什么参数、执行结果如何、耗时多少。
 *
 * 日志文件位置：~/.heiyun/logs/heiyun-YYYYMMDD-HHmmss.log
 *
 * 命名示例：heiyun-20260606-143052.log
 *   （2026 年 6 月 6 日 14:30:52 创建的日志文件）
 *
 * 设计原则：
 *   - 日志写入失败不影响主流程（catch 块静默忽略错误）
 *   - 使用 appendFileSync（同步追加）而非 writeFileSync（覆盖）
 *   - 不采集敏感数据（API Key 等不会写入日志）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * 单条日志记录的结构
 */
export interface LogEntry {
  timestamp: string;                   // ISO 8601 时间戳
  level: "INFO" | "WARN" | "ERROR";   // 日志级别：信息/警告/错误
  event: string;                       // 事件类型：tool_call / tool_result / system
  tool?: string;                       // 工具名称（如果是工具相关事件）
  params?: Record<string, unknown>;    // 工具参数
  success?: boolean;                   // 工具执行是否成功
  output?: string;                     // 工具执行输出
  error?: string;                      // 错误描述
  workdir?: string;                    // 工作目录
  sessionId?: string;                  // 会话 ID
  durationMs?: number;                 // 执行耗时（毫秒）
  message?: string;                    // 人类可读的描述信息
}

/**
 * JSONL 格式日志记录器
 */
export class Logger {
  private logDir: string;        // 日志存储目录
  private logFilePath: string;   // 当前日志文件的完整路径
  private sessionId: string | undefined;  // 当前会话 ID（用于关联日志）

  /**
   * 构造日志记录器
   * @param logDir — 日志目录，默认 ~/.heiyun/logs
   */
  constructor(logDir?: string) {
    this.logDir = logDir ?? path.join(os.homedir(), ".heiyun", "logs");
    fs.mkdirSync(this.logDir, { recursive: true });

    // 生成日志文件名：heiyun-YYYYMMDD-HHmmss.log
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");  // "20260606"
    const time = now.toISOString().slice(11, 19).replace(/:/g, ""); // "143052"
    this.logFilePath = path.join(this.logDir, `heiyun-${date}-${time}.log`);
  }

  /** 设置当前会话 ID */
  setSessionId(id: string): void {
    this.sessionId = id;
  }

  /** 获取日志文件路径 */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * 记录工具调用开始
   * 例如：AI 决定读取文件 user.ts，这里会记下：
   *   "→ 调用工具 [read]"，参数为 { path: "src/user.ts" }
   */
  logToolCall(
    toolName: string,
    params: Record<string, unknown>,
    workdir: string
  ): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "INFO",
      event: "tool_call",
      tool: toolName,
      params,
      workdir,
      sessionId: this.sessionId,
      message: `→ 调用工具 [${toolName}]`,
    });
  }

  /**
   * 记录工具调用结果（成功或失败）
   * 输出内容超过 1000 字符会被截断，避免日志文件过大
   */
  logToolResult(
    toolName: string,
    result: { success: boolean; output: string; error?: string },
    durationMs: number
  ): void {
    // 输出截断：最多保留 1000 字符
    const maxOutputLen = 1000;
    const truncatedOutput =
      result.output.length > maxOutputLen
        ? result.output.slice(0, maxOutputLen) +
          `\u2026 [截断, 总长 ${result.output.length}]`
        : result.output;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: result.success ? "INFO" : "ERROR",  // 失败时用 ERROR 级别
      event: "tool_result",
      tool: toolName,
      success: result.success,
      output: truncatedOutput,
      durationMs,
      sessionId: this.sessionId,
    };

    // 补充错误信息和人类可读的摘要
    if (result.error) {
      entry.error = result.error;
      entry.message = `✗ 工具 [${toolName}] 执行失败: ${result.error}`;
    } else {
      entry.message = `✓ 工具 [${toolName}] 执行成功 (${durationMs}ms)`;
    }

    this.write(entry);
  }

  /** 记录一般信息 */
  info(message: string, data?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "INFO",
      event: "system",
      message,
      sessionId: this.sessionId,
      ...data,  // 展开 data 到对象中（如 sessionId, workdir 等）
    });
  }

  /** 记录错误 */
  error(message: string, data?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      event: "system",
      message,
      sessionId: this.sessionId,
      ...data,
    });
  }

  /** 记录警告 */
  warn(message: string, data?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "WARN",
      event: "system",
      message,
      sessionId: this.sessionId,
      ...data,
    });
  }

  /**
   * 核心写入方法（private，外部不能直接调用）
   * 以 JSONL 格式追加写入日志文件。
   * 写入失败时静默忽略——日志是辅助功能，不应该影响主流程。
   */
  private write(entry: LogEntry): void {
    try {
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(this.logFilePath, line, "utf-8");
    } catch {
      // 日志写入失败不应影响主流程（如磁盘满了）
    }
  }
}
