import React, { useMemo } from "react";
import { Text, Box } from "ink";
import type { SessionNode } from "@heiyun/agent-core";

interface ChatViewProps {
  messages: SessionNode[];
  streamingText: string;
}

const ChatViewInner: React.FC<ChatViewProps> = ({
  messages,
  streamingText,
}) => {
  // Memoize filtered messages and JSON parsing to avoid recomputation on every render
  const renderedMessages = useMemo(() => {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        if (m.role === "user") {
          return (
            <Box key={m.id} marginY={1}>
              <Text>
                <Text color="#f0c040">🧑 你: </Text>
                <Text>{m.content}</Text>
              </Text>
            </Box>
          );
        }

        if (m.role === "assistant") {
          const hasToolCalls =
            m.tool_calls && m.tool_calls.length > 0;
          return (
            <Box key={m.id} flexDirection="column" marginY={1}>
              {m.content && (
                <Text>
                  <Text color="#50c878">🤖 AI: </Text>
                  <Text>{m.content}</Text>
                </Text>
              )}
              {hasToolCalls &&
                m.tool_calls!.map((tc) => (
                  <Box
                    key={tc.id}
                    flexDirection="column"
                    marginY={1}
                    borderStyle="single"
                    borderColor="#333"
                    paddingX={1}
                  >
                    <Text backgroundColor="#1a3a5c" color="#4fc3f7">
                      🔧 {tc.function.name}
                    </Text>
                  </Box>
                ))}
            </Box>
          );
        }

        if (m.role === "tool") {
          let parsed:
            | { success?: boolean; output?: string; error?: string }
            | null = null;
          try {
            parsed = JSON.parse(m.content ?? "{}");
          } catch {
            // display raw
          }
          return (
            <Box
              key={m.id}
              flexDirection="column"
              marginY={1}
              borderStyle="single"
              borderColor="#333"
              paddingX={1}
            >
              <Box backgroundColor="#1a3a5c" paddingX={1}>
                <Text color="#4fc3f7">🔧 工具结果</Text>
              </Box>
              {parsed && (
                <Box flexDirection="column" paddingX={1}>
                  {parsed.output ? (
                    <Text color="#ccc">{parsed.output}</Text>
                  ) : null}
                  {parsed.error ? (
                    <Text color="#e57373">错误: {parsed.error}</Text>
                  ) : null}
                  <Text
                    backgroundColor={
                      parsed.success ? "#0a2a0a" : "#2a0a0a"
                    }
                    color={parsed.success ? "#4caf50" : "#e57373"}
                  >
                    {parsed.success ? "✓ 成功" : "✗ 失败"}
                  </Text>
                </Box>
              )}
              {!parsed && <Text color="#ccc">{m.content}</Text>}
            </Box>
          );
        }

        return null;
      });
  }, [messages]);

  return (
    <Box flexDirection="column" marginY={1}>
      {renderedMessages}
      {streamingText && (
        <Text>
          <Text color="#50c878">🤖 AI: </Text>
          <Text>{streamingText}</Text>
        </Text>
      )}
    </Box>
  );
};

export const ChatView = React.memo<ChatViewProps>(ChatViewInner);