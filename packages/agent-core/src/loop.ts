/**
 * @heiyun/agent-core — loop.ts
 * =============================
 * agentLoop() — 整个项目的核心编排逻辑。
 *
 * 这是"AI Agent 循环"（Agent Loop）的实现。
 * Agent 循环是一个反复执行的过程：
 *   用户说一句话 → AI 思考 → AI 回复文本或调用工具 → 工具执行 → 工具结果返回 AI
 *   → AI 再思考 → ... → 直到 AI 只回复文本（不调工具）或达到最大轮次
 *
 * 类比：人与人合作编程的过程。
 *   你："帮我写个函数"
 *   我：（读代码、写代码、运行测试）→ "写好了"
 *   你："再加个功能"
 *   我：（编辑代码、运行测试）→ "好了"
 *
 * 这里的 AI 就是"我"，agentLoop 就是这个反复读-写-测试的循环过程。
 *
 * 流程图：
 *   ┌──────────────────────────────────────────┐
 *   │  用户输入 → session.append(user)         │
 *   │  ↓                                       │
 *   │  for 1..maxRounds:                       │
 *   │    ↓                                     │
 *   │    检查中断信号 → 抛异常                  │
 *   │    ↓                                     │
 *   │    [ContextManager] 压缩上下文？          │
 *   │    ↓                                     │
 *   │    构建 GenerateRequest                   │
 *   │    ↓                                     │
 *   │    provider.generateStream() 流式接收      │
 *   │    ↓                                     │
 *   │    有工具调用？                           │
 *   │    ├── 否 → 返回 AI 回复文本（结束）      │
 *   │    └── 是 → 逐个执行工具                  │
 *   │         → 结果写回 session                │
 *   │         → 回到 for 循环开头              │
 *   └──────────────────────────────────────────┘
 */

import type { LLMProvider, GenerateRequest, GenerateChunk, ToolCall, ToolCallDelta, Message } from "@heiyun/ai";
import type { SessionNode, LoopOptions } from "./types.js";
import { Session } from "./session.js";
import { ToolRegistry } from "./tool-registry.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import type { Logger } from "./logger.js";
import type { ContextManager } from "./context-manager.js";

/**
 * 循环回调接口
 * TUI（终端界面）通过这个接口接收循环中的实时事件，更新界面。
 * 所有回调都是可选的（？表示可以不提供）。
 */
export interface LoopCallbacks {
  /** AI 输出了一段文本 */
  onText?: (text: string) => void;
  /** AI 决定调用一个工具 */
  onToolCall?: (toolCall: ToolCall) => void;
  /** 工具执行完成，返回结果 */
  onToolResult?: (result: { toolCallId: string; output: string; success: boolean }) => void;
  /** 上下文压缩完成 */
  onCompact?: (summary: string) => void;
  /** 开始压缩上下文 */
  onCompactStart?: () => void;
}

/**
 * 合并工具调用的流式增量片段
 *
 * 背景：LLM 流式返回工具调用时，是分多次传输的（见 types.ts 中 ToolCallDelta 的注释）。
 * 这个函数把每个新的 delta 片段拼接到对应 index 的 ToolCall 对象上。
 *
 * 算法：基于 index 的增量累积
 *   1. 如果 toolCalls 数组长度不够（新的工具调用 index 超出），用空对象填充
 *   2. 根据 delta 内容更新对应位置的 ToolCall：
 *      - id：只在第一次出现时设置（后续 delta 不带 id）
 *      - name：只在第一次出现时设置
 *      - arguments：每次都用 += 拼接（这是关键！片段是逐步到达的）
 *
 * @param toolCalls — 正在构建中的工具调用数组（原地修改）
 * @param delta — 新到达的增量片段
 */
function mergeToolCallDelta(
  toolCalls: ToolCall[],
  delta: Partial<ToolCallDelta>
): void {
  // 没有 function 字段，无法合并
  if (!delta.function) return;

  const { index } = delta;
  if (index === undefined) return;

  // 确保数组长度足够：用空的 ToolCall 填充到 index 位置
  while (toolCalls.length <= index) {
    toolCalls.push({
      id: "",
      type: "function",
      function: { name: "", arguments: "" },
    });
  }

  // 合并 delta 到对应位置的 toolCall
  const target = toolCalls[index];
  if (delta.id) target.id = delta.id;
  if (delta.function.name) target.function.name = delta.function.name;
  // 关键：arguments 用 += 累积拼接
  // 因为流式传输中，arguments 是分片到达的：
  //   第1帧: arguments = '{"path'"}'
  //   第2帧: arguments = '": "/src'"}'
  //   ...拼起来后才是完整的 '{"path": "/src/a.ts"}'
  if (delta.function.arguments) target.function.arguments += delta.function.arguments;
}

