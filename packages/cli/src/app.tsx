import React, { useState, useCallback } from "react";
import { Box } from "ink";
import type { SessionNode } from "@heiyun/agent-core";
import { StatusBar } from "./components/status-bar.js";
import { ChatView } from "./components/chat-view.js";
import { InputBox } from "./components/input-box.js";
import { LoginPanel } from "./slash-commands/login.js";
import { ModelPanel } from "./slash-commands/model.js";
import { ResumePanel } from "./slash-commands/resume.js";
import { Logo } from "./components/logo.js";
import type { StreamHandle } from "./main.js";

type SlashMode = "chat" | "login" | "model" | "resume";

interface AppProps {
  sessionId: string;
  model: string;
  workdir: string;
  sessionDir: string;
  messages: SessionNode[];
  isProcessing: boolean;
  streamHandleRef: React.MutableRefObject<StreamHandle | null>;
  onSubmit: (input: string) => void;
  onModelChange: (newModel: string) => void;
  onNewSession: () => void;
  onResumeSession: (sessionId: string) => void;
}

export const App: React.FC<AppProps> = React.memo(({
  sessionId,
  model,
  workdir,
  sessionDir,
  messages,
  isProcessing,
  streamHandleRef,
  onSubmit,
  onModelChange,
  onNewSession,
  onResumeSession,
}) => {
  const [slashMode, setSlashMode] = useState<SlashMode>("chat");

  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim();

    // 拦截 /command
    if (trimmed === "/login") {
      setSlashMode("login");
      return;
    }
    if (trimmed === "/model") {
      setSlashMode("model");
      return;
    }
    if (trimmed === "/new") {
      onNewSession();
      return;
    }
    if (trimmed === "/resume") {
      setSlashMode("resume");
      return;
    }

    // 其他 / 开头的输入作为普通消息发送
    onSubmit(trimmed);
  }, [onSubmit, onNewSession, onResumeSession]);

  const handleModelClose = useCallback((newModel?: string) => {
    if (newModel) {
      onModelChange(newModel);
    }
    setSlashMode("chat");
  }, [onModelChange]);

  const handleResumeSelect = useCallback((sessionId: string) => {
    onResumeSession(sessionId);
    setSlashMode("chat");
  }, [onResumeSession]);

  const handleLoginClose = useCallback(() => setSlashMode("chat"), []);
  const handleResumeClose = useCallback(() => setSlashMode("chat"), []);

  return (
    <Box flexDirection="column" padding={0}>
      <Box flexDirection="row">
        <Logo animate={isProcessing} />
        <StatusBar sessionId={sessionId} model={model} workdir={workdir} />
      </Box>


      {slashMode === "chat" && (
        <Box flexDirection="column">
          <ChatView key={sessionId} messages={messages} streamHandleRef={streamHandleRef} />
          <InputBox onSubmit={handleSubmit} disabled={isProcessing} />
        </Box>
      )}

      {slashMode === "login" && (
        <LoginPanel onClose={handleLoginClose} />
      )}

      {slashMode === "model" && (
        <ModelPanel onClose={handleModelClose} />
      )}

      {slashMode === "resume" && (
        <ResumePanel
          sessionDir={sessionDir}
          onClose={handleResumeClose}
          onSelect={handleResumeSelect}
        />
      )}
    </Box>
  );
});
