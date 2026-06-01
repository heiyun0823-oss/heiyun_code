import React from "react";
import { Text } from "ink";

interface StatusBarProps {
  sessionId: string;
  model: string;
  workdir: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  sessionId,
  model,
  workdir,
}) => {
  const shortId = sessionId.slice(0, 8);
  return (
    <Text backgroundColor="#16213e" color="#e0e0e0">
      <Text color="#e94560">⚡ Heiyun Code v0.1.0</Text>
      <Text color="#888">  会话: {shortId} | 模型: {model} | {workdir}</Text>
    </Text>
  );
};
