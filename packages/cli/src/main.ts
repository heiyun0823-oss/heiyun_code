#!/usr/bin/env node
import { Command } from "commander";
import { render } from "ink";
import React, { useState, useCallback } from "react";
import { loadConfig } from "./config.js";
import { App } from "./app.jsx";
import { Session, ToolRegistry, agentLoop } from "@heiyun/agent-core";
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

const toolRegistry = new ToolRegistry();

let session: Session;
if (config.sessionId) {
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const sessionPath = join(config.sessionDir, `${config.sessionId}.jsonl`);
  if (existsSync(sessionPath)) {
    session = Session.load(sessionPath);
  } else {
    console.error(`会话 ${config.sessionId} 不存在。`);
    process.exit(1);
  }
} else {
  session = new Session(config.sessionDir);
}

// Main TUI wrapper component
const TuiWrapper: React.FC = () => {
  const [currentModel, setCurrentModel] = useState(config.model);
  const [messages, setMessages] = useState<SessionNode[]>(
    [...session.getMessages()]
  );
  const [streamingText, setStreamingText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = useCallback(
    async (input: string) => {
      setIsProcessing(true);
      setStreamingText("");

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
              setStreamingText((prev) => prev + text);
            },
            onToolCall: () => {
              // 同步 messages 状态，确保工具调用信息及时显示
              setMessages([...session.getMessages()]);
            },
            onToolResult: () => {
              // 同步 messages 状态，确保工具调用结果及时显示
              setMessages([...session.getMessages()]);
            },
          }
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err);
        setStreamingText(`\n[错误] ${msg}`);
      } finally {
        setMessages([...session.getMessages()]);
        setStreamingText("");
        setIsProcessing(false);
      }
    },
    [currentModel, config, provider, toolRegistry]
  );

  const handleNewSession = useCallback(() => {
    session = new Session(config.sessionDir);
    setMessages([]);
  }, []);

  const handleResumeSession = useCallback(
    async (id: string) => {
      const { join } = await import("node:path");
      const sessionPath = join(config.sessionDir, `${id}.jsonl`);
      session = Session.load(sessionPath);
      setMessages([...session.getMessages()]);
    },
    []
  );

  return React.createElement(App, {
    sessionId: session.id,
    model: currentModel,
    workdir: config.workdir,
    sessionDir: config.sessionDir,
    messages,
    streamingText,
    isProcessing,
    onSubmit: handleSubmit,
    onModelChange: (newModel: string) => {
      setCurrentModel(newModel);
      provider.setModel(newModel);
    },
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
