import React, { useMemo } from "react";
import { Text, Box } from "ink";
import { loadSettings } from "../settings.js";
import { getThemeColors } from "../theme.js";

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
  const theme = useMemo(() => {
    const settings = loadSettings();
    return getThemeColors(settings?.theme ?? "dark");
  }, []);

  const shortId = sessionId.slice(0, 8);
  return (
    <Box flexDirection="column" marginTop={2} marginLeft={2}>
      <Text>
        <Text color={theme.primary} bold>Heiyun Code</Text>
        <Text color="#999"> {"⚡"} v{version}</Text>
      </Text>
      <Text color="#888">会话: {shortId}</Text>
      <Text color="#888">模型: {model}</Text>
      <Text color="#888" wrap="truncate-end">{workdir}</Text>
    </Box>
  );
});
