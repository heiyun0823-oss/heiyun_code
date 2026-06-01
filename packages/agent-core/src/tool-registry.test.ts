import { describe, it } from "node:test";
import assert from "node:assert";
import { ToolRegistry } from "./tool-registry.js";

describe("ToolRegistry", () => {
  it("应该注册 4 个内置工具", () => {
    const registry = new ToolRegistry();
    const defs = registry.getDefinitions();
    assert.equal(defs.length, 4);
    const names = defs.map((d) => d.name).sort();
    assert.deepStrictEqual(names, ["bash", "edit", "read", "write"]);
  });

  it("应该执行已注册的工具", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute(
      {
        id: "call_1",
        type: "function",
        function: {
          name: "read",
          arguments: JSON.stringify({ path: "nonexistent.txt" }),
        },
      },
      { workdir: "/tmp" }
    );
    assert.equal(result.success, false);
    // Expect file-not-found error since file doesn't exist
  });

  it("应该在工具不存在时返回错误", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute(
      {
        id: "call_2",
        type: "function",
        function: {
          name: "nonexistent_tool",
          arguments: "{}",
        },
      },
      { workdir: "/tmp" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("未知工具"));
  });

  it("应该在参数 JSON 非法时返回错误", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute(
      {
        id: "call_3",
        type: "function",
        function: {
          name: "read",
          arguments: "not valid json",
        },
      },
      { workdir: "/tmp" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("JSON 解析失败"));
  });
});
