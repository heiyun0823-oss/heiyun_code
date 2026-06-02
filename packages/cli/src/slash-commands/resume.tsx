import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { SessionMeta } from "@heiyun/agent-core";
import { Session } from "@heiyun/agent-core";

interface ResumePanelProps {
  sessionDir: string;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
}

export const ResumePanel: React.FC<ResumePanelProps> = ({
  sessionDir,
  onClose,
  onSelect,
}) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const list = Session.list(sessionDir);
    setSessions(
      list.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    );
    setLoading(false);
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (sessions.length === 0) return;
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, sessions.length - 1));
    }
    if (key.return) {
      onSelect(sessions[selectedIndex].id);
    }
  });

  if (loading) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="#0f3460"
        padding={1}
      >
        <Text color="#50c878">加载历史会话...</Text>
      </Box>
    );
  }

  if (sessions.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="#0f3460"
        padding={1}
      >
        <Text color="#555">没有历史会话。</Text>
        <Text color="#555">按 Esc 返回</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="#0f3460"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text bold color="#50c878">
          选择要恢复的会话:
        </Text>
      </Box>
      {sessions.map((s, i) => (
        <Box key={s.id}>
          <Text color={i === selectedIndex ? "#50c878" : "#888"}>
            {i === selectedIndex ? "▸ " : "  "}
            {s.id.slice(0, 8)}
          </Text>
          <Text color="#555">
            {" "}
            {s.updatedAt.slice(0, 19).replace("T", " ")}
          </Text>
          <Text> {s.summary}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="#555">↑↓ 选择  Enter 确认  Esc 返回</Text>
      </Box>
    </Box>
  );
};
