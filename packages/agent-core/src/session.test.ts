import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Session } from "./session.js";

describe("Session", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-session-test-"));
    return tmpDir;
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该创建新会话并追加消息", () => {
    const dir = setup();
    try {
      const session = new Session(dir);
      session.append({ role: "user", content: "hello" });
      const msgs = session.getMessages();
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].role, "user");
      assert.equal(msgs[0].content, "hello");
      assert.ok(msgs[0].id);
      assert.ok(msgs[0].timestamp);
    } finally {
      teardown();
    }
  });

  it("应该将消息持久化到 JSONL 文件", () => {
    const dir = setup();
    try {
      const session = new Session(dir);
      session.append({ role: "user", content: "msg1" });
      session.append({ role: "assistant", content: "reply1" });

      // load back
      const loaded = Session.load(session.filePath);
      const msgs = loaded.getMessages();
      assert.equal(msgs.length, 2);
      assert.equal(msgs[0].content, "msg1");
      assert.equal(msgs[1].content, "reply1");
    } finally {
      teardown();
    }
  });

  it("应该列出所有会话", () => {
    const dir = setup();
    try {
      const s1 = new Session(dir);
      s1.append({ role: "user", content: "会话 1 第一条消息" });
      const s2 = new Session(dir);
      s2.append({ role: "user", content: "会话 2" });

      const list = Session.list(dir);
      assert.equal(list.length, 2);
      assert.ok(list.some((m) => m.id === s1.id));
      assert.ok(list.some((m) => m.id === s2.id));
    } finally {
      teardown();
    }
  });

  it("getMessageRange 应该返回指定范围内的消息", () => {
    const dir = setup();
    try {
      const session = new Session(dir);
      session.append({ role: "user", content: "msg0" });
      session.append({ role: "assistant", content: "msg1" });
      session.append({ role: "user", content: "msg2" });
      session.append({ role: "assistant", content: "msg3" });

      const range = session.getMessageRange(1, 3);
      assert.equal(range.length, 2);
      assert.equal(range[0].content, "msg1");
      assert.equal(range[1].content, "msg2");
    } finally {
      teardown();
    }
  });

  it("replaceRange 应该将范围内的消息替换为一条 summary 消息", () => {
    const dir = setup();
    try {
      const session = new Session(dir);
      session.append({ role: "user", content: "msg0" });
      session.append({ role: "assistant", content: "msg1" });
      session.append({ role: "user", content: "msg2" });
      session.append({ role: "assistant", content: "msg3" });

      session.replaceRange(0, 3, { role: "summary", content: "compressed summary" });

      const msgs = session.getMessages();
      assert.equal(msgs.length, 2); // summary + msg3
      assert.equal(msgs[0].role, "summary");
      assert.equal(msgs[0].content, "compressed summary");
      assert.equal(msgs[1].content, "msg3");
      assert.ok(msgs[0].id);
      assert.ok(msgs[0].timestamp);
    } finally {
      teardown();
    }
  });

  it("replaceRange 应该持久化到文件（原子写入验证）", () => {
    const dir = setup();
    try {
      const session = new Session(dir);
      session.append({ role: "user", content: "old1" });
      session.append({ role: "assistant", content: "old2" });

      session.replaceRange(0, 2, { role: "summary", content: "summary text" });

      // 从文件重新加载验证持久化
      const loaded = Session.load(session.filePath);
      const msgs = loaded.getMessages();
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].role, "summary");
      assert.equal(msgs[0].content, "summary text");

      // 不应存在临时文件
      assert.ok(!fs.existsSync(session.filePath + ".tmp"));
    } finally {
      teardown();
    }
  });
});
