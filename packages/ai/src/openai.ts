/**
 * @heiyun/ai — openai.ts
 * ======================
 * OpenAIProvider 是与 OpenAI 兼容 API 通信的核心类。
 * 虽然名字叫 "OpenAI"，但它其实兼容任何 OpenAI 格式的 API：
 * DeepSeek、Moonshot、通义千问、智谱 GLM 等都可以用。
 *
 * 核心职责：
 *   1. 管理 API 配置（地址、密钥、模型名、温度等）
 *   2. 实现 generateStream() 方法：发送请求 → 解析 SSE 流 → 逐个产出 Chunk
 *   3. 自动重试（网络错误和 5xx 服务器错误最多重试 3 次）
 *
 * SSE（Server-Sent Events）是什么？
 * SSE 是一种 HTTP 长连接技术。客户端发送请求后，服务器不关闭连接，
 * 而是持续推送数据。每条数据以 "data: " 开头，以 "\n\n" 结尾。
 * 这样 AI 生成的文本就能像打字一样逐字显示。
 */

import type { GenerateChunk, GenerateRequest, LLMProvider, Message, ToolCallDelta } from "./types.js";

/**
 * OpenAI 兼容 API 的 Provider 实现
 * 通过 fetch API + SSE 流式解析实现与 LLM 服务的通信
 */
export class OpenAIProvider implements LLMProvider {
  // ===== 私有属性 =====
  // private 表示这些属性只能在类的内部访问，外部代码无法直接修改
  private apiBase: string;      // API 基础 URL，如 "https://api.deepseek.com/v1"
  private apiKey: string;       // API 认证密钥（Bearer Token）
  private model: string;        // 使用的模型名，如 "deepseek-chat"
  private maxTokens: number;    // 单次回复最大 token 数（限制回复长度以控制成本）
  private temperature: number;  // 生成温度（0=保守/确定，1=创造性/随机）

