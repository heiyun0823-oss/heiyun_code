import React from "react";
import { Text, Box } from "ink";

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
    <Box>
      <Text bold color="#e94560" wrap="truncate-end">⚡ Heiyun Code v0.1.0</Text>
      <Text color="#888" wrap="truncate-end">  会话: {shortId} | 模型: {model} | {workdir}</Text>
    </Box>
  );
};
