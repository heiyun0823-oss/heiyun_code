import React, { useState, useCallback } from "react";
import { Box, Static } from "ink";
import type { SessionNode, ContextManager } from "@heiyun/agent-core";
import { StatusBar } from "./components/status-bar.js";
import { ChatView } from "./components/chat-view.js";
import { InputBox } from "./components/input-box.js";
import { LoginPanel } from "./slash-commands/login.js";
import { ModelPanel } from "./slash-commands/model.js";
import { ResumePanel } from "./slash-commands/resume.js";
import { CompactPanel } from "./slash-commands/compact.js";
import { Logo } from "./components/logo.js";
import type { StreamHandle } from "./main.js";

type SlashMode = "chat" | "login" | "model" | "resume" | "compact";

interface AppProps {
  version: string;
  sessionId: string;
  model: string;
  workdir: string;
  sessionDir: string;
  messages: SessionNode[];
  isProcessing: boolean;
  streamHandleRef: React.MutableRefObject<StreamHandle | null>;
  contextManager: ContextManager;
  onSubmit: (input: string) => void;
  onModelChange: (newModel: string) => void;
  onNewSession: () => void;
  onResumeSession: (sessionId: string) => void;
  onShellCommand: (command: string, includeInContext: boolean) => void;
  shellMessages: SessionNode[];
}

export const App: React.FC<AppProps> = React.memo(({
  version,
  sessionId,
  model,
  workdir,
  sessionDir,
  messages,
  isProcessing,
  streamHandleRef,
  contextManager,
  onSubmit,
  onModelChange,
  onNewSession,
  onResumeSession,
  onShellCommand,
  shellMessages,
}) => {
  const [slashMode, setSlashMode] = useState<SlashMode>("chat");

  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim();

    // 拦截 !! command
    if (trimmed.startsWith("!!")) {
      const cmd = trimmed.slice(2).trim();
      if (cmd) onShellCommand(cmd, false);
      return;
    }
    // 拦截 ! command
    if (trimmed.startsWith("!")) {
      const cmd = trimmed.slice(1).trim();
      if (cmd) onShellCommand(cmd, true);
      return;
    }

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
    if (trimmed === "/compact") {
      setSlashMode("compact");
      return;
    }

    // 其他 / 开头的输入作为普通消息发送
    onSubmit(trimmed);
  }, [onSubmit, onNewSession, onResumeSession, onShellCommand]);

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
  const handleCompactClose = useCallback(() => setSlashMode("chat"), []);

  return (
    <Box flexDirection="column" padding={0}>
      {/* 头部固定区域：使用 Static 永久写入，不参与重绘 */}
      {slashMode === "chat" && (
        <Static items={[{ key: "header" }]}>
          {() => (
            <Box flexDirection="row">
              <Logo animate={false} />
              <StatusBar version={version} sessionId={sessionId} model={model} workdir={workdir} />
            </Box>
          )}
        </Static>
      )}


      {slashMode === "chat" && (
        <Box flexDirection="column">
          <ChatView key={sessionId} messages={messages} streamHandleRef={streamHandleRef} shellMessages={shellMessages} />
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

      {slashMode === "compact" && (
        <CompactPanel
          contextManager={contextManager}
          onClose={handleCompactClose}
        />
      )}
    </Box>
  );
});
