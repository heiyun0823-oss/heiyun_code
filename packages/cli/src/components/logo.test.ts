import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RAINBOW, getRainbowColor } from "./logo.js";

describe("Logo", () => {
  it("RAINBOW palette has 6 colors", () => {
    assert.equal(RAINBOW.length, 6);
  });

  it("getRainbowColor cycles with offset and wraps around", () => {
    assert.equal(getRainbowColor(0, 0), RAINBOW[0]);
    assert.equal(getRainbowColor(0, 1), RAINBOW[1]);
    assert.equal(getRainbowColor(5, 0), RAINBOW[5]);
    assert.equal(getRainbowColor(5, 1), RAINBOW[0]);
    // large offset wraps correctly
    assert.equal(getRainbowColor(0, 6), RAINBOW[0]);
    assert.equal(getRainbowColor(2, 10), RAINBOW[0]); // (2+10)%6 = 0
  });
});
