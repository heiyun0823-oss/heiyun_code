import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";

export const RAINBOW = [
  "#ff0000",
  "#ff8800",
  "#ffff00",
  "#00cc00",
  "#0088ff",
  "#cc44ff",
];

/** 根据字符位置和当前偏移返回对应的彩虹色 */
export function getRainbowColor(charIndex: number, offset: number): string {
  return RAINBOW[(charIndex + offset) % RAINBOW.length];
}

interface LogoProps {
  text?: string;
  speed?: number;
}

export const Logo: React.FC<LogoProps> = ({ text = "HEIYUN", speed = 200 }) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setOffset((prev) => prev + 1);
    }, speed);
    return () => clearInterval(id);
  }, [speed]);

  const chars = [...text];
  const innerWidth = 2 * text.length + 3;
  const topBorder = `╔${"═".repeat(innerWidth)}╗`;
  const bottomBorder = `╚${"═".repeat(innerWidth)}╝`;

  return (
    <Box flexDirection="column">
      <Text>{topBorder}</Text>
      <Box>
        <Text>║  </Text>
        {chars.map((ch, i) => {
          const color = getRainbowColor(i, offset);
          return (
            <Text key={i} color={color}>
              {ch}{" "}
            </Text>
          );
        })}
        <Text> ║</Text>
      </Box>
      <Text>{bottomBorder}</Text>
    </Box>
  );
};
