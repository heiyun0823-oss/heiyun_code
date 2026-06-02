import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CLOUD_SHAPE, WAVE_COLORS, getPixelColor } from "./logo.js";

describe("Logo pixel cloud", () => {
  it("CLOUD_SHAPE is 6 rows by 11 columns", () => {
    assert.equal(CLOUD_SHAPE.length, 6);
    for (const row of CLOUD_SHAPE) {
      assert.equal(row.length, 11);
    }
  });

  it("CLOUD_SHAPE values are only 0, 1, 2, or 3", () => {
    for (const row of CLOUD_SHAPE) {
      for (const val of row) {
        assert.ok(
          [0, 1, 2, 3].includes(val),
          `Expected 0-3, got ${val}`
        );
      }
    }
  });

  it("WAVE_COLORS has exactly 11 entries", () => {
    assert.equal(WAVE_COLORS.length, 11);
  });

  it("getPixelColor returns null for empty cells (depth 0)", () => {
    // Top-left corner is always empty (depth 0)
    assert.equal(getPixelColor(0, 0, 0), null);
    assert.equal(getPixelColor(0, 0, 100), null);
  });

  it("getPixelColor returns a hex color for filled cells", () => {
    const color = getPixelColor(0, 4, 0);
    assert.ok(color !== null, "Expected a color, got null");
    assert.ok(
      color!.startsWith("#"),
      `Expected hex color, got ${color}`
    );
  });

  it("getPixelColor produces different colors at different offsets", () => {
    const colorAt0 = getPixelColor(3, 5, 0);
    const colorAt5 = getPixelColor(3, 5, 5);
    assert.notEqual(colorAt0, colorAt5);
  });

  it("getPixelColor depth shading: core is darker than edge at same offset", () => {
    // Row 3, col 4 is core (depth 3), row 3, col 0 is edge (depth 1)
    const coreColor = getPixelColor(3, 4, 0);
    const edgeColor = getPixelColor(3, 0, 0);
    assert.ok(coreColor !== null);
    assert.ok(edgeColor !== null);
    // Parse hex to compare brightness — core should be darker
    const coreBrightness = hexBrightness(coreColor!);
    const edgeBrightness = hexBrightness(edgeColor!);
    assert.ok(
      coreBrightness < edgeBrightness,
      `Core (${coreColor}) should be darker than edge (${edgeColor})`
    );
  });
});

function hexBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r + g + b;
}