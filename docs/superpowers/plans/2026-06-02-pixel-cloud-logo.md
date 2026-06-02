# Pixel Cloud Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing rainbow text Logo with a soft pixel cloud pattern using flowing pink color wave animation.

**Architecture:** Rewrite `logo.tsx` to render an 11×6 pixel cloud grid using Ink's `<Text>` component with block characters (`█`), each pixel individually colored by a pure `getPixelColor()` function. The animation uses the same `useState` + `setInterval` mechanism as the current Logo. Tests cover the exported pure functions (`CLOUD_SHAPE`, `WAVE_COLORS`, `getPixelColor`).

**Tech Stack:** React, Ink 5, TypeScript, Node.js built-in test runner

---

### Task 1: Write failing tests for pixel cloud exports

**Files:**
- Modify: `packages/cli/src/components/logo.test.ts`

- [ ] **Step 1: Rewrite the test file with new pixel cloud tests**

Replace the entire content of `logo.test.ts`. The tests verify:
- `CLOUD_SHAPE` is 6 rows × 11 columns
- `CLOUD_SHAPE` values are only 0, 1, 2, or 3
- `WAVE_COLORS` has exactly 11 entries
- `getPixelColor` returns `null` for empty cells (depth 0)
- `getPixelColor` returns a hex color string for filled cells
- `getPixelColor` produces different colors at different offsets (animation)
- `getPixelColor` produces different colors for core vs edge at the same offset (depth shading)

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test packages/cli/src/components/logo.test.ts`

Expected: FAIL — the current `logo.tsx` exports `RAINBOW` and `getRainbowColor`, not `CLOUD_SHAPE`, `WAVE_COLORS`, or `getPixelColor`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/cli/src/components/logo.test.ts
git commit -m "test: add failing tests for pixel cloud logo exports"
```

---

### Task 2: Implement pixel cloud data and getPixelColor

**Files:**
- Modify: `packages/cli/src/components/logo.tsx`

This task replaces the entire content of `logo.tsx` with the pixel cloud data structures and the pure `getPixelColor` function. The React component will be added in Task 3.

- [ ] **Step 1: Rewrite logo.tsx with CLOUD_SHAPE, WAVE_COLORS, and getPixelColor**

Replace the entire file with:

```typescript
import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";

// 0 = empty, 1 = edge, 2 = mid, 3 = core
export const CLOUD_SHAPE: number[][] = [
  [0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 2, 3, 3, 2, 2, 2, 1, 0],
  [1, 2, 3, 3, 3, 3, 3, 2, 2, 1, 1],
  [0, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0],
];

export const WAVE_COLORS: string[] = [
  "#fff0f3",
  "#ffd6dd",
  "#ffb6c1",
  "#ffa0b4",
  "#ff8fa3",
  "#ff7890",
  "#ff6078",
  "#ff8fa3",
  "#ffa0b4",
  "#ffb6c1",
  "#ffd6dd",
];

/** Depth shading multipliers: edge=lighter, mid=full, core=darker */
const DEPTH_FACTORS: Record<number, number> = {
  1: 1.15,
  2: 1.0,
  3: 0.85,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Compute the pixel color at (row, col) given animation offset */
export function getPixelColor(
  row: number,
  col: number,
  offset: number
): string | null {
  const depth = CLOUD_SHAPE[row]?.[col];
  if (!depth || depth === 0) return null;

  const wavePos = col + row * 0.3 + offset;
  const colorCount = WAVE_COLORS.length;
  const idx = ((Math.floor(wavePos) % colorCount) + colorCount) % colorCount;
  const nextIdx = (idx + 1) % colorCount;
  const frac = wavePos - Math.floor(wavePos);

  const c1 = hexToRgb(WAVE_COLORS[idx]);
  const c2 = hexToRgb(WAVE_COLORS[nextIdx]);

  const r = c1.r + (c2.r - c1.r) * frac;
  const g = c1.g + (c2.g - c1.g) * frac;
  const b = c1.b + (c2.b - c1.b) * frac;

  const depthFactor = DEPTH_FACTORS[depth] ?? 1.0;
  return rgbToHex(r * depthFactor, g * depthFactor, b * depthFactor);
}

interface LogoProps {
  speed?: number;
}

export const Logo: React.FC<LogoProps> = ({ speed = 200 }) => {
  // Will be implemented in full in next task; placeholder for now
  return <Box flexDirection="column"></Box>;
};
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `node --test packages/cli/src/components/logo.test.ts`

Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/components/logo.tsx
git commit -m "feat: add pixel cloud data structures and getPixelColor"
```

---

### Task 3: Implement the Logo React component with animation

**Files:**
- Modify: `packages/cli/src/components/logo.tsx`

- [ ] **Step 1: Replace the Logo component with the pixel cloud renderer**

Replace only the `Logo` component in `logo.tsx`. The data structures and `getPixelColor` stay the same. Update the component to render the pixel cloud grid:

```typescript
interface LogoProps {
  speed?: number;
}

export const Logo: React.FC<LogoProps> = ({ speed = 200 }) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setOffset((prev) => prev + 1);
    }, speed);
    return () => clearInterval(id);
  }, [speed]);

  return (
    <Box flexDirection="column" justifyContent="center" alignItems="center">
      {CLOUD_SHAPE.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((depth, colIdx) => {
            if (depth === 0) {
              return (
                <Text key={colIdx}>{"  "}</Text>
            );
            }
            const color = getPixelColor(rowIdx, colIdx, offset);
            return (
              <Text key={colIdx} color={color ?? undefined}>
                {"██"}
              </Text>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};
```

Note: Empty cells render two spaces (`"  "`), filled cells render two full blocks (`"██"`). This keeps the cloud horizontally centered because every column in the grid has the same visual width (2 characters).

- [ ] **Step 2: Build and run the tests**

Run: `node --test packages/cli/src/components/logo.test.ts`

Expected: All 7 tests PASS (component changes don't affect pure function tests).

- [ ] **Step 3: Run the full CLI build**

Run: `cd packages/cli && npm run build`

Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/components/logo.tsx
git commit -m "feat: implement pixel cloud Logo component with pink wave animation"
```

---

### Task 4: Clean up and verify integration

**Files:**
- Verify: `packages/cli/src/app.tsx` (no changes needed)

- [ ] **Step 1: Verify app.tsx doesn't pass `text` prop**

Read `packages/cli/src/app.tsx` and confirm `<Logo />` is rendered without a `text` prop. Since the new `LogoProps` only has `speed?` and `text` has been removed, any `text` prop would cause a TypeScript error.

Current `app.tsx` line 70 reads `<Logo />` — no props — which is compatible.

- [ ] **Step 2: Run the full test suite**

Run: `cd packages/cli && npm test`

Expected: All tests pass.

- [ ] **Step 3: Run full monorepo tests**

Run: `npm test`

Expected: All tests pass across all packages.

- [ ] **Step 4: Commit any remaining changes (if any)**

If `app.tsx` needed no changes (expected), skip this step. If it did, commit:

```bash
git add packages/cli/src/app.tsx
git commit -m "fix: update Logo usage for pixel cloud component"
```