/**
 * @heiyun/agent-core — context-manager.ts
 * ========================================
 * ContextManager（上下文管理器）— 防止超出 LLM 上下文窗口。
 *
 * 背景知识：上下文窗口是什么？
 *   每个 LLM 模型都有一个"最大上下文窗口"，即一次请求中能处理的
 *   最大 token 数（输入 + 输出）。例如 DeepSeek-V3 是 128K tokens。
 *   当对话历史积累到超出窗口时，API 会报错。
 *
 * 解决方案：滑动窗口 + LLM 摘要压缩
 *
 *   滑动窗口（Sliding Window）：
 *     保留最近 N 条消息（窗口内的），更早的消息会被"遗忘"。
 *     窗口大小 = 总 token 配额 × windowRatio（默认 60%）。
 *
 *   LLM 摘要压缩（Summary Compression）：
 *     不直接丢弃早期消息，而是调用 LLM 把早期对话压缩为一段摘要。
 *     摘要保留了关键信息（做了什么、为什么、当前状态等），
 *     但远少于原始消息的 token 消耗。
 *
 *   触发条件：
 *     当总 token 数达到 maxContextTokens × compressThresholdRatio（默认 90%）时触发。
 *
 * Token 预算分配（以 128K 窗口为例）：
 *   - 保留输出空间（reserveOutputTokens）：4K tokens 给 AI 回复
 *   - 系统提示词（systemPromptTokens）：约 500 tokens
 *   - 剩余可用（usableTokens）：约 123.5K tokens（给对话历史）
 *     - 窗口部分（windowTokens = 60%）：约 74K tokens（始终保留在上下文）
 *     - 可压缩部分：约 49.5K tokens（触发压缩时转为摘要）
 */

import type { LLMProvider, GenerateRequest, Message } from "@heiyun/ai";
import type { SessionNode } from "./types.js";
import { Session } from "./session.js";
import type { TokenCounter } from "./token-counter.js";

// ── 配置接口 ─────────────────────────────────────────────────────────

/** 上下文管理器的配置参数 */
export interface ContextManagerConfig {
  maxContextTokens: number;        // 模型最大上下文窗口 token 数（如 128000）
  windowRatio: number;             // 滑动窗口占比（默认 0.6 = 60%）
  compressThresholdRatio: number;  // 触发压缩的阈值占比（默认 0.9 = 90%）
  reserveOutputTokens: number;     // 预留给 AI 回复的 token 数
  systemPromptTokens: number;      // 系统提示词占用的 token 数
}

/** 压缩预览信息 */
export interface CompactPreview {
  totalMessages: number;   // 总消息数
  compressStart: number;   // 压缩起始索引
  compressEnd: number;     // 压缩结束索引
  retainCount: number;     // 保留的消息数
  tokenBefore: number;     // 压缩前 token 数
  tokenAfter: number;      // 压缩后预估 token 数
}

/** 压缩完成回调函数类型 */
export type OnCompactCallback = (summary: string) => void;

// ── 摘要提示词 ───────────────────────────────────────────────────────

/** 生成摘要时使用的系统提示词 */
const SUMMARY_SYSTEM_PROMPT =
  "你是一个对话摘要助手。请将对话历史压缩为结构化摘要。保持简洁，目标控制在 500-1000 token 以内。";

/**
 * 构建摘要请求的用户提示词
 * 把要压缩的对话消息格式化后，要求 LLM 生成结构化摘要
 */
