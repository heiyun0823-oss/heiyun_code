import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  event: string;
  tool?: string;
  params?: Record<string, unknown>;
  success?: boolean;
  output?: string;
  error?: string;
  workdir?: string;
  sessionId?: string;
  durationMs?: number;
  message?: string;
}

/**
 * JSONL 格式日志记录器，日志文件存储在 ~/.heiyun/logs/ 目录下。
 * 主要用于记录 AI 工具调用过程，方便排查错误。
 */
export class Logger {
  private logDir: string;
  private logFilePath: string;
  private sessionId: string | undefined;

  constructor(logDir?: string) {
    this.logDir = logDir ?? path.join(os.homedir(), ".heiyun", "logs");
    fs.mkdirSync(this.logDir, { recursive: true });

    // 日志文件名：heiyun-YYYYMMDD-HHmmss.log
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toISOString().slice(11, 19).replace(/:/g, "");
    this.logFilePath = path.join(this.logDir, `heiyun-${date}-${time}.log`);
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * 记录工具调用开始
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
   */
  logToolResult(
    toolName: string,
    result: { success: boolean; output: string; error?: string },
    durationMs: number
  ): void {
    const maxOutputLen = 1000;
    const truncatedOutput =
      result.output.length > maxOutputLen
        ? result.output.slice(0, maxOutputLen) +
          `… [截断, 总长 ${result.output.length}]`
        : result.output;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: result.success ? "INFO" : "ERROR",
      event: "tool_result",
      tool: toolName,
      success: result.success,
      output: truncatedOutput,
      durationMs,
      sessionId: this.sessionId,
    };

    if (result.error) {
      entry.error = result.error;
      entry.message = `✗ 工具 [${toolName}] 执行失败: ${result.error}`;
    } else {
      entry.message = `✓ 工具 [${toolName}] 执行成功 (${durationMs}ms)`;
    }

    this.write(entry);
  }

  /**
   * 记录一般信息
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: "INFO",
      event: "system",
      message,
      sessionId: this.sessionId,
      ...data,
    });
  }

  /**
   * 记录错误
   */
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

  /**
   * 记录警告
   */
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

  private write(entry: LogEntry): void {
    try {
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(this.logFilePath, line, "utf-8");
    } catch {
      // 日志写入失败不应影响主流程
    }
  }
}
