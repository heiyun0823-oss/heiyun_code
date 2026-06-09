import React, { useState, useEffect, useMemo } from "react";
import { Text, Box } from "ink";
import { loadSettings } from "../settings.js";
import { getThemeColors, DEFAULT_THEME } from "../theme.js";

// ============================================================================
// 像素网格 (21×13): 0=空 1=淡墨 2=中墨 3=浓墨 4=血墨
// ============================================================================
export const CLOUD_SHAPE: number[][] = [
  [0,0,0,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0,0,0,0],  // Row 0: 剑锋
  [0,0,0,0,0,0,0,0,0,1, 1, 1,0,0,0,0,0,0,0,0,0],  // Row 1: 剑脊
  [0,0,0,0,0,0,0,0,1,1, 2, 1, 1,0,0,0,0,0,0,0,0],  // Row 2
  [0,0,0,0,0,0,0,1,1,2, 3, 2, 1, 1,0,0,0,0,0,0,0],  // Row 3
  [0,0,0,0,0,0,1,1,2,3, 2, 3, 2, 1, 1,0,0,0,0,0,0],  // Row 4
  [0,0,0,0,0,1,1,2,3,2, 2, 2, 3, 2, 1, 1,0,0,0,0,0],  // Row 5: 云身过渡
  [0,0,0,0,1,1,2,3,2,4, 2, 4, 2, 3, 2, 1, 1,0,0,0,0],  // Row 6: 血瞳双眼
  [0,0,0,0,1,2,3,2,2,1, 0, 1, 2, 2, 3, 2, 1,0,0,0,0],  // Row 7: 鼻梁中轴
  [0,0,0,0,1,2,3,2,4,2, 3, 2, 4, 2, 3, 2, 1,0,0,0,0],  // Row 8: 双颊血痕
  [0,0,0,0,1,2,3,3,2,3, 3, 3, 2, 3, 3, 2, 1,0,0,0,0],  // Row 9: 云身主体
  [0,0,0,0,0,1,2,3,3,3, 3, 3, 3, 3, 2, 1,0,0,0,0,0],  // Row 10: 云身最宽
  [0,0,0,0,0,0,1,2,2,2, 3, 2, 2, 2, 1,0,0,0,0,0,0],  // Row 11: 云气收拢
  [0,0,0,0,0,0,0,1,1,1, 2, 1, 1, 1,0,0,0,0,0,0,0],  // Row 12: 底部云气
];

// ============================================================================
// 配色方案
// ============================================================================

/** 水墨灰阶（静态，depth 1-3） */
export const INK_COLORS: Record<number, string> = {
  1: "#555555",  // 淡墨边缘
  2: "#777777",  // 中墨云影
  3: "#999999",  // 浓墨核心
};

/** 暗红血墨 — 呼吸动画三段 */
export const CRIMSON_DARK = "#7f1d1d";  // 呼吸暗部
export const CRIMSON_BASE = "#c0392b";  // 静态基准色
export const CRIMSON_PEAK = "#e74c3c";  // 呼吸亮部峰值

// ============================================================================
// 颜色工具（纯函数）
// ============================================================================

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 对两个 hex 颜色做 RGB 通道线性插值 */
function lerpColor(a: string, b: string, t: number): string {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

/** 计算 depth=4 像素在给定呼吸相位下的暗红颜色 */
function crimsonColor(breathPhase: number, baseColor?: string): string {
  const base = baseColor ?? CRIMSON_BASE;
  if (breathPhase > 0.85) {
    // 呼吸顶点：短暂高亮
    return lerpColor(base, CRIMSON_PEAK, (breathPhase - 0.85) / 0.15);
  }
  // 正常呼吸：暗部 ↔ 基准
  return lerpColor(CRIMSON_DARK, base, breathPhase / 0.85);
}

// ============================================================================
// 公开纯函数
// ============================================================================

/**
 * 计算像素 (row, col) 在给定呼吸相位下的颜色。
 * @returns hex 颜色字符串，或 null（空像素/越界）
 */
export function getPixelColor(
  row: number,
  col: number,
  breathPhase: number,
  primaryColor?: string
): string | null {
  const depth = CLOUD_SHAPE[row]?.[col];
  if (depth === undefined || depth === 0) return null;

  if (depth === 4) return crimsonColor(breathPhase, primaryColor);

  return INK_COLORS[depth] ?? null;
}

// ============================================================================
// React 组件
// ============================================================================

interface LogoProps {
  speed?: number;   // 动画帧间隔 ms，默认 200
  animate?: boolean; // 是否启用动画，默认 true
}

export const Logo = React.memo<LogoProps>(({ speed = 200, animate = true }) => {
  const [elapsed, setElapsed] = useState(0);

  const primaryColor = useMemo(() => {
    const settings = loadSettings();
    return getThemeColors(settings?.theme ?? DEFAULT_THEME).primary;
  }, []);

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => {
      setElapsed((prev) => prev + speed);
    }, speed);
    return () => clearInterval(id);
  }, [speed, animate]);

  const breathPhase = (Math.sin(elapsed / 320) + 1) / 2; // [0, 1] 周期 ~2s

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
            const color = getPixelColor(rowIdx, colIdx, breathPhase, primaryColor);
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
