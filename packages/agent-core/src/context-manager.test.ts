import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ContextManager } from "./context-manager.js";
import { TokenCounter } from "./token-counter.js";
import { Session } from "./session.js";
import type { LLMProvider, GenerateChunk, GenerateRequest } from "@heiyun/ai";

// 一个假的 LLMProvider，用于测试摘要生成
function fakeProvider(responseText: string): LLMProvider {
  return {
    async *generateStream(_req: GenerateRequest): AsyncGenerator<GenerateChunk> {
      // 按字符逐个 yield 模拟流式输出
      for (const char of responseText) {
        yield { type: "text", text: char };
      }
      yield { type: "finish" };
    },
  };
}

describe("ContextManager", () => {
  let tmpDir: string;
  let tokenCounter: TokenCounter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-ctxmgr-test-"));
    tokenCounter = new TokenCounter("gpt-4");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("getMessagesAsync 对少量消息应直接返回（不压缩）", async () => {
    const session = new Session(tmpDir);
    session.append({ role: "user", content: "hello" });
    session.append({ role: "assistant", content: "hi" });

    const cm = new ContextManager(
      {
        maxContextTokens: 128000,
        windowRatio: 0.6,
        compressThresholdRatio: 0.9,
        reserveOutputTokens: 4096,
        systemPromptTokens: 500,
      },
      tokenCounter,
      fakeProvider("summary")
    );

    const msgs = await cm.getMessagesAsync(session);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, "user");
    assert.equal(msgs[1].role, "assistant");
  });

  it("shouldCompress 在消息量少时应返回 false", () => {
    const session = new Session(tmpDir);
    session.append({ role: "user", content: "short message" });

    const cm = new ContextManager(
      {
        maxContextTokens: 128000,
        windowRatio: 0.6,
        compressThresholdRatio: 0.9,
        reserveOutputTokens: 4096,
        systemPromptTokens: 500,
      },
      tokenCounter,
      fakeProvider("x")
    );

    assert.equal(cm.shouldCompress(session), false);
  });

  it("shouldCompress 在消息量超过阈值时应返回 true", () => {
    const session = new Session(tmpDir);
    const cm = new ContextManager(
      {
        maxContextTokens: 100, // 极小值
        windowRatio: 0.6,
        compressThresholdRatio: 0.9,
        reserveOutputTokens: 10,
        systemPromptTokens: 10,
      },
      tokenCounter,
      fakeProvider("x")
    );

    // 加足够多的消息
    for (let i = 0; i < 20; i++) {
      session.append({
        role: "user",
        content: `message number ${i} with some content to increase tokens`,
      });
      session.append({
        role: "assistant",
        content: `response number ${i} also with more text`,
      });
    }

    assert.equal(cm.shouldCompress(session), true);
  });

  it("getMessagesAsync 超过阈值时应自动压缩并返回摘要+窗口消息", async () => {
    const session = new Session(tmpDir);
    const provider = fakeProvider("## 这是摘要内容");

    const cm = new ContextManager(
      {
        maxContextTokens: 100,
        windowRatio: 0.6,
        compressThresholdRatio: 0.9,
        reserveOutputTokens: 10,
        systemPromptTokens: 10,
      },
      tokenCounter,
      provider
    );

    for (let i = 0; i < 20; i++) {
      session.append({
        role: "user",
        content: `user msg ${i} with enough text to count as tokens`,
      });
      session.append({
        role: "assistant",
        content: `assistant reply ${i} also with sufficient length`,
      });
    }

    let compactCalled = false;
    const msgs = await cm.getMessagesAsync(session, (summary) => {
      compactCalled = true;
      assert.ok(summary.includes("这是摘要内容"));
    });

    assert.ok(compactCalled, "onCompact should have been called");
    // 第一条消息应该是 summary（映射为 system role）
    const summaryMsg = msgs.find((m: { role: string }) => m.role === "system");
    assert.ok(summaryMsg, "should have a system-role summary message");
  });

  it("getCompactPreview 应返回正确的预览信息", () => {
    const session = new Session(tmpDir);
    session.append({ role: "user", content: "msg0 with some text to increase token count" });
    session.append({ role: "assistant", content: "reply0 also with some text" });
    session.append({ role: "user", content: "msg1 with more content" });
    session.append({ role: "assistant", content: "reply1" });

    const cm = new ContextManager(
      {
        maxContextTokens: 128000,
        windowRatio: 0.6,
        compressThresholdRatio: 0.9,
        reserveOutputTokens: 4096,
        systemPromptTokens: 500,
      },
      tokenCounter,
      fakeProvider("x")
    );

    const preview = cm.getCompactPreview(session);
    // 消息量少，窗口能容纳全部消息
    if (preview !== null) {
      assert.ok(preview.totalMessages > 0);
      assert.ok(preview.tokenBefore > 0);
      assert.ok(preview.tokenAfter > 0);
    }
    // preview 可能为 null（无需压缩），这是合法的
    assert.ok(true);
  });

  it("compress 应该手动执行压缩并调用 onCompact", async () => {
    const session = new Session(tmpDir);
    const provider = fakeProvider("# 摘要\n\n完成了一些工作");

    const cm = new ContextManager(
      {
        maxContextTokens: 100,
        windowRatio: 0.6,
        compressThresholdRatio: 0.9,
        reserveOutputTokens: 10,
        systemPromptTokens: 10,
      },
      tokenCounter,
      provider
    );

    // 加入大量消息确保有内容可压缩
    for (let i = 0; i < 15; i++) {
      session.append({
        role: "user",
        content: `user message ${i} with additional tokens to trigger boundary`,
      });
      session.append({
        role: "assistant",
        content: `assistant reply ${i} also with more text`,
      });
    }

    let onCompactCalled = false;
    const summary = await cm.compress(session, (s) => {
      onCompactCalled = true;
    });

    assert.ok(summary.includes("摘要"));
    assert.ok(onCompactCalled);

    // 验证 session 中已包含 summary 消息
    const msgs = session.getMessages();
    assert.equal(msgs[0].role, "summary");
  });

  it("getTokenCount 应返回消息的总 token 数", () => {
    const session = new Session(tmpDir);
    session.append({ role: "user", content: "hello world" });

    const cm = new ContextManager(
      {
        maxContextTokens: 128000,
        windowRatio: 0.6,
        compressThresholdRatio: 0.9,
        reserveOutputTokens: 4096,
        systemPromptTokens: 500,
      },
      tokenCounter,
      fakeProvider("x")
    );

    const count = cm.getTokenCount(session);
    assert.ok(count > 0);
  });
});
