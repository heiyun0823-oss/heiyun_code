import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { executeRead } from "./read.js";

describe("executeRead", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-read-test-"));
    return { workdir: tmpDir };
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该读取文件全部内容", async () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "test.txt"), "line1\nline2\nline3\n");
      const result = await executeRead({ path: "test.txt" }, ctx);
      assert.equal(result.success, true);
      assert.ok(result.output.includes("line1"));
      assert.ok(result.output.includes("line3"));
    } finally {
      teardown();
    }
  });

  it("应该支持 offset 和 limit 参数", async () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "test.txt"), "a\nb\nc\nd\ne\n");
      const result = await executeRead({ path: "test.txt", offset: 2, limit: 2 }, ctx);
      assert.equal(result.success, true);
      assert.ok(!result.output.includes("a"));
      assert.ok(result.output.includes("b"));
      assert.ok(result.output.includes("c"));
      assert.ok(!result.output.includes("d"));
    } finally {
      teardown();
    }
  });

  it("应该在文件不存在时返回错误", async () => {
    const ctx = setup();
    try {
      const result = await executeRead({ path: "nope.txt" }, ctx);
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("文件不存在"));
    } finally {
      teardown();
    }
  });

  it("应该拒绝路径穿越", async () => {
    const ctx = setup();
    try {
      const result = await executeRead({ path: "../etc/passwd" }, ctx);
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("路径穿越"));
    } finally {
      teardown();
    }
  });

  it("应该拒绝敏感路径", async () => {
    const result = await executeRead({ path: "/etc/passwd" }, { workdir: "/home/user" });
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("敏感路径") || result.error!.includes("路径穿越"));
  });
});
