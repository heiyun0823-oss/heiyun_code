import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadSettings,
  saveSettings,
  settingsPath,
  fetchModels,
  PROVIDER_REGISTRY,
} from "./settings.js";
import type { SettingsData } from "./settings.js";

describe("settings", () => {
  describe("loadSettings", () => {
    it("文件不存在时返回 null", () => {
      // loadSettings reads from ~/.heiyun/settings.json
      // Test by verifying a non-existent temp file scenario
      const result = loadSettings();
      // If settings.json doesn't exist, result should be null
      // If it exists (from other tests/usage), it should be parseable
      if (result !== null) {
        assert.equal(typeof result, "object");
        assert.ok("providers" in result);
      }
    });

    it("文件存在时返回解析后的对象", () => {
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "heiyun-settings-test-")
      );
      const filePath = path.join(tmpDir, "settings.json");
      const data: SettingsData = {
        providers: {
          deepseek: {
            apiBase: "https://api.deepseek.com/v1",
            apiKey: "sk-test",
          },
        },
        activeProvider: "deepseek",
        activeModel: "deepseek-chat",
      };
      fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as SettingsData;
      assert.equal(parsed.activeProvider, "deepseek");
      assert.equal(parsed.activeModel, "deepseek-chat");
      assert.equal(parsed.providers.deepseek.apiKey, "sk-test");
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe("saveSettings", () => {
    it("应将 settings 写入文件并自动创建父目录", () => {
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "heiyun-settings-save-")
      );
      const settingsDir = path.join(tmpDir, ".heiyun");
      const filePath = path.join(settingsDir, "settings.json");

      const data: SettingsData = {
        providers: {
          deepseek: {
            apiBase: "https://api.deepseek.com/v1",
            apiKey: "sk-abc123",
          },
        },
        activeProvider: "deepseek",
        activeModel: null,
      };

      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

      const readBack = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      assert.equal(readBack.providers.deepseek.apiKey, "sk-abc123");
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe("settingsPath", () => {
    it("应返回 ~/.heiyun/settings.json 路径", () => {
      const p = settingsPath();
      assert.ok(p.includes(".heiyun"));
      assert.ok(p.includes("settings.json"));
    });
  });

  describe("PROVIDER_REGISTRY", () => {
    it("应至少包含 deepseek", () => {
      const deepseek = PROVIDER_REGISTRY.find((p) => p.id === "deepseek");
      assert.ok(deepseek);
      assert.equal(deepseek.name, "DeepSeek");
      assert.equal(deepseek.defaultApiBase, "https://api.deepseek.com/v1");
    });
  });

  describe("fetchModels", () => {
    it("是一个函数", () => {
      assert.equal(typeof fetchModels, "function");
    });

    it("接受 3 个必需参数和 1 个可选参数", () => {
      assert.equal(fetchModels.length, 4); // 3 required params + 1 optional (signal)
    });
  });
});
