# Pixel Cloud Logo Design

## Overview

Replace the existing rainbow text Logo with a soft pixel cloud pattern, positioned above the StatusBar. The cloud uses a flowing pink color wave animation that moves left to right across the pixel grid.

## Cloud Pattern

Adopt **Option A: Compact Rounded Cloud** — classic 3-dome + flat-bottom shape on an 11×6 pixel grid:

```
Row 0:      . . . . █ █ █ . . . .     (top dome)
Row 1:      . . █ █ █ █ █ █ . . .     (dome expansion)
Row 2:      . █ █ █ █ █ █ █ █ █ .     (middle body)
Row 3:      █ █ █ █ █ █ █ █ █ █ █     (base, widest)
Row 4:      . █ █ █ █ █ █ █ █ █ .     (lower taper)
Row 5:      . . . █ █ █ █ . . . .     (bottom)
```

### Depth Map

Each pixel has a depth value (1=edge, 2=mid, 3=core) used for shading:

```typescript
// 0 = empty, 1 = edge, 2 = mid, 3 = core
const CLOUD_SHAPE: number[][] = [
  [0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 2, 3, 3, 2, 2, 2, 1, 0],
  [1, 2, 3, 3, 3, 3, 3, 2, 2, 1, 1],
  [0, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0],
];
```

## Pink Palette & Animation

### Color Wave Sequence

11-step pink gradient cycling from lightest to deepest and back:

```typescript
const WAVE_COLORS: string[] = [
  '#fff0f3',  // very light pink
  '#ffd6dd',  // light pink
  '#ffb6c1',  // medium pink (LightPink)
  '#ffa0b4',  // warm pink
  '#ff8fa3',  // rosy pink
  '#ff7890',  // deeper rose
  '#ff6078',  // deep pink highlight
  '#ff8fa3',  // rosy pink
  '#ffa0b4',  // warm pink
  '#ffb6c1',  // medium pink
  '#ffd6dd',  // light pink
];
```

### Animation Logic

- **Wave position** for each pixel: `wavePos = column + row * 0.3 + offset`
- **Color interpolation**: smooth blend between adjacent wave colors using fractional offset
- **Depth shading**: core pixels darkened (×0.85), mid pixels at full (×1.0), edge pixels lightened (×1.15)
- **Speed**: offset increments per tick (200ms interval, matching existing Logo)

### Pure Function (for testing)

```typescript
export function getPixelColor(
  row: number,
  col: number,
  offset: number
): string | null {
  // Returns the computed hex color for a pixel at (row, col) given animation offset
  // Returns null for empty pixels (CLOUD_SHAPE[row][col] === 0)
}
```

## Component Interface

```typescript
interface LogoProps {
  speed?: number;  // Color update interval in ms, default 200
}
```

The `text` prop is removed — the Logo no longer renders text, only the pixel cloud pattern.

## Layout Position

In `app.tsx`, `<Logo />` remains placed above `<StatusBar />` — no layout changes needed. The Logo component centers the cloud pattern horizontally within the terminal width.

## Ink Rendering Strategy

Each "pixel" in the cloud is rendered as a full-width block character `█` using Ink's `<Text>` component:

- Each `<Text>` element gets a computed `color` from `getPixelColor()`
- Pixels are laid out in rows using `<Box flexDirection="column">`
- Within each row, pixels and empty cells use spaces vs `█` characters
- The entire cloud is wrapped in `<Box justifyContent="center">` for horizontal centering

## File Changes

| File | Change |
|------|--------|
| `packages/cli/src/components/logo.tsx` | Rewrite: remove text+border rendering, replace with pixel grid cloud + pink wave animation. Export `CLOUD_SHAPE`, `WAVE_COLORS`, `getPixelColor`. |
| `packages/cli/src/components/logo.test.ts` | Update: test `CLOUD_SHAPE` dimensions, `WAVE_COLORS` length, and `getPixelColor` pure function behavior (returns null for empty, correct colors for given offsets). |
| `packages/cli/src/app.tsx` | No changes needed (already renders `<Logo />`). |

## Design Decisions

1. **Visual-only change, no layout change** — Logo stays above StatusBar
2. **Ink-native rendering** — uses `<Box>` + `█` text blocks, no external dependencies
3. **Same animation mechanism** — `useState` + `setInterval`, consistent with existing Logo
4. **Export pure functions for testing** — following the existing `getRainbowColor` pattern, export `getPixelColor` for unit testing
5. **Remove `text` prop** — the cloud pattern has no text component; only `speed` remains
6. **Pink color scheme** — aligned with user preference for 浅粉色 (light pink) throughout