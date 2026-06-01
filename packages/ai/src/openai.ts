import type { GenerateChunk, GenerateRequest, LLMProvider, Message, ToolCallDelta } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  private apiBase: string;
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

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

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  /** 运行时更新 API Key */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /** 运行时更新 API Base */
  setApiBase(apiBase: string): void {
    this.apiBase = apiBase;
  }

  async *generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk> {
    const url = `${this.apiBase}/chat/completions`;

    const body = {
      model: req.model ?? this.model,
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      tools: req.tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: req.tool_choice ?? "auto",
      max_tokens: req.max_tokens ?? this.maxTokens,
      temperature: req.temperature ?? this.temperature,
      stream: true,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: req.signal,
        });

        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            const text = await response.text();
            throw new Error(`API error ${response.status}: ${text}`);
          }
          // 5xx: retry
          throw new Error(`API error ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);

              if (data === "[DONE]") {
                yield { type: "finish" };
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                  yield { type: "text", text: delta.content };
                }

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
                // skip unparseable chunks
              }
            }
          }
        }
        return; // stream ended normally
      } catch (err) {
        lastError = err as Error;
        if (req.signal?.aborted) throw err;
        // Don't retry on 4xx errors (client errors)
        if (lastError && /API error 4\d\d/.test(lastError.message)) throw err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    throw lastError ?? new Error("Unknown error in generateStream");
  }
}
