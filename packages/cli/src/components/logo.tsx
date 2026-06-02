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

  const chars = text.split("");
  const innerWidth = text.length + 4;
  const topBorder = `╔${"═".repeat(innerWidth)}╗`;
  const bottomBorder = `╚${"═".repeat(innerWidth)}╝`;

  return (
    <Box flexDirection="column">
      <Text>{topBorder}</Text>
      <Box>
        <Text>║  </Text>
        {chars.map((ch, i) => {
          const colorIndex = (i + offset) % RAINBOW.length;
          return (
            <Text key={i} color={RAINBOW[colorIndex]}>
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
