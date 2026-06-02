import type { ToolCall, ToolDefinition, ToolResult } from "@heiyun/ai";
import type { ToolContext } from "@heiyun/tools";
import { allTools } from "@heiyun/tools";
import type { Logger } from "./logger.js";

export interface ToolHandler {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();
  private logger: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
    this.registerBuiltins();
  }

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  private registerBuiltins(): void {
    for (const tool of allTools) {
      this.register(tool);
    }
  }

  register(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(toolCall: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const handler = this.tools.get(toolCall.function.name);
    if (!handler) {
      const errResult: ToolResult = {
        success: false,
        output: "",
        error: `未知工具: ${toolCall.function.name}`,
      };
      this.logger?.logToolResult(toolCall.function.name, errResult, 0);
      return errResult;
    }

    let params: Record<string, unknown>;
    try {
      params = JSON.parse(toolCall.function.arguments);
    } catch {
      const errResult: ToolResult = {
        success: false,
        output: "",
        error: `工具参数 JSON 解析失败: ${toolCall.function.arguments}`,
      };
      this.logger?.logToolResult(toolCall.function.name, errResult, 0);
      return errResult;
    }

    // 记录工具调用
    this.logger?.logToolCall(
      handler.definition.name,
      params,
      ctx.workdir
    );

    const startTime = Date.now();
    const result = await handler.execute(params, ctx);
    const durationMs = Date.now() - startTime;

    // 记录工具结果
    this.logger?.logToolResult(handler.definition.name, result, durationMs);

    return result;
  }
}
