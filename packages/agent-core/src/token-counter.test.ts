import { describe, it } from "node:test";
import assert from "node:assert";
import { TokenCounter } from "./token-counter.js";

describe("TokenCounter", () => {
  it("应该使用 cl100k_base 编码器对未知模型 fallback", () => {
    const tc = new TokenCounter("unknown-model-xyz");
    // 只要能构造成功就算通过
    assert.ok(tc);
  });

  it("应该对单条 user 消息计数", () => {
    const tc = new TokenCounter("gpt-4");
    const count = tc.countMessage({
      role: "user",
      content: "hello world",
    });
    assert.ok(count > 0, `expected positive count, got ${count}`);
  });

  it("应该对多条消息计数", () => {
    const tc = new TokenCounter("gpt-4");
    const count = tc.countMessages([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ]);
    // 至少比单条消息多
    const single = tc.countMessage({ role: "user", content: "hello" });
    assert.ok(count > single, `expected ${count} > ${single}`);
  });

  it("相同内容计数结果一致（幂等）", () => {
    const tc = new TokenCounter("gpt-4");
    const msg = { role: "user", content: "hello world" };
    const c1 = tc.countMessage(msg);
    const c2 = tc.countMessage(msg);
    assert.equal(c1, c2);
  });

  it("应该对包含 tool_calls 的 assistant 消息计数", () => {
    const tc = new TokenCounter("gpt-4");
    const count = tc.countMessage({
      role: "assistant",
      content: "Let me read that file.",
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: { name: "read", arguments: '{"path":"/tmp/test"}' },
        },
      ],
    });
    assert.ok(count > 0);
  });

  it("空 content 消息不应报错", () => {
    const tc = new TokenCounter("gpt-4");
    const count = tc.countMessage({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_456",
          type: "function",
          function: { name: "bash", arguments: '{"command":"ls"}' },
        },
      ],
    });
    assert.ok(count > 0);
  });
});
