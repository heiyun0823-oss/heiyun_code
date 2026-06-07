import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Text, Box, Static } from "ink";
import type { SessionNode } from "@heiyun/agent-core";
import type { StreamHandle } from "../main.js";

// ── streaming throttle ──────────────────────────────────────────────
const STREAM_THROTTLE_MS = 33;

interface ChatViewProps {
  messages: SessionNode[];
  streamHandleRef: React.MutableRefObject<StreamHandle | null>;
  shellMessages?: SessionNode[];
}

/**
 * Render a single message. Extracted as a standalone function so it can be
 * used both by the Static (completed messages) and interactive (streaming) paths.
 */
/**
 * Render a single message. Extracted as a standalone function so it can be
 * used by the Static component. Keys are omitted — Static manages its own
 * element tracking and React keys would interfere with the static content system.
 */
function renderMessage(m: SessionNode, _index: number): React.ReactElement | null {
  if (m.role === "user") {
    return (
      <Box marginY={1}>
        <Text>
          <Text color="#f0c040">🧑 你: </Text>
          <Text>{m.content}</Text>
        </Text>
      </Box>
    );
  }

  if (m.role === "assistant") {
    const hasToolCalls = m.tool_calls && m.tool_calls.length > 0;
    return (
      <Box flexDirection="column" marginY={1}>
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

if (m.role === "shell") {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text>
          <Text color="#ccc">$ {m.name ?? "命令"}</Text>
        </Text>
        <Text color="#aaa">{m.content}</Text>
      </Box>
    );
  }

if (m.role === "summary") {
    return (
      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="single"
        borderColor="#555"
        paddingX={1}
      >
        <Box paddingX={1}>
          <Text color="#888" italic>
            🔒 自动压缩 — 上下文摘要
          </Text>
        </Box>
        <Box paddingX={1} marginTop={1}>
          <Text color="#666" italic>
            {m.content
              ? m.content.length > 500
                ? m.content.slice(0, 500) + "..."
                : m.content
              : "(摘要为空)"}
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
}

const ChatViewInner: React.FC<ChatViewProps> = ({
  messages,
  streamHandleRef,
  shellMessages = [],
}) => {
  // ── streaming state lives HERE (not in TuiWrapper) ────────────────
  // Only this component re-renders on text updates — App stays still.
  const [streamingText, setStreamingText] = useState("");
  const streamBufferRef = useRef("");
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // flush: move buffered tokens into React state immediately
  const flush = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    const buffered = streamBufferRef.current;
    if (buffered) {
      streamBufferRef.current = "";
      setStreamingText((prev) => prev + buffered);
    }
  }, []);

  // append: buffer tokens, schedule a throttled flush
  const append = useCallback(
    (text: string) => {
      streamBufferRef.current += text;
      if (!streamTimerRef.current) {
        streamTimerRef.current = setTimeout(flush, STREAM_THROTTLE_MS);
      }
    },
    [flush]
  );

  // reset: clear everything (called before a new message / after tool call)
  const reset = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    streamBufferRef.current = "";
    setStreamingText("");
  }, []);

  // Register the imperative handle so TuiWrapper can push text
  // without causing a full-tree re-render.
  useEffect(() => {
    streamHandleRef.current = { append, flush, reset };
    return () => {
      streamHandleRef.current = null;
    };
  }, [append, flush, reset, streamHandleRef]);

  // ── Separate non-system messages for Static rendering ────────────
  // Completed messages go to <Static> so they are written once and never
  // erased/redrawn — only the interactive area (streaming text + input)
  // participates in the normal render cycle, eliminating flicker.
  const chatMessages = useMemo(
    () => [
      ...messages.filter((m) => m.role !== "system"),
      ...shellMessages,
    ],
    [messages, shellMessages]
  );

  // ── streaming text (interactive, not static) ─────────────────────
  // Split by newlines so completed lines stay still and only the last
  // in-progress line updates each throttle tick.
  const streamingEl = (() => {
    if (!streamingText) return null;
    const lines = streamingText.split("\n");
    if (lines.length === 1) {
      return (
        <Text>
          <Text color="#50c878">🤖 AI: </Text>
          <Text>{lines[0]}</Text>
        </Text>
      );
    }
    return (
      <Box flexDirection="column">
        <Text>
          <Text color="#50c878">🤖 AI: </Text>
          <Text>{lines[0]}</Text>
        </Text>
        {lines.slice(1, -1).map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
        <Text>{lines[lines.length - 1]}</Text>
      </Box>
    );
  })();

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Completed messages: rendered via <Static> so they persist
          outside the interactive render cycle — typing or streaming
          text updates will no longer erase and redraw them. */}
      <Static items={chatMessages}>{renderMessage}</Static>
      {streamingEl}
    </Box>
  );
};

export const ChatView = React.memo<ChatViewProps>(ChatViewInner);
