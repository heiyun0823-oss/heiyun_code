/**
 * @heiyun/agent-core — token-counter.ts
 * ======================================
 * TokenCounter（Token 计数器）— 估算消息的 token 消耗量。
 *
 * 背景：为什么需要计算 token 数？
 *   每个 LLM 模型都有最大上下文窗口限制（如 128K tokens）。
 *   如果发送的消息超过这个限制，API 会报错。
 *   所以我们需要在发送前估算消息消耗了多少 tokens，
 *   以便在接近限制时做出对策（压缩上下文、减少历史消息等）。
 *
 * Token（令牌）是什么？
 *   Token 是 LLM 处理文本的基本单位。不是字符，也不是单词，
 *   而是 LLM 的词汇表中的"词条"。
 *   粗略估算：1 token ≈ 0.75 个英文单词 ≈ 1-2 个中文字符。
 *   例如 "Hello world" 约 2-3 个 tokens，"你好世界" 约 4-8 个 tokens。
 *
 * js-tiktoken 是什么？
 *   tiktoken 是 OpenAI 开源的 token 计数库。js-tiktoken 是它的 JS 版本。
 *   它使用 BPE（Byte Pair Encoding）算法精确计算 token 数。
 *   不同的模型使用不同的编码器（encoder）：
 *   - GPT-4/ChatGPT: cl100k_base 编码
 *   - DeepSeek: 也是类 GPT 的 BPE 编码（兼容 cl100k_base）
 *
 * 计数方法参考：OpenAI Cookbook 的 token 计算指南
 *   https://github.com/openai/openai-cookbook
 */

import { encodingForModel, getEncoding, type Tiktoken, type TiktokenModel } from "js-tiktoken";

export class TokenCounter {
  /** tiktoken 编码器实例（用来把文本转成 token 数组） */
  private encoder: Tiktoken;

  /**
   * 构造 Token 计数器
   * @param modelName — 模型名称，用于匹配对应的编码器
   *
   * 策略：
   *   1. 尝试精确匹配模型名（如 "gpt-4"）
   *   2. 如果匹配失败（如 "deepseek-chat" 不在 tiktoken 的模型列表中），
   *      回退到 cl100k_base 编码器（这是 GPT-4/ChatGPT 使用的编码，
   *      也是大多数类 GPT 模型的基础编码）
   */
  constructor(modelName: string) {
    try {
      this.encoder = encodingForModel(modelName as TiktokenModel);
    } catch {
      // 模型名不在 tiktoken 支持列表中，使用最通用的 cl100k_base 编码
      this.encoder = getEncoding("cl100k_base");
    }
  }

  /**
   * 计算单条消息的 token 数
   *
   * 每条消息都有"结构开销"，不仅仅是内容文本消耗 token。
   * 例如 <|im_start|>role\ncontent<|im_end|> 这种格式标记也要算在内。
   *
   * 计数公式（参考 OpenAI Cookbook）：
   *   基础开销：每条消息 4 tokens（格式标记）
   *   + role 的 token 数
   *   + content 的 token 数
   *   + name 的 token 数 + 1（如果有）
   *   + tool_call_id 的 token 数 + 2（如果有）
   *   + 每个 tool_call：function.name 的 token 数 + arguments 的 token 数 + 8
   */
  countMessage(msg: {
    role: string;
    content: string | null;
    tool_calls?: Array<{
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    name?: string;
  }): number {
    // 基础开销：每条消息 4 tokens（消息格式标记 <|im_start|>role\n...<|im_end|>）
    let tokens = 4;

    // role 字段本身的 token 消耗
    tokens += this.encoder.encode(msg.role).length;

    // content 文本的 token 消耗
    if (msg.content) {
      tokens += this.encoder.encode(msg.content).length;
    }

    // name 字段的开销（如果有）
    if (msg.name) {
      tokens += this.encoder.encode(msg.name).length;
      tokens += 1; // 分隔符开销
    }

    // tool_call_id 的开销（如果有）
    if (msg.tool_call_id) {
      tokens += this.encoder.encode(msg.tool_call_id).length;
      tokens += 2;
    }

    // 工具调用的额外开销
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        tokens += this.encoder.encode(tc.function.name).length;
        tokens += this.encoder.encode(tc.function.arguments).length;
        tokens += 8; // 函数调用结构的格式开销
      }
    }

    return tokens;
  }

  /**
   * 计算消息数组的总 token 数
   * 所有消息 token 数之和 + 3 token 的请求级开销。
   */
  countMessages(
    messages: Array<{
      role: string;
      content: string | null;
      tool_calls?: Array<{
        function: { name: string; arguments: string };
      }>;
      tool_call_id?: string;
      name?: string;
    }>
  ): number {
    let total = 0;
    for (const msg of messages) {
      total += this.countMessage(msg);
    }
    // 每次请求有 3 token 的基础开销
    return total + 3;
  }
}
