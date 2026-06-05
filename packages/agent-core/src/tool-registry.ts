/**
 * @heiyun/agent-core — tool-registry.ts
 * ======================================
 * ToolRegistry（工具注册表）— 工具的中转调度中心。
 *
 * 职责：
 *   1. 管理所有可用工具（内置 + 扩展）
 *   2. 根据 LLM 的 ToolCall 查找到对应的执行函数
 *   3. 解析 JSON 参数，调用工具，返回结果
 *   4. 记录所有工具调用的日志
 *
 * 数据流：
 *   LLM 返回 ToolCall → ToolRegistry.execute(toolCall, ctx)
 *   → 从 Map 中查找 handler → JSON.parse 解析参数
 *   → handler.execute(params, ctx) → 返回 ToolResult
 *
 * Map（映射表）是什么？
 *   new Map<K, V>() 是 ES6 的键值对集合。
 *   类似于普通对象 {}，但键可以是任意类型，且查找速度更快。
 *   这里用工具名称（string）作为键，ToolHandler 对象作为值。
 */

import type { ToolCall, ToolDefinition, ToolResult } from "@heiyun/ai";
import type { ToolContext } from "@heiyun/tools";
import { allTools } from "@heiyun/tools";
import type { Logger } from "./logger.js";

/**
 * 工具处理器
 * 每个工具包含定义（给 LLM 看）和执行函数（实际干活）
 */
export interface ToolHandler {
  definition: ToolDefinition;    // 工具定义（名称、描述、参数规范）
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * 工具注册表
 * 管理和调度所有工具的执行
 */
export class ToolRegistry {
  /** 工具名称 → 处理器的映射表 */
  private tools = new Map<string, ToolHandler>();
  /** 日志记录器（可选） */
  private logger: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
    this.registerBuiltins();  // 自动注册内置工具
  }

  /** 替换日志记录器 */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * 注册内置工具
   * 从 @heiyun/tools 包的 allTools 数组中加载所有工具
   * private：只允许在类内部调用，外部无法触发重新注册
   */
  private registerBuiltins(): void {
    for (const tool of allTools) {
      this.register(tool);
    }
  }

  /**
   * 注册一个工具处理器
   * 如果同名工具已存在，会覆盖（后注册的优先）
   */
  register(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  /**
   * 获取所有已注册工具的定义列表
   * 这个列表会在每次 LLM 请求时发送给 API，告诉 AI 有哪些工具可用
   */
  getDefinitions(): ToolDefinition[] {
    // Array.from() 将 Map 的值迭代器转换为数组
    // .map() 提取每个 handler 的 definition
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * 执行一次工具调用
   * 这是工具调度的核心方法。
   *
   * 步骤：
   *   1. 根据工具名查找 handler
   *   2. 解析 JSON 参数字符串
   *   3. 记录调用日志
   *   4. 执行工具
   *   5. 记录结果日志
   *   6. 返回 ToolResult
   *
   * @param toolCall — LLM 返回的工具调用信息
   * @param ctx — 工具执行上下文（工作目录、超时等）
   * @returns 工具执行结果
   */
  async execute(toolCall: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    // 1. 查找工具处理器
    const handler = this.tools.get(toolCall.function.name);
    if (!handler) {
      // 未知工具：LLM 请求了一个我们没有的工具
      // 可能原因：LLM "幻觉"了不存在的工具名，或者工具被移除
      const errResult: ToolResult = {
        success: false,
        output: "",
        error: `未知工具: ${toolCall.function.name}`,
      };
      this.logger?.logToolResult(toolCall.function.name, errResult, 0);
      return errResult;
    }

    // 2. 解析 JSON 参数
    // LLM 给的 arguments 是 JSON 字符串，需要 parse 后才能使用
    let params: Record<string, unknown>;
    try {
      // Record<string, unknown> 表示"键是 string、值是任意类型的对象"
      params = JSON.parse(toolCall.function.arguments);
    } catch {
      // JSON 解析失败：可能是 LLM 生成的 JSON 格式不正确
      const errResult: ToolResult = {
        success: false,
        output: "",
        error: `工具参数 JSON 解析失败: ${toolCall.function.arguments}`,
      };
      this.logger?.logToolResult(toolCall.function.name, errResult, 0);
      return errResult;
    }

    // 3. 记录工具调用开始
    this.logger?.logToolCall(
      handler.definition.name,
      params,
      ctx.workdir
    );

    // 4. 执行工具并计时
    const startTime = Date.now();
    const result = await handler.execute(params, ctx);
    const durationMs = Date.now() - startTime;

    // 5. 记录工具执行结果
    this.logger?.logToolResult(handler.definition.name, result, durationMs);

    // 6. 返回结果
    return result;
  }
}
