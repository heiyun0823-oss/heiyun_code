import type { LLMProvider, GenerateRequest, GenerateChunk, ToolCall, ToolCallDelta, Message } from "@heiyun/ai";
import type { SessionNode, LoopOptions } from "./types.js";
import { Session } from "./session.js";
import { ToolRegistry } from "./tool-registry.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import type { Logger } from "./logger.js";
import type { ContextManager } from "./context-manager.js";

export interface LoopCallbacks {
  onText?: (text: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: { toolCallId: string; output: string; success: boolean }) => void;
  onCompact?: (summary: string) => void;
  onCompactStart?: () => void;
}

function mergeToolCallDelta(
  toolCalls: ToolCall[],
  delta: Partial<ToolCallDelta>
): void {
  if (!delta.function) return;

  const { index } = delta;
  if (index === undefined) return;

  while (toolCalls.length <= index) {
    toolCalls.push({
      id: "",
      type: "function",
      function: { name: "", arguments: "" },
    });
  }

  const target = toolCalls[index];
  if (delta.id) target.id = delta.id;
  if (delta.function.name) target.function.name = delta.function.name;
  if (delta.function.arguments) target.function.arguments += delta.function.arguments;
}

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
  session.append({ role: "user", content: userInput });
  logger?.info("Agent loop 开始", { sessionId: session.id, workdir });

  for (let round = 1; round <= options.maxRounds; round++) {
    if (options.signal?.aborted) {
      logger?.warn("用户中断");
      throw new Error("用户中断");
    }

    // ── ContextManager 集成 ──────────────────────────────────
    let ctxMessages: Message[];
    if (contextManager) {
      // 显示压缩中状态
      if (contextManager.shouldCompress(session)) {
        callbacks?.onCompactStart?.();
      }
      // 使用异步版本：自动检测并压缩
      ctxMessages = await contextManager.getMessagesAsync(
        session,
        callbacks?.onCompact
      );
    } else {
      // 无 ContextManager 时退化为原有行为
      const messages = session.getMessages();
      ctxMessages = messages.map((m): Message => ({
        role: m.role === "summary" ? "system" : (m.role as Message["role"]),
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      }));
    }

    const req: GenerateRequest = {
      model: options.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...ctxMessages,
      ],
      tools: toolRegistry.getDefinitions(),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
      signal: options.signal,
    };

    let assistantContent = "";
    const toolCalls: ToolCall[] = [];

    for await (const chunk of provider.generateStream(req)) {
      if (chunk.type === "text") {
        assistantContent += chunk.text!;
        callbacks?.onText?.(chunk.text!);
      } else if (chunk.type === "tool_call") {
        mergeToolCallDelta(toolCalls, chunk.toolCall!);
      }
      // finish chunk — ignore, handled by end of stream
    }

    if (toolCalls.length === 0) {
      session.append({
        role: "assistant",
        content: assistantContent || null,
      });
      logger?.info("Agent 回复完成（无工具调用）", { round, contentLen: assistantContent.length });
      return assistantContent;
    }

    session.append({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      callbacks?.onToolCall?.(tc);

      const result = await toolRegistry.execute(tc, {
        workdir,
        signal: options.signal,
      });

      callbacks?.onToolResult?.({
        toolCallId: tc.id,
        output: result.success ? result.output : result.error ?? result.output,
        success: result.success,
      });

      session.append({
        role: "tool",
        content: JSON.stringify(result),
        tool_call_id: tc.id,
      });
    }
  }

  const maxRoundsErr = `Agent loop 已超过最大轮次 (${options.maxRounds})，会话已保存。`;
  logger?.error(maxRoundsErr, { sessionId: session.id });
  throw new Error(maxRoundsErr);
}
