import { describe, it } from "node:test";
import assert from "node:assert";
import { OpenAIProvider } from "./openai.js";

describe("OpenAIProvider.generateStream", () => {
  it("should parse text chunks from SSE stream", async () => {
    // Setup mock that returns SSE text chunks
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"id":"cmpl-1","choices":[{"delta":{"content":"你好"}}]}\n\n' +
                'data: {"id":"cmpl-1","choices":[{"delta":{"content":"世界"}}]}\n\n' +
                "data: [DONE]\n\n"
            )
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test" });
      const chunks: string[] = [];
      for await (const chunk of provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "hello" }],
      })) {
        if (chunk.type === "text") chunks.push(chunk.text!);
      }
      assert.equal(chunks.join(""), "你好世界");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should parse tool_call delta chunks", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"id":"cmpl-1","choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read","arguments":"{\\"path\\":\\""}}]}}]}\n\n' +
                'data: {"id":"cmpl-1","choices":[{"delta":{"tool_calls":[{"index":0,"type":"function","function":{"arguments":"test.ts\\"}"}}]}}]}\n\n' +
                "data: [DONE]\n\n"
            )
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test" });
      const toolCallChunks: Array<Partial<import("./types.js").ToolCallDelta>> = [];
      for await (const chunk of provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "read file" }],
      })) {
        if (chunk.type === "tool_call") toolCallChunks.push(chunk.toolCall!);
      }
      assert.equal(toolCallChunks.length, 2);
      assert.equal(toolCallChunks[0].function?.name, "read");
      assert.equal(
        toolCallChunks[0].function?.arguments,
        '{"path":"'
      );
      assert.equal(
        toolCallChunks[1].function?.arguments,
        'test.ts"}'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should retry on 5xx and succeed", async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount <= 2) {
        return new Response("Internal Error", { status: 500 });
      }
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode("data: [DONE]\n\n")
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test" });
      const chunks: Array<import("./types.js").GenerateChunk> = [];
      for await (const chunk of provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }
      assert.equal(callCount, 3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should not retry on 4xx errors", async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      callCount++;
      return new Response("Unauthorized", { status: 401 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "bad-key" });
      const gen = provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "hi" }],
      });
      await assert.rejects(async () => {
        for await (const _ of gen) {
          // should throw
        }
      });
      assert.equal(callCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
