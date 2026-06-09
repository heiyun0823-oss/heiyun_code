import { describe, it } from "node:test";
import assert from "node:assert";
import { THEMES, DEFAULT_THEME, getThemeColors } from "./theme.js";

describe("theme", () => {
  describe("THEMES", () => {
    it("应包含 dark、light、cyber 三个预设主题", () => {
      assert.ok("dark" in THEMES);
      assert.ok("light" in THEMES);
      assert.ok("cyber" in THEMES);
    });

    it("每个主题都包含全部 7 个颜色字段", () => {
      const fields = ["primary", "aiPrefix", "userPrefix", "border", "accent", "muted", "error"];
      for (const theme of Object.values(THEMES)) {
        for (const field of fields) {
          assert.ok(field in theme, `主题缺少字段: ${field}`);
          assert.equal(typeof (theme as any)[field], "string");
          assert.ok((theme as any)[field].startsWith("#"), `${field} 应为 hex 颜色`);
        }
      }
    });
  });

  describe("DEFAULT_THEME", () => {
    it("默认主题为 dark", () => {
      assert.equal(DEFAULT_THEME, "dark");
    });
  });

  describe("getThemeColors", () => {
    it("有效主题名返回对应主题", () => {
      const colors = getThemeColors("cyber");
      assert.equal(colors, THEMES.cyber);
    });

    it("无效主题名回退到默认主题", () => {
      const colors = getThemeColors("nonexistent");
      assert.equal(colors, THEMES.dark);
    });

    it("空字符串回退到默认主题", () => {
      const colors = getThemeColors("");
      assert.equal(colors, THEMES.dark);
    });
  });
});
