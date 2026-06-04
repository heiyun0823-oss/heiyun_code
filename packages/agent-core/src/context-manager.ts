// === 上下文管理 ===
// 通过滑动窗口 + LLM 摘要压缩防止超出模型上下文窗口

import type { LLMProvider, GenerateRequest, Message } from "@heiyun/ai";
import type { SessionNode } from "./types.js";
import { Session } from "./session.js";
import type { TokenCounter } from "./token-counter.js";

// ── types ────────────────────────────────────────────────────────────

export interface ContextManagerConfig {
  maxContextTokens: number;
  windowRatio: number;
  compressThresholdRatio: number;
  reserveOutputTokens: number;
  systemPromptTokens: number;
}

export interface CompactPreview {
  totalMessages: number;
  compressStart: number;
  compressEnd: number;
  retainCount: number;
  tokenBefore: number;
  tokenAfter: number;
}

export type OnCompactCallback = (summary: string) => void;

// ── summary prompt ───────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT =
  "你是一个对话摘要助手。请将对话历史压缩为结构化摘要。保持简洁，目标控制在 500-1000 token 以内。";

function buildSummaryPrompt(messages: SessionNode[]): string {
  const lines = messages.map((m) => {
    const roleLabel =
      m.role === "user"
        ? "用户"
        : m.role === "assistant"
          ? "AI"
          : m.role === "tool"
            ? "工具结果"
            : m.role === "summary"
              ? "历史摘要"
              : m.role;
    const content = m.content ?? (m.tool_calls ? `[调用工具: ${m.tool_calls.map((tc) => tc.function.name).join(", ")}]` : "(无内容)");
    return `[${roleLabel}] ${content}`;
  });

  return `请将以下对话历史压缩为结构化摘要。保留以下信息：

1. 完成的主要工作和结果
2. 做出的关键决策及其原因
3. 当前进行中的任务和状态
4. 重要的代码文件路径、函数名、变量名
5. 遇到的问题和解决方案

请用中文输出，使用 Markdown 格式。保持简洁，目标控制在 500-1000 token 以内。

对话历史：
${lines.join("\n")}`;
}

// ── ContextManager ────────────────────────────────────────────────────

export class ContextManager {
  private config: ContextManagerConfig;
  private tokenCounter: TokenCounter;
  private provider: LLMProvider;

  constructor(
    config: ContextManagerConfig,
    tokenCounter: TokenCounter,
    provider: LLMProvider
  ) {
    this.config = config;
    this.tokenCounter = tokenCounter;
    this.provider = provider;
  }

  // ── token budget ──────────────────────────────────────────────────

  private get usableTokens(): number {
    return (
      this.config.maxContextTokens -
      this.config.reserveOutputTokens -
      this.config.systemPromptTokens
    );
  }

  private get windowTokens(): number {
    return Math.floor(this.usableTokens * this.config.windowRatio);
  }

  private get compressTriggerTokens(): number {
    return Math.floor(this.usableTokens * this.config.compressThresholdRatio);
  }

  // ── public API ─────────────────────────────────────────────────────

  /**
   * 获取当前消息的 token 数（不含 system prompt）
   */
  getTokenCount(session: Session): number {
    return this.tokenCounter.countMessages(session.getMessages());
  }

  /**
   * 判断是否需要压缩
   */
  shouldCompress(session: Session): boolean {
    return this.getTokenCount(session) >= this.compressTriggerTokens;
  }

  /**
   * 返回压缩预览信息，若无需压缩则返回 null
   */
  getCompactPreview(session: Session): CompactPreview | null {
    const messages = session.getMessages();
    const totalTokens = this.tokenCounter.countMessages(messages);
    const boundary = this.computeWindowBoundary(messages);

    if (boundary === null || boundary === 0) return null;

    const oldMessages = messages.slice(0, boundary);
    const oldTokens = this.tokenCounter.countMessages(oldMessages);
    // 预估 summary token（保守估计为旧消息 token 的 5%，但最少 200，最多 2000）
    const estimatedSummaryTokens = Math.min(2000, Math.max(200, Math.floor(oldTokens * 0.05)));
    const newTotalTokens = totalTokens - oldTokens + estimatedSummaryTokens;

    return {
      totalMessages: messages.length,
      compressStart: 0,
      compressEnd: boundary,
      retainCount: messages.length - boundary,
      tokenBefore: totalTokens,
      tokenAfter: newTotalTokens,
    };
  }

  /**
   * 主入口：返回适配后可直接发送给 LLM API 的消息列表。
   * 注意：不会自动触发压缩。使用 getMessagesAsync 获取异步版本。
   */
  getMessages(session: Session): Message[] {
    return this.buildApiMessages(session.getMessages());
  }

  /**
   * 异步版本的 getMessages，支持自动压缩的 await
   */
  async getMessagesAsync(
    session: Session,
    onCompact?: OnCompactCallback
  ): Promise<Message[]> {
    if (this.shouldCompress(session)) {
      await this.compress(session, onCompact);
    }
    return this.buildApiMessages(session.getMessages());
  }

  /**
   * 手动执行压缩（供 /compact 命令使用）
   */
  async compress(
    session: Session,
    onCompact?: OnCompactCallback
  ): Promise<string> {
    return this.compressInternal(session, onCompact);
  }

  // ── private methods ────────────────────────────────────────────────

  /**
   * 从后往前计算滑动窗口边界。
   * 返回需要压缩的消息数量（从开头算起）。
   * 如果所有消息都在窗口内，返回 null。
   */
  private computeWindowBoundary(messages: SessionNode[]): number | null {
    let accumulated = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      accumulated += this.tokenCounter.countMessage(messages[i]);
      if (accumulated >= this.windowTokens) {
        // i 处的消息导致超出窗口，窗口从 i+1 开始
        return i + 1;
      }
    }
    // 所有消息都在窗口内
    return null;
  }

  /**
   * 将 SessionNode[] 转换为 LLM API Message[]，做 role 映射
   */
  private buildApiMessages(nodes: SessionNode[]): Message[] {
    const messages: Message[] = [];
    for (const node of nodes) {
      // summary → system（OpenAI API 合法 role）
      const role =
        node.role === "summary"
          ? "system"
          : (node.role as "system" | "user" | "assistant" | "tool");

      const msg: Message = {
        role,
        content: node.content,
      };
      if (node.tool_calls) {
        msg.tool_calls = node.tool_calls;
      }
      if (node.tool_call_id) {
        msg.tool_call_id = node.tool_call_id;
      }
      if (node.name) {
        msg.name = node.name;
      }

      messages.push(msg);
    }
    return messages;
  }

  /**
   * 执行压缩：调用 LLM 生成摘要，用 replaceRange 更新 session
   */
  private async compressInternal(
    session: Session,
    onCompact?: OnCompactCallback
  ): Promise<string> {
    const messages = session.getMessages();
    const boundary = this.computeWindowBoundary(messages);

    if (boundary === null || boundary === 0) {
      // 无需压缩
      return "";
    }

    const oldMessages = messages.slice(0, boundary);
    const summaryPrompt = buildSummaryPrompt(oldMessages);

    // 调用 LLM 生成摘要
    const req: GenerateRequest = {
      model: "",
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: summaryPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
      stream: true,
    };

    let summaryText = "";
    try {
      for await (const chunk of this.provider.generateStream(req)) {
        if (chunk.type === "text" && chunk.text) {
          summaryText += chunk.text;
        }
      }
    } catch {
      // 摘要生成失败，跳过压缩
      return "";
    }

    if (!summaryText.trim()) {
      return "";
    }

    // 原子替换：将旧消息替换为 summary 节点
    try {
      session.replaceRange(0, boundary, {
        role: "summary",
        content: summaryText.trim(),
      });
    } catch {
      // 文件写入失败，跳过压缩但记录
      return "";
    }

    onCompact?.(summaryText.trim());
    return summaryText.trim();
  }
}