  /**
   * 构造函数（Constructor）
   * 当 new OpenAIProvider(...) 时自动调用，用于初始化配置。
   *
   * 参数优先级（?? 是"空值合并运算符"，只有左侧是 null 或 undefined 时才用右侧）：
   *   1. opts 参数（代码中直接传入）
   *   2. 环境变量（HEIYUN_CODE_*）
   *   3. 硬编码默认值
   */
  constructor(opts?: {
    apiBase?: string;
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    this.apiBase = opts?.apiBase ?? process.env.HEIYUN_CODE_API_BASE ?? "https://api.deepseek.com/v1";
    this.apiKey = opts?.apiKey ?? process.env.HEIYUN_CODE_API_KEY ?? "";
    this.model = opts?.model ?? process.env.HEIYUN_CODE_MODEL ?? "deepseek-chat";
    this.maxTokens = opts?.maxTokens ?? 4096;
    this.temperature = opts?.temperature ?? 0.7;
  }

  // ===== 配置读写方法 =====
  // 这些方法允许在程序运行过程中动态修改 Provider 配置
  // 例如：用户在 TUI 中通过 /model 命令切换模型时，会调用 setModel()

  /** 获取当前模型名 */
  getModel(): string {
    return this.model;
  }

  /** 切换模型（用于 /model 命令） */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * 运行时更新 API Key
   * 例如用户通过 /login 命令输入新的 API 密钥
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * 运行时更新 API 地址
   * 例如从 DeepSeek 切换到另一个兼容服务商
   */
  setApiBase(apiBase: string): void {
    this.apiBase = apiBase;
  }

  /**
   * 核心方法：向 LLM API 发送请求并流式解析回复
   *
   * async * 是 "异步生成器函数" 的语法。
   * 它用 yield 关键字逐个产出数据，而不是一次性 return。
   * 调用方通过 for await...of 循环来逐个接收 Chunk。
   *
   * 整个流程：
   *   1. 构建请求体（body）→ 发送 POST 请求
   *   2. 获取响应的 ReadableStream（可读流）
   *   3. 逐块读取流数据 → 解析 SSE 格式 → yield 产出 Chunk
   *   4. 遇到网络错误/5xx 时自动重试（最多 3 次）
   */
  async *generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk> {
    // OpenAI API 的聊天补全端点
    // 所有兼容 API 都使用 /chat/completions 这个路径
    const url = `${this.apiBase}/chat/completions`;

    // === 构建请求体 ===
    // 这是发送给 API 的 JSON 数据，包含对话上下文和配置参数
    const body = {
      model: req.model ?? this.model,           // 使用的模型
      // 将内部 Message 类型转换为 API 期望的格式
      // .map() 遍历数组，对每个元素做转换
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
        // ...展开运算符：条件性地添加字段。
        // 只在原对象有该字段时才包含，避免发送 undefined 值
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      // 工具定义同样需要转换：包装成 { type: "function", function: {...} } 格式
      tools: req.tools?.map((t) => ({
        type: "function" as const,               // "as const" 让 TS 推断为字面量类型
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: req.tool_choice ?? "auto",   // 工具调用策略
      max_tokens: req.max_tokens ?? this.maxTokens,
      temperature: req.temperature ?? this.temperature,
      stream: true,                               // 开启流式传输
    };

    // === 重试循环 ===
    // attempt 从 0 开始，最多到 2（共 3 次尝试）
    // lastError 记录最后一次失败原因，如果全部重试失败就抛出它
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        // --- 发送 HTTP POST 请求 ---
        // fetch() 是浏览器和 Node.js 都内置的 HTTP 请求函数
        // await 是"等待"：暂停当前函数执行，等 Promise 完成后继续
        const response = await fetch(url, {
          method: "POST",                         // HTTP 方法
          headers: {
            "Content-Type": "application/json",    // 请求体是 JSON
            Authorization: `Bearer ${this.apiKey}`, // 认证头：Bearer Token 方式
          },
          body: JSON.stringify(body),              // 将 JS 对象转为 JSON 字符串
          signal: req.signal,                      // 传递中断信号
        });

        // --- 检查响应状态 ---
        // response.ok 等价于状态码 200-299
        if (!response.ok) {
          // 4xx 错误（客户端错误）：如 401 未授权、404 找不到
          // 这类错误重试没有意义，直接抛出
          if (response.status >= 400 && response.status < 500) {
            const text = await response.text();
            throw new Error(`API error ${response.status}: ${text}`);
          }
          // 5xx 错误（服务器错误）：如 503 服务不可用
          // 可能是暂时性问题，我们会在 catch 块中重试
          throw new Error(`API error ${response.status}`);
        }

        // body 是响应体。流式请求的 body 是一个 ReadableStream（可读流）
        if (!response.body) {
          throw new Error("No response body");
        }

        // === 流式读取响应 ===
        // getReader() 获取一个 ReadableStreamDefaultReader，
        // 它让我们可以"一块一块地"读取服务器推送的数据
        const reader = response.body.getReader();
        // TextDecoder 把二进制数据（Uint8Array）解码成字符串
        const decoder = new TextDecoder();
        // buffer：缓冲区。因为每次收到的数据块不一定刚好是一条完整的 SSE 事件，
        // 可能被切断，所以需要先把数据攒在 buffer 里，等凑成完整的再处理
        let buffer = "";

        while (true) {
          // reader.read() 返回 { done, value }
          // done=true 表示流已结束，value 是本次读到的 Uint8Array 数据块
          const { done, value } = await reader.read();
          if (done) break; // 流结束，跳出循环

          // 解码二进制数据并追加到缓冲区
          buffer += decoder.decode(value, { stream: true });

          // SSE 协议：事件之间以 "\n\n"（空行）分隔
          // split("\n\n") 按空行切开，得到各个完整的事件
          const events = buffer.split("\n\n");
          // pop() 取出最后一个——它可能是不完整的（还没收到第二个空行）
          // 所以放回 buffer 等待下次拼接
          buffer = events.pop() ?? "";

          // 逐个处理完整的 SSE 事件
          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              // SSE 数据行以 "data: " 开头
              if (!line.startsWith("data: ")) continue;
              // 去掉 "data: " 前缀（6 个字符）
              const data = line.slice(6);

              // "[DONE]" 是 SSE 流的结束标记
              if (data === "[DONE]") {
                yield { type: "finish" };   // 通知调用方流已结束
                return;                      // 退出生成器函数
              }

              try {
                // 解析 JSON 数据
                const parsed = JSON.parse(data);
                // API 返回格式：{ choices: [{ delta: { content?, tool_calls? } }] }
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;  // 没有 delta 的帧跳过

                // 文本内容：AI 正在说话
                if (delta.content) {
                  yield { type: "text", text: delta.content };
                }

                // 工具调用：AI 想要调用某个工具
                // 可能有多个并行的工具调用，所以用 for 循环
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    yield {
                      type: "tool_call",
                      toolCall: {
                        index: tc.index,
                        id: tc.id,
                        type: "function",
                        function: tc.function
                          ? {
                              name: tc.function.name,
                              arguments: tc.function.arguments,
                            }
                          : undefined,
                      },
                    };
                  }
                }
              } catch {
                // 如果某行 JSON 解析失败（可能是格式错误或非标准扩展），
                // 静默跳过，不影响后续处理
              }
            }
          }
        }
        // 流正常结束（没有收到 [DONE] 标记的情况）
        return;
      } catch (err) {
        // === 错误处理 & 重试逻辑 ===
        lastError = err as Error;

        // 如果用户主动取消了请求（如按了 Ctrl+C），不再重试
        if (req.signal?.aborted) throw err;

        // 4xx 客户端错误不重试（因为重试也不会改变结果）
        // /API error 4\d\d/ 是正则表达式，匹配 "API error 401" 等
        if (lastError && /API error 4\d\d/.test(lastError.message)) throw err;

        // 还有重试次数的话，等待后重试
        if (attempt < 2) {
          // 指数退避（Exponential Backoff）：
          // 第1次重试等 1s (2^0 * 1000)，第2次等 2s (2^1 * 1000)
          // 给服务器恢复的时间，同时避免在短时间内大量重试
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    // 所有重试都失败了，抛出最后的错误
    throw lastError ?? new Error("Unknown error in generateStream");
  }
}
