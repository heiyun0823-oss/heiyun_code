import React from "react";
import { Text, Box } from "ink";

interface StatusBarProps {
  sessionId: string;
  model: string;
  workdir: string;
}

export const StatusBar = React.memo<StatusBarProps>(({
  sessionId,
  model,
  workdir,
}) => {
  const shortId = sessionId.slice(0, 8);
  return (
    <Box marginTop={2}>
      <Text color="#888" wrap="truncate-end">会话: {shortId} | 模型: {model} | {workdir}</Text>
    </Box>
  );
});
