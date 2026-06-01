import type { ToolCall, ToolDefinition, ToolResult } from "@heiyun/ai";
import type { ToolContext } from "@heiyun/tools";
import { allTools } from "@heiyun/tools";

export interface ToolHandler {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  constructor() {
    this.registerBuiltins();
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
      return {
        success: false,
        output: "",
        error: `未知工具: ${toolCall.function.name}`,
      };
    }

    let params: Record<string, unknown>;
    try {
      params = JSON.parse(toolCall.function.arguments);
    } catch {
      return {
        success: false,
        output: "",
        error: `工具参数 JSON 解析失败: ${toolCall.function.arguments}`,
      };
    }

    return handler.execute(params, ctx);
  }
}