/**
 * 主循环：Agent 的"大脑"
 *
 * @param provider — LLM API 的 Provider 实例（用于调用 AI）
 * @param session — 当前会话（管理消息存储）
 * @param toolRegistry — 工具注册表（管理可用工具）
 * @param userInput — 用户输入的消息文本
 * @param options — 循环配置（模型、最大轮次、温度等）
 * @param workdir — 工作目录
 * @param callbacks — 实时事件回调（供 TUI 更新界面）
 * @param logger — 日志记录器
 * @param contextManager — 上下文管理器（防止超出窗口）
 * @returns AI 的最终回复文本
 */
export async function agentLoop(
  provider: LLMProvider,
  session: Session,
  toolRegistry: ToolRegistry,
  userInput: string,
  options: LoopOptions,
  workdir: string,
  callbacks?: LoopCallbacks,
  logger?: Logger,
  contextManager?: ContextManager
): Promise<string> {
  // 将用户输入追加到会话中
  session.append({ role: "user", content: userInput });
  logger?.info("Agent loop 开始", { sessionId: session.id, workdir });

  // === 主循环：最多执行 maxRounds 轮 ===
  // 限次是为了防止 AI 陷入无限循环（调工具→返回→再调→再返回...）
  for (let round = 1; round <= options.maxRounds; round++) {
    // 检查用户是否中断（Ctrl+C）
    if (options.signal?.aborted) {
      logger?.warn("用户中断");
      throw new Error("用户中断");
    }

    // === ContextManager 集成 ===
    // 上下文管理器决定了"把哪些消息发给 AI"
    let ctxMessages: Message[];
    if (contextManager) {
      // 如果使用 ContextManager：显示"压缩中"状态
      if (contextManager.shouldCompress(session)) {
        callbacks?.onCompactStart?.();
      }
      // getMessagesAsync：自动检测并压缩，返回适合发给 API 的消息列表
      ctxMessages = await contextManager.getMessagesAsync(
        session,
        callbacks?.onCompact
      );
    } else {
      // 不使用 ContextManager：直接取全部消息，手动转换格式
      const messages = session.getMessages();
      ctxMessages = messages.map((m): Message => ({
        role: m.role === "summary" ? "system" : (m.role as Message["role"]),
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      }));
    }

    // === 构建 LLM 请求 ===
    // 第 0 条是系统提示词（告诉 AI 它的身份和规则）
    // 后面是所有对话历史（含用户输入、AI 回复、工具结果等）
    const req: GenerateRequest = {
      model: options.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...ctxMessages,
      ],
      tools: toolRegistry.getDefinitions(),  // 告诉 AI 有哪些工具可用
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
      signal: options.signal,
    };

    // === 流式接收 AI 回复 ===
    let assistantContent = "";      // 累积的文本回复
    const toolCalls: ToolCall[] = []; // 累积的工具调用

    // for await...of 逐个消费异步生成器产出的 Chunk
    for await (const chunk of provider.generateStream(req)) {
      if (chunk.type === "text") {
        // 文本块：AI 正在说话，
        // 拼接到 assistantContent 并实时通知 TUI
        assistantContent += chunk.text!;
        callbacks?.onText?.(chunk.text!);
      } else if (chunk.type === "tool_call") {
        // 工具调用块：合并增量片段
        mergeToolCallDelta(toolCalls, chunk.toolCall!);
      }
      // type === "finish" 的块被忽略，通过流自然结束来处理
    }

    // === 判断 AI 回复类型 ===
    if (toolCalls.length === 0) {
      // 纯文本回复：AI 没有调用工具，对话结束
      session.append({
        role: "assistant",
        content: assistantContent || null,
      });
      logger?.info("Agent 回复完成（无工具调用）", { round, contentLen: assistantContent.length });
      return assistantContent;
    }

    // AI 调用了工具：先保存 assistant 消息（含工具调用）
    session.append({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: toolCalls,
    });

    // === 逐个执行工具 ===
    for (const tc of toolCalls) {
      // 通知 TUI：开始执行工具
      callbacks?.onToolCall?.(tc);

      // 执行工具（可能同步也可能异步）
      const result = await toolRegistry.execute(tc, {
        workdir,
        signal: options.signal,
      });

      // 通知 TUI：工具执行完毕
      callbacks?.onToolResult?.({
        toolCallId: tc.id,
        output: result.success ? result.output : result.error ?? result.output,
        success: result.success,
      });

      // 将工具结果追加到会话中
      session.append({
        role: "tool",
        content: JSON.stringify(result),  // 将 ToolResult 序列化为 JSON 字符串
        tool_call_id: tc.id,              // 关联到对应的工具调用
      });
    }
    // 工具执行完毕 → 回到 for 循环开头，AI 会看到工具结果，继续思考
  }

  // 达到最大轮次限制
  const maxRoundsErr = `Agent loop 已超过最大轮次 (${options.maxRounds})，会话已保存。`;
  logger?.error(maxRoundsErr, { sessionId: session.id });
  throw new Error(maxRoundsErr);
}