function buildSummaryPrompt(messages: SessionNode[]): string {
  const lines = messages.map((m) => {
    // 将 role 映射为中文标签
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
    // 提取消息内容（如果是工具调用，则显示调用了哪些工具）
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

// ── ContextManager 类 ────────────────────────────────────────────────

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

  // ── Token 预算计算（getter 属性）─────────────────────────────────

  /** 可用于对话历史的 token 数（扣除输出空间和系统提示词后） */
  private get usableTokens(): number {
    return (
      this.config.maxContextTokens -
      this.config.reserveOutputTokens -
      this.config.systemPromptTokens
    );
  }

  /** 滑动窗口大小（windowRatio 比例的 usableTokens） */
  private get windowTokens(): number {
    return Math.floor(this.usableTokens * this.config.windowRatio);
  }

  /** 触发压缩的 token 阈值 */
  private get compressTriggerTokens(): number {
    return Math.floor(this.usableTokens * this.config.compressThresholdRatio);
  }

  // ── 公开方法 ──────────────────────────────────────────────────────

  /**
   * 获取当前会话消息的总 token 数（不含系统提示词）
   */
  getTokenCount(session: Session): number {
    return this.tokenCounter.countMessages(session.getMessages());
  }

  /**
   * 判断当前会话是否需要压缩
   * @returns true=需要压缩，false=不需要
   */
  shouldCompress(session: Session): boolean {
    return this.getTokenCount(session) >= this.compressTriggerTokens;
  }

  /**
   * 返回压缩预览信息
   * 在 TUI 中展示给用户：当前的 token 使用情况，压缩后会变成什么样
   * @returns 预览信息，无需压缩时返回 null
   */
  getCompactPreview(session: Session): CompactPreview | null {
    const messages = session.getMessages();
    const totalTokens = this.tokenCounter.countMessages(messages);
    const boundary = this.computeWindowBoundary(messages);

    if (boundary === null || boundary === 0) return null;

    const oldMessages = messages.slice(0, boundary);
    const oldTokens = this.tokenCounter.countMessages(oldMessages);
    // 预估摘要 token：旧消息 token 数的 5%，但最少 200，最多 2000
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
   * 同步获取当前可发送给 LLM 的消息列表（不做自动压缩）
   * 主要用于简单场景或已经确认不需要压缩时
   */
  getMessages(session: Session): Message[] {
    return this.buildApiMessages(session.getMessages());
  }

  /**
   * 核心方法：异步获取消息列表（自动检测并压缩）
   * 这是 agentLoop 中实际调用的方法。
   * 流程：检查是否需要压缩 → 需要的话先压缩 → 返回 API 格式的消息列表
   *
   * @param session — 当前会话
   * @param onCompact — 压缩完成回调（用于通知 UI 更新）
   * @returns 可直接发送给 LLM API 的消息数组
   */
  async getMessagesAsync(
    session: Session,
    onCompact?: OnCompactCallback
  ): Promise<Message[]> {
    // 自动检测并压缩
    if (this.shouldCompress(session)) {
      await this.compress(session, onCompact);
    }
    // 转换为 API 格式返回
    return this.buildApiMessages(session.getMessages());
  }

  /**
   * 手动触发压缩（供 /compact 命令使用）
   */
  async compress(
    session: Session,
    onCompact?: OnCompactCallback
  ): Promise<string> {
    return this.compressInternal(session, onCompact);
  }

  // ── 私有方法 ──────────────────────────────────────────────────────

  /**
   * 计算滑动窗口边界（从后往前累计）
   * 
   * 算法：从最后一条消息开始，往前逐条累加 token，
   * 当累计超过 windowTokens 时，该位置之前的消息就是需要压缩的。
   *
   * @returns 需要压缩的消息数量（从开头算），不需要压缩时返回 null
   */
  private computeWindowBoundary(messages: SessionNode[]): number | null {
    let accumulated = 0;
    // 从后往前遍历（i 递减）
    for (let i = messages.length - 1; i >= 0; i--) {
      accumulated += this.tokenCounter.countMessage(messages[i]);
      if (accumulated >= this.windowTokens) {
        // i 处的消息导致超出窗口，窗口从 i+1 开始
        // 所以 i+1 之前的消息（索引 0..i）需要压缩
        return i + 1;
      }
    }
    // 所有消息加起来都不超过窗口大小，不需要压缩
    return null;
  }

  /**
   * 将 SessionNode[] 转换为 LLM API 需要的 Message[] 格式
   * 主要是做 role 映射：summary 角色在 API 中映射为 system
   */
  private buildApiMessages(nodes: SessionNode[]): Message[] {
    const messages: Message[] = [];
    for (const node of nodes) {
      // summary → system（OpenAI API 中合法的 role）
      const role =
        node.role === "summary"
          ? "system"
          : (node.role as "system" | "user" | "assistant" | "tool");

      const msg: Message = {
        role,
        content: node.content,
      };
      // 按需附加字段
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
   * 执行压缩的核心逻辑
   * 
   * 步骤：
   *   1. 计算窗口边界，确定要压缩的消息范围
   *   2. 构建摘要提示词（包含要压缩的全部消息）
   *   3. 调用 LLM 生成摘要
   *   4. 用 replaceRange 原子替换原会话中的消息
   *   5. 触发回调通知 UI
   *
   * 容错：LLM 调用失败时静默跳过压缩（不破坏当前会话）
   */
  private async compressInternal(
    session: Session,
    onCompact?: OnCompactCallback
  ): Promise<string> {
    const messages = session.getMessages();
    const boundary = this.computeWindowBoundary(messages);

    // 无需压缩
    if (boundary === null || boundary === 0) {
      return "";
    }

    // 取出需要压缩的旧消息
    const oldMessages = messages.slice(0, boundary);
    // 构建摘要请求提示词
    const summaryPrompt = buildSummaryPrompt(oldMessages);

    // 调用 LLM 生成摘要（使用低温度，让输出更精简一致）
    const req: GenerateRequest = {
      model: "",  // 空字符串让 provider 使用默认模型
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: summaryPrompt },
      ],
      max_tokens: 2000,     // 摘要最多 2000 tokens
      temperature: 0.3,     // 低温度：更确定、更精简
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
      // 摘要生成失败（如网络错误），跳过压缩
      // 不抛异常——宁可先不压缩，等下一轮再试
      return "";
    }

    // 生成的摘要为空，跳过
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
      // 文件写入失败，跳过
      return "";
    }

    // 通知外部（如 TUI）压缩完成
    onCompact?.(summaryText.trim());
    return summaryText.trim();
  }
}
