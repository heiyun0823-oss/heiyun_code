import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { executeWrite } from "./write.js";

describe("executeWrite", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-write-test-"));
    return { workdir: tmpDir };
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该创建新文件并写入内容", async () => {
    const ctx = setup();
    try {
      const result = await executeWrite({ path: "new.txt", content: "hello world" }, ctx);
      assert.equal(result.success, true);
      assert.equal(result.metadata!.bytes_written, 11);
      const content = fs.readFileSync(path.join(tmpDir, "new.txt"), "utf-8");
      assert.equal(content, "hello world");
    } finally {
      teardown();
    }
  });

  it("应该自动创建父目录", async () => {
    const ctx = setup();
    try {
      const result = await executeWrite(
        { path: "sub/deep/dir/file.txt", content: "nested" },
        ctx
      );
      assert.equal(result.success, true);
      const content = fs.readFileSync(
        path.join(tmpDir, "sub/deep/dir/file.txt"),
        "utf-8"
      );
      assert.equal(content, "nested");
    } finally {
      teardown();
    }
  });

  it("应该覆盖已有文件", async () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "old.txt"), "old content");
      const result = await executeWrite({ path: "old.txt", content: "new content" }, ctx);
      assert.equal(result.success, true);
      const content = fs.readFileSync(path.join(tmpDir, "old.txt"), "utf-8");
      assert.equal(content, "new content");
    } finally {
      teardown();
    }
  });

  it("应该拒绝系统路径", async () => {
    const result = await executeWrite(
      { path: "/etc/hosts", content: "bad" },
      { workdir: "/home/user" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("敏感路径") || result.error!.includes("路径穿越"));
  });
});
