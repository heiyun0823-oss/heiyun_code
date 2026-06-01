import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig } from "./config.js";
import { saveSettings } from "./settings.js";
import type { SettingsData } from "./settings.js";

describe("loadConfig with settings priority", () => {
  let originalEnv: NodeJS.ProcessEnv;

  const setup = () => {
    originalEnv = { ...process.env };
    // 清除可能影响测试的环境变量
    delete process.env.HEIYUN_CODE_API_BASE;
    delete process.env.HEIYUN_CODE_API_KEY;
    delete process.env.HEIYUN_CODE_MODEL;
    delete process.env.HEIYUN_CODE_MAX_ROUNDS;
    delete process.env.HEIYUN_CODE_TEMPERATURE;
    delete process.env.HEIYUN_CODE_SESSION_DIR;
  };

  const teardown = () => {
    process.env = originalEnv;
    // 清理 settings.json
    const settingsFilePath = path.join(
      os.homedir(),
      ".heiyun",
      "settings.json"
    );
    if (fs.existsSync(settingsFilePath)) {
      fs.unlinkSync(settingsFilePath);
    }
  };

  it("无 settings 无 env 无 args 时应使用默认值", () => {
    setup();
    try {
      const config = loadConfig({});
      assert.equal(config.apiBase, "https://api.deepseek.com/v1");
      assert.equal(config.model, ""); // 无 settings 无 env 时为空
    } finally {
      teardown();
    }
  });

  it("CLI args 应优先于默认值", () => {
    setup();
    try {
      const config = loadConfig({
        model: "cli-model",
        apiKey: "cli-key",
      });
      assert.equal(config.model, "cli-model");
      assert.equal(config.apiKey, "cli-key");
    } finally {
      teardown();
    }
  });

  it("环境变量应作为 fallback", () => {
    setup();
    try {
      process.env.HEIYUN_CODE_MODEL = "env-model";
      process.env.HEIYUN_CODE_API_KEY = "env-key";
      const config = loadConfig({});
      assert.equal(config.model, "env-model");
      assert.equal(config.apiKey, "env-key");
    } finally {
      teardown();
    }
  });

  it("CLI args 应优先于环境变量", () => {
    setup();
    try {
      process.env.HEIYUN_CODE_MODEL = "env-model";
      const config = loadConfig({ model: "cli-model" });
      assert.equal(config.model, "cli-model");
    } finally {
      teardown();
    }
  });

  it("settings.json 应具有最高优先级", () => {
    setup();
    try {
      const settingsData: SettingsData = {
        providers: {
          deepseek: {
            apiBase: "https://api.deepseek.com/v1",
            apiKey: "settings-key",
          },
        },
        activeProvider: "deepseek",
        activeModel: "settings-model",
      };

      // 写入临时 settings.json
      const settingsDir = path.join(os.homedir(), ".heiyun");
      const settingsFilePath = path.join(settingsDir, "settings.json");
      fs.mkdirSync(settingsDir, { recursive: true });

      // 备份原有 settings
      let backup: Buffer | null = null;
      if (fs.existsSync(settingsFilePath)) {
        backup = fs.readFileSync(settingsFilePath);
      }

      fs.writeFileSync(
        settingsFilePath,
        JSON.stringify(settingsData, null, 2),
        "utf-8"
      );

      process.env.HEIYUN_CODE_MODEL = "env-model";
      process.env.HEIYUN_CODE_API_KEY = "env-key";

      const config = loadConfig({ model: "cli-model", apiKey: "cli-key" });

      assert.equal(config.model, "settings-model");
      assert.equal(config.apiKey, "settings-key");

      // 恢复
      if (backup) {
        fs.writeFileSync(settingsFilePath, backup);
      } else {
        fs.unlinkSync(settingsFilePath);
      }
    } finally {
      teardown();
    }
  });
});
