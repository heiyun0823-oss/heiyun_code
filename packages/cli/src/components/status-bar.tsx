import React from "react";
import { Text, Box } from "ink";

interface StatusBarProps {
  version: string;
  sessionId: string;
  model: string;
  workdir: string;
}

export const StatusBar = React.memo<StatusBarProps>(({
  version,
  sessionId,
  model,
  workdir,
}) => {
  const shortId = sessionId.slice(0, 8);
  return (
    <Box flexDirection="column" marginTop={2} marginLeft={2}>
      <Text>
        <Text color="#c0392b" bold>Heiyun Code</Text>
        <Text color="#999"> {"⚡"} v{version}</Text>
      </Text>
      <Text color="#888">会话: {shortId}</Text>
      <Text color="#888">模型: {model}</Text>
      <Text color="#888" wrap="truncate-end">{workdir}</Text>
    </Box>
  );
});
