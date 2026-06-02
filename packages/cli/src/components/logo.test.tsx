import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RAINBOW } from "./logo.js";

describe("Logo (unit)", () => {
  it("RAINBOW palette has 6 colors", () => {
    assert.equal(RAINBOW.length, 6);
  });

  it("colorForChar cycles with offset", () => {
    const colorForChar = (i: number, offset: number) =>
      RAINBOW[(i + offset) % RAINBOW.length];
    assert.equal(colorForChar(0, 0), RAINBOW[0]);
    assert.equal(colorForChar(0, 1), RAINBOW[1]);
    assert.equal(colorForChar(5, 0), RAINBOW[5]);
    assert.equal(colorForChar(5, 1), RAINBOW[0]); // wraps
  });
});
