import React from "react";
import { Box } from "ink";
import type { SessionNode } from "@heiyun/agent-core";
import { StatusBar } from "./components/status-bar.js";
import { ChatView } from "./components/chat-view.js";
import { InputBox } from "./components/input-box.js";

interface AppProps {
  sessionId: string;
  model: string;
  workdir: string;
  messages: SessionNode[];
  streamingText: string;
  isProcessing: boolean;
  onSubmit: (input: string) => void;
}

export const App: React.FC<AppProps> = ({
  sessionId,
  model,
  workdir,
  messages,
  streamingText,
  isProcessing,
  onSubmit,
}) => {
  return (
    <Box flexDirection="column" padding={0}>
      <StatusBar sessionId={sessionId} model={model} workdir={workdir} />
      <ChatView messages={messages} streamingText={streamingText} />
      <InputBox onSubmit={onSubmit} disabled={isProcessing} />
    </Box>
  );
};
