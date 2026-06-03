#!/usr/bin/env node
import { Command } from "commander";
import { render } from "ink";
import React, { useState, useCallback, useRef } from "react";
import { loadConfig } from "./config.js";
import { App } from "./app.jsx";
import { Session, ToolRegistry, agentLoop, Logger } from "@heiyun/agent-core";
import { OpenAIProvider } from "@heiyun/ai";
import type { SessionNode } from "@heiyun/agent-core";

const program = new Command();

program
  .name("heiyun")
  .description("Heiyun Code — 交互式 AI 编码代理 CLI")
  .version("0.1.0")
  .option("-m, --model <name>", "模型名称")
  .option("-s, --session <id>", "恢复指定会话")
  .option("-l, --list", "列出所有历史会话")
  .option("-d, --workdir <path>", "工作目录")
  .option("--max-rounds <n>", "最大工具调用轮次", "50")
  .option("--temperature <t>", "生成温度", "0.7")
  .option("--api-base <url>", "API 地址")
  .option("--api-key <key>", "API 密钥")
  .parse();

const opts = program.opts();

// --list mode: print sessions and exit
if (opts.list) {
  const config = loadConfig(opts);
  const sessions = Session.list(config.sessionDir);
  if (sessions.length === 0) {
    console.log("没有历史会话。");
  } else {
    for (const s of sessions) {
      console.log(
        `${s.id.slice(0, 8)}  ${s.updatedAt.slice(0, 19)}  ${s.summary}`
      );
    }
  }
  process.exit(0);
}

// Interactive mode
const config = loadConfig(opts);
const provider = new OpenAIProvider({
  apiBase: config.apiBase,
  apiKey: config.apiKey,
  model: config.model,
});

// 创建日志记录器，方便排查 AI 工具调用错误
const logger = new Logger();
const toolRegistry = new ToolRegistry(logger);

let session: Session;
if (config.sessionId) {
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const sessionPath = join(config.sessionDir, `${config.sessionId}.jsonl`);
  if (existsSync(sessionPath)) {
    session = Session.load(sessionPath);
    logger.setSessionId(session.id);
    logger.info("恢复会话", { sessionId: session.id });
  } else {
    console.error(`会话 ${config.sessionId} 不存在。`);
    process.exit(1);
  }
} else {
  session = new Session(config.sessionDir);
  logger.setSessionId(session.id);
  logger.info("新建会话", { sessionId: session.id, workdir: config.workdir, model: config.model });
}

// Throttle streaming text updates to ~30fps to reduce full-tree re-renders
const STREAM_THROTTLE_MS = 33;

/** Imperative handle that ChatView exposes so TuiWrapper can push text
 *  without re-rendering the whole component tree on every token. */
export interface StreamHandle {
  append(text: string): void;
  flush(): void;
  reset(): void;
}

// Main TUI wrapper component
const TuiWrapper: React.FC = () => {
  const [currentModel, setCurrentModel] = useState(config.model);
  const [messages, setMessages] = useState<SessionNode[]>(
    [...session.getMessages()]
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Ref-based streaming: ChatView registers its imperative handle here.
  // When TuiWrapper calls streamHandleRef.current.append(text), only ChatView
  // (and its StreamingTextDisplay child) re-renders — not the whole App tree.
  const streamHandleRef = useRef<StreamHandle | null>(null);

  const handleSubmit = useCallback(
    async (input: string) => {
      setIsProcessing(true);
      streamHandleRef.current?.reset();

      try {
        await agentLoop(
          provider,
          session,
          toolRegistry,
          input,
          {
            model: currentModel,
            maxRounds: config.maxRounds,
            maxTokens: 4096,
            temperature: config.temperature,
          },
          config.workdir,
          {
            onText: (text) => {
              streamHandleRef.current?.append(text);
            },
            onToolCall: (tc) => {
              // 工具调用开始时：先刷新流式缓冲区，将文本固定到消息列表，重置流式状态
              logger.info("AI 请求调用工具", {
                tool: tc.function.name,
                argsPreview: tc.function.arguments.slice(0, 200),
              });
              streamHandleRef.current?.flush();
              streamHandleRef.current?.reset();
              setMessages([...session.getMessages()]);
            },
            onToolResult: () => {
              // 同步 messages 状态，确保工具调用结果及时显示
              streamHandleRef.current?.flush();
              setMessages([...session.getMessages()]);
            },
          },
          logger
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err);
        // 记录循环错误到日志
        logger.error("Agent loop 异常", {
          error: msg,
          sessionId: session.id,
        });
        // 将错误作为系统消息追加到会话中，确保持久可见
        streamHandleRef.current?.flush();
        session.append({
          role: "assistant",
          content: `[错误] ${msg}`,
        });
      } finally {
        streamHandleRef.current?.flush();
        streamHandleRef.current?.reset();
        setMessages([...session.getMessages()]);
        setIsProcessing(false);
      }
    },
    [currentModel, config, provider, toolRegistry]
  );

  const handleNewSession = useCallback(() => {
    session = new Session(config.sessionDir);
    logger.setSessionId(session.id);
    logger.info("新建会话", { sessionId: session.id, workdir: config.workdir });
    setMessages([]);
  }, []);

  const handleResumeSession = useCallback(
    async (id: string) => {
      const { join } = await import("node:path");
      const sessionPath = join(config.sessionDir, `${id}.jsonl`);
      session = Session.load(sessionPath);
      logger.setSessionId(session.id);
      logger.info("切换会话", { sessionId: session.id });
      setMessages([...session.getMessages()]);
    },
    []
  );

  const handleModelChange = useCallback((newModel: string) => {
    setCurrentModel(newModel);
    provider.setModel(newModel);
  }, []);

  return React.createElement(App, {
    sessionId: session.id,
    model: currentModel,
    workdir: config.workdir,
    sessionDir: config.sessionDir,
    messages,
    isProcessing,
    streamHandleRef,
    onSubmit: handleSubmit,
    onModelChange: handleModelChange,
    onNewSession: handleNewSession,
    onResumeSession: handleResumeSession,
  });
};

// Render TUI
const { waitUntilExit } = render(React.createElement(TuiWrapper));

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n正在退出，会话已保存。");
  process.exit(0);
});

await waitUntilExit;
