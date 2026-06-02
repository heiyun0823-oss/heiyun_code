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
  animate?: boolean;
}

export const Logo = React.memo<LogoProps>(({ speed = 200, animate = true }) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => {
      setOffset((prev) => prev + 1);
    }, speed);
    return () => clearInterval(id);
  }, [speed, animate]);

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
});