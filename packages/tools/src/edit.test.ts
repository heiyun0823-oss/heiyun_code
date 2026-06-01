import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { executeEdit } from "./edit.js";

describe("executeEdit", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-edit-test-"));
    return { workdir: tmpDir };
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该精确替换唯一匹配的字符串", async () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "code.ts"), "const x: any = 1;");
      const result = await executeEdit(
        { path: "code.ts", old_string: "const x: any = 1", new_string: "const x: number = 1" },
        ctx
      );
      assert.equal(result.success, true);
      assert.equal(result.metadata!.replacements, 1);
      const content = fs.readFileSync(path.join(tmpDir, "code.ts"), "utf-8");
      assert.equal(content, "const x: number = 1;");
    } finally {
      teardown();
    }
  });

  it("应该在 0 匹配时返回错误", async () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "code.ts"), "hello world");
      const result = await executeEdit(
        { path: "code.ts", old_string: "xyz not found", new_string: "abc" },
        ctx
      );
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("未找到匹配文本"));
    } finally {
      teardown();
    }
  });

  it("应该在多处匹配时返回错误", async () => {
    const ctx = setup();
    try {
      fs.writeFileSync(
        path.join(tmpDir, "code.ts"),
        "import a;\n\nimport b;\n\nimport c;\n"
      );
      const result = await executeEdit(
        { path: "code.ts", old_string: "import", new_string: "export" },
        ctx
      );
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("匹配到 3 处"));
    } finally {
      teardown();
    }
  });
});
