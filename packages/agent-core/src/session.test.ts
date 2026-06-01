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
});
