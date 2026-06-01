import { describe, it } from "node:test";
import assert from "node:assert";
import * as os from "node:os";
import { executeBash } from "./bash.js";

describe("executeBash", () => {
  const workdir = os.tmpdir();

  it("应该执行成功的命令并返回 stdout", async () => {
    const result = await executeBash({ command: "echo hello" }, { workdir });
    assert.equal(result.success, true);
    assert.ok(result.output.includes("hello"));
    assert.equal(result.metadata!.exit_code, 0);
  });

  it("应该捕获 stderr", async () => {
    const result = await executeBash(
      { command: "echo error >&2" },
      { workdir }
    );
    assert.ok(result.output.includes("error"));
  });

  it("应该在命令失败时返回非零退出码", async () => {
    const result = await executeBash(
      {
        command: process.platform === "win32"
          ? "cmd /c exit 1"
          : "exit 1",
      },
      { workdir }
    );
    assert.equal(result.success, false);
    assert.ok(result.metadata!.exit_code! !== 0);
  });

  it("应该拒绝危险命令", async () => {
    const result = await executeBash(
      { command: "rm -rf / --no-preserve-root" },
      { workdir }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("危险命令"));
  });

  it("应该拒绝 sudo 命令", async () => {
    const result = await executeBash(
      { command: "sudo rm file" },
      { workdir }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("危险命令"));
  });
});
