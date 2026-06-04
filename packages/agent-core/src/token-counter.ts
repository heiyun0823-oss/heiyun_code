// === Token 计数 ===
// 封装 js-tiktoken 提供消息级别的 token 计数

import { encodingForModel, getEncoding, type Tiktoken, type TiktokenModel } from "js-tiktoken";

export class TokenCounter {
  private encoder: Tiktoken;

  constructor(modelName: string) {
    // 尝试精确匹配模型名，fallback 到 cl100k_base（GPT-4/ChatGPT 编码）
    try {
      this.encoder = encodingForModel(modelName as TiktokenModel);
    } catch {
      this.encoder = getEncoding("cl100k_base");
    }
  }

  countMessage(msg: {
    role: string;
    content: string | null;
    tool_calls?: Array<{
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    name?: string;
  }): number {
    // 参考 OpenAI cookbook
    // 每条消息基础 token 消耗：<|im_start|>role\ncontent<|im_end|>
    let tokens = 4;

    // role
    tokens += this.encoder.encode(msg.role).length;

    // content
    if (msg.content) {
      tokens += this.encoder.encode(msg.content).length;
    }

    // name
    if (msg.name) {
      tokens += this.encoder.encode(msg.name).length;
      tokens += 1; // separator overhead
    }

    // tool_call_id
    if (msg.tool_call_id) {
      tokens += this.encoder.encode(msg.tool_call_id).length;
      tokens += 2;
    }

    // tool_calls
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        tokens += this.encoder.encode(tc.function.name).length;
        tokens += this.encoder.encode(tc.function.arguments).length;
        tokens += 8; // overhead for function call structure
      }
    }

    return tokens;
  }

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
    // 每次请求有 3 token priming overhead
    return total + 3;
  }
}
