import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLOUD_SHAPE,
  INK_COLORS,
  CRIMSON_DARK,
  CRIMSON_BASE,
  CRIMSON_PEAK,
  getPixelColor,
} from "./logo.js";

describe("Crimson Cloud Swordsman Logo", () => {
  // --- 常量测试 ---

  describe("CLOUD_SHAPE", () => {
    it("is 13 rows by 21 columns", () => {
      assert.equal(CLOUD_SHAPE.length, 13);
      for (const row of CLOUD_SHAPE) {
        assert.equal(row.length, 21);
      }
    });

    it("values are only 0, 1, 2, 3, or 4", () => {
      for (const row of CLOUD_SHAPE) {
        for (const val of row) {
          assert.ok(
            [0, 1, 2, 3, 4].includes(val),
            `Expected 0-4, got ${val}`
          );
        }
      }
    });

    it("contains at least one crimson pixel (depth 4)", () => {
      const flat = CLOUD_SHAPE.flat();
      assert.ok(flat.some((v) => v === 4), "Expected at least one depth-4 pixel");
    });
  });

  describe("INK_COLORS", () => {
    it("has entries for depth 1, 2, 3", () => {
      assert.equal(INK_COLORS[1], "#555555");
      assert.equal(INK_COLORS[2], "#777777");
      assert.equal(INK_COLORS[3], "#999999");
    });

    it("has no entry for depth 0 or 4 (these are handled separately)", () => {
      assert.equal(INK_COLORS[0], undefined);
      assert.equal(INK_COLORS[4], undefined);
    });
  });

  describe("CRIMSON constants", () => {
    it("has correct hex values", () => {
      assert.equal(CRIMSON_DARK, "#7f1d1d");
      assert.equal(CRIMSON_BASE, "#c0392b");
      assert.equal(CRIMSON_PEAK, "#e74c3c");
    });
  });

  // --- getPixelColor 纯函数测试 ---

  describe("getPixelColor", () => {
    it("returns null for empty cells (depth 0)", () => {
      // Row 0, col 0 is empty in the grid
      assert.equal(getPixelColor(0, 0, 0), null);
      assert.equal(getPixelColor(0, 0, 0.5), null);
      assert.equal(getPixelColor(0, 0, 1.0), null);
    });

    it("returns null for out-of-bounds coordinates", () => {
      assert.equal(getPixelColor(-1, 0, 0), null);
      assert.equal(getPixelColor(0, -1, 0), null);
      assert.equal(getPixelColor(13, 0, 0), null);
      assert.equal(getPixelColor(0, 21, 0), null);
    });

    it("returns #555555 for depth 1 regardless of breathPhase", () => {
      assert.equal(getPixelColor(0, 10, 0), "#555555");    // Row 0, col 10 = 1
      assert.equal(getPixelColor(0, 10, 0.5), "#555555");
      assert.equal(getPixelColor(0, 10, 1.0), "#555555");
    });

    it("returns #777777 for depth 2 regardless of breathPhase", () => {
      // Row 2, col 10 = 2
      const color = getPixelColor(2, 10, 0);
      assert.equal(color, "#777777");
      const color2 = getPixelColor(2, 10, 0.9);
      assert.equal(color2, "#777777");
    });

    it("returns #999999 for depth 3 regardless of breathPhase", () => {
      // Row 3, col 10 = 3
      const color = getPixelColor(3, 10, 0);
      assert.equal(color, "#999999");
      const color2 = getPixelColor(3, 10, 1.0);
      assert.equal(color2, "#999999");
    });

    it("returns CRIMSON_DARK at breathPhase=0 for depth 4", () => {
      const color = getPixelColor(6, 9, 0); // Row 6, col 9 = 4 (left eye)
      assert.equal(color, "#7f1d1d");
    });

    it("returns CRIMSON_BASE at breathPhase=0.85 for depth 4", () => {
      const color = getPixelColor(6, 9, 0.85);
      assert.equal(color, "#c0392b");
    });

    it("returns CRIMSON_PEAK at breathPhase=1.0 for depth 4", () => {
      const color = getPixelColor(6, 9, 1.0);
      assert.equal(color, "#e74c3c");
    });

    it("returns intermediate color between DARK and BASE at breathPhase=0.425 for depth 4", () => {
      const color = getPixelColor(6, 9, 0.425);
      assert.ok(color !== null);
      // Should be roughly midpoint between #7f1d1d and #c0392b
      // r: ~160 (midpoint of 127 and 192)
      assert.ok(color!.startsWith("#"));
      // Verify it's not equal to either endpoint
      assert.notEqual(color, "#7f1d1d");
      assert.notEqual(color, "#c0392b");
    });

    it("depth-4 color varies with breathPhase", () => {
      const c0 = getPixelColor(6, 9, 0);
      const c05 = getPixelColor(6, 9, 0.5);
      const c10 = getPixelColor(6, 9, 1.0);
      // All should be different
      assert.notEqual(c0, c05);
      assert.notEqual(c05, c10);
      assert.notEqual(c0, c10);
    });

    it("all return values are valid hex colors or null", () => {
      for (let row = 0; row < 13; row++) {
        for (let col = 0; col < 21; col++) {
          const color = getPixelColor(row, col, 0.5);
          if (color === null) continue;
          assert.ok(
            /^#[0-9a-f]{6}$/.test(color),
            `Expected hex color, got "${color}" at (${row}, ${col})`
          );
        }
      }
    });
  });
});
