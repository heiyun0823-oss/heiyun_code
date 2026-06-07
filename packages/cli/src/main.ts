#!/usr/bin/env node
/**
 * @heiyun/cli — main.ts
 * =====================
 * CLI 的入口文件。负责：
 *   1. 解析命令行参数（使用 commander 库）
 *   2. 加载配置
 *   3. 初始化 Provider、Session、ToolRegistry、ContextManager、Logger
 *   4. 启动 TUI（终端用户界面，使用 ink + React）
 *   5. 处理用户输入，调用 agentLoop 循环
 *
 * Commander 是什么？
 *   Commander 是一个命令行参数解析库。它可以定义选项（--model, --help），
 *   自动生成帮助信息，解析用户输入的命令行参数。
 *   program.option("-m, --model <name>", "模型名称") 的意思是：
 *   -m 或 --model 选项，接受一个 <name> 值，说明是"模型名称"。
 *
 * Ink 是什么？
 *   Ink 是一个用 React 组件渲染终端 UI 的库。
 *   你在终端里看到的输入框、消息气泡、状态栏，都是用 React 组件写的。
 *   render() 函数把 React 组件渲染到终端（类似 ReactDOM.render 渲染到浏览器）。
 */

// Shebang：告诉系统用 node 来运行这个文件（必须放在文件第一行）

import { Command } from "commander";
import { render } from "ink";
import React, { useState, useCallback, useRef } from "react";
import { loadConfig } from "./config.js";
import { App } from "./app.js";
import { Session, ToolRegistry, agentLoop, Logger, ContextManager, TokenCounter } from "@heiyun/agent-core";
import { OpenAIProvider } from "@heiyun/ai";
import type { SessionNode, ContextManagerConfig } from "@heiyun/agent-core";
import { version } from "../package.json";

// === 命令行参数定义 ===

// 创建 Commander 程序实例
const program = new Command();

// 定义命令行选项（链式调用）
program
  .name("heiyun")                                              // 程序名（显示在帮助信息中）
  .description("Heiyun Code — 交互式 AI 编码代理 CLI")         // 描述
  .version(version)                                             // 版本号
  .option("-m, --model <name>", "模型名称")                    // -m 或 --model
  .option("-s, --session <id>", "恢复指定会话")                // -s 或 --session
  .option("-l, --list", "列出所有历史会话")                      // -l 或 --list（布尔标志）
  .option("-d, --workdir <path>", "工作目录")                  // -d 或 --workdir
  .option("--max-rounds <n>", "最大工具调用轮次", "50")         // 默认值 50
  .option("--temperature <t>", "生成温度", "0.7")              // 默认值 0.7
  .option("--api-base <url>", "API 地址")                      // 自定义 API 地址
  .option("--api-key <key>", "API 密钥")                       // 自定义 API 密钥
  .parse();                                                     // 解析命令行参数

// program.opts() 返回解析后的选项对象
const opts = program.opts();

// === --list 模式：列出历史会话 ===
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

// === 交互模式：正常启动 TUI ===

// 1. 加载配置（合并 settings.json + CLI 参数 + 环境变量 + 默认值）
const config = loadConfig(opts);

// 2. 创建 Provider（LLM API 通信层）
const provider = new OpenAIProvider({
  apiBase: config.apiBase,
  apiKey: config.apiKey,
  model: config.model,
});

// 3. 创建日志记录器（用于调试和问题排查）
const logger = new Logger();

// 4. 创建工具注册表（自动注册 read/write/edit/bash 四个内置工具）
const toolRegistry = new ToolRegistry(logger);

// === 创建或恢复会话 ===
// let session 声明一个可变变量（后续可能会被重新赋值）
let session: Session;

if (config.sessionId) {
  // 用户指定了 --session 参数，尝试恢复已有会话
  // 动态 import（await import）只在需要时才加载模块
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const sessionPath = join(config.sessionDir, `${config.sessionId}.jsonl`);

  if (existsSync(sessionPath)) {
    // 会话文件存在，加载恢复
    session = Session.load(sessionPath);
    logger.setSessionId(session.id);
    logger.info("恢复会话", { sessionId: session.id });
  } else {
    // 指定的会话不存在，退出程序（exit code 1 = 异常退出）
    console.error(`会话 ${config.sessionId} 不存在。`);
    process.exit(1);
  }
} else {
  // 未指定 --session，创建新会话
  session = new Session(config.sessionDir);
  logger.setSessionId(session.id);
  logger.info("新建会话", { sessionId: session.id, workdir: config.workdir, model: config.model });
}

// === ContextManager（上下文管理器）初始化 ===
// 用于防止对话历史超出 LLM 的上下文窗口限制
const tokenCounter = new TokenCounter(config.model);

// 从环境变量读取上下文窗口大小，默认为 128000（DeepSeek-V3 的窗口大小）
const contextWindowSize = parseInt(
  process.env.HEIYUN_CODE_CONTEXT_WINDOW ?? "128000",
  10
);

const ctxConfig: ContextManagerConfig = {
  maxContextTokens: contextWindowSize,   // 128K tokens 总预算
  windowRatio: 0.6,                       // 60% 用于滑动窗口
  compressThresholdRatio: 0.9,            // 90% 时触发压缩
  reserveOutputTokens: 4096,              // 预留 4K 给 AI 回复
  systemPromptTokens: 500,                // 系统提示词约占用 500 tokens
};

const contextManager = new ContextManager(ctxConfig, tokenCounter, provider);

// === 流式输出节流 ===
// 限制 UI 更新频率到约 30 帧/秒（1000ms / 33ms ≈ 30fps）
// 避免每个 token 都触发整个 React 组件树重新渲染
const STREAM_THROTTLE_MS = 33;

/**
 * StreamHandle 接口
 * ChatView 组件通过这个接口暴露给 TuiWrapper，
 * 使得 TuiWrapper 能高效地推送流式文本，而不需要整体重新渲染。
 *
 * 这是"命令式"（imperative）而非"声明式"（declarative）的接口：
 *   声明式：<Component text={state} />  → 通过 props 传递
 *   命令式：handle.append("text")       → 直接调用方法
 * 命令式的好处：避免大量 props 更新导致的 React 重渲染。
 */
export interface StreamHandle {
  append(text: string): void;  // 追加一段文本（会节流累积后批量更新）
  flush(): void;               // 立即刷新缓冲区中的所有文本
  reset(): void;               // 重置缓冲区（新一轮开始时调用）
}

// === TuiWrapper 组件 ===
// 这是整个 TUI 的"根组件"。React.FC 表示"函数组件"（Functional Component）。
// 它管理全局状态，并通过 App 组件将状态和方法传递给子组件。
const TuiWrapper: React.FC = () => {
  // === React 状态（useState） ===
  // useState 返回 [当前值, 更新函数]，React 会在状态变化时自动重新渲染
  const [currentModel, setCurrentModel] = useState(config.model);        // 当前模型名
  const [messages, setMessages] = useState<SessionNode[]>(               // 消息列表
    [...session.getMessages()]   // ...展开运算符：创建数组副本，避免直接修改
  );
  const [isProcessing, setIsProcessing] = useState(false);              // 是否正在处理中
  const [compactStatus, setCompactStatus] = useState<string | null>(null); // 压缩状态文本

  // 将 session 暴露到全局对象（globalThis），供 CompactPanel 等面板组件访问
  // globalThis 是 ES2020 新增的全局对象（浏览器中是 window，Node 中是 global）
  (globalThis as any).__heiyunSession = session;

  // === useRef：跨渲染保持引用的可变容器 ===
  // useRef 创建一个"引用对象"，其 .current 属性可以存储任意值。
  // 和 useState 的区别：修改 .current 不会触发重新渲染。
  // 这里用来存储 ChatView 注册的 StreamHandle，实现高效的流式文本更新。
  const streamHandleRef = useRef<StreamHandle | null>(null);

  // === useCallback：缓存函数，避免不必要的子组件重渲染 ===
  // 依赖数组 [currentModel, config, provider, toolRegistry] 中的值变化时，
  // 函数才会重新创建。否则复用缓存的旧函数。
  const handleSubmit = useCallback(
    /**
     * handleSubmit：用户提交输入后的处理函数
     * 调用 agentLoop 启动 AI 处理流程，并通过回调更新 UI
     */
    async (input: string) => {
      // 进入处理状态
      setIsProcessing(true);
      // 重置流式文本缓冲区
      streamHandleRef.current?.reset();

      try {
        // 调用核心的 agentLoop 循环
        await agentLoop(
          provider,
          session,
          toolRegistry,
          input,
          {
            model: currentModel,               // 当前使用的模型
            maxRounds: config.maxRounds,       // 最大循环轮次
            maxTokens: 4096,                   // 单次回复最多 4096 tokens
            temperature: config.temperature,   // 生成温度
          },
          config.workdir,
          {
            // === 回调：实时更新 UI ===

            /** AI 流式输出文本时触发（每收到一个 token 调用一次） */
            onText: (text) => {
              streamHandleRef.current?.append(text);
            },

            /** AI 决定调用工具时触发 */
            onToolCall: (tc) => {
              // 记录日志（只截取前 200 个字符的参数，防止日志过长）
              logger.info("AI 请求调用工具", {
                tool: tc.function.name,
                argsPreview: tc.function.arguments.slice(0, 200),
              });
              // 刷新流式缓冲区：把 AI 说的话固定到消息列表
              streamHandleRef.current?.flush();
              streamHandleRef.current?.reset();
              // 更新消息列表状态，触发 React 重新渲染
              setMessages([...session.getMessages()]);
            },

            /** 工具执行完成时触发 */
            onToolResult: () => {
              // 同步消息状态，确保工具执行结果及时显示
              streamHandleRef.current?.flush();
              setMessages([...session.getMessages()]);
            },

            /** 开始压缩上下文时触发 */
            onCompactStart: () => {
              setCompactStatus("正在压缩上下文...");
            },

            /** 上下文压缩完成时触发 */
            onCompact: (summary: string) => {
              logger.info("上下文自动压缩完成", {
                sessionId: session.id,
                summaryLen: summary.length,
              });
              setCompactStatus(null);
              // 刷新消息列表以显示更新后的会话
              streamHandleRef.current?.flush();
              setMessages([...session.getMessages()]);
            },
          },
          logger,
          contextManager
        );
      } catch (err) {
        // === 错误处理 ===
        const msg =
          err instanceof Error ? err.message : String(err);
        // 记录循环错误到日志文件
        logger.error("Agent loop 异常", {
          error: msg,
          sessionId: session.id,
        });
        // 将错误作为助手消息追加到会话中，确保持久可见
        streamHandleRef.current?.flush();
        session.append({
          role: "assistant",
          content: `[错误] ${msg}`,
        });
      } finally {
        // finally 块无论成功还是失败都会执行
        // 刷新最后的缓冲区，重置状态
        streamHandleRef.current?.flush();
        streamHandleRef.current?.reset();
        setMessages([...session.getMessages()]);
        setIsProcessing(false);  // 退出处理状态，允许用户再次输入
      }
    },
    [currentModel, config, provider, toolRegistry]  // 依赖数组
  );

  /** 创建新会话 */
  const handleNewSession = useCallback(() => {
    session = new Session(config.sessionDir);
    logger.setSessionId(session.id);
    logger.info("新建会话", { sessionId: session.id, workdir: config.workdir });
    setMessages([]);
  }, []);

  /** 恢复已有会话 */
  const handleResumeSession = useCallback(
    async (id: string) => {
      // 动态导入 path.join（按需加载）
      const { join } = await import("node:path");
      const sessionPath = join(config.sessionDir, `${id}.jsonl`);
      session = Session.load(sessionPath);
      logger.setSessionId(session.id);
      logger.info("切换会话", { sessionId: session.id });
      setMessages([...session.getMessages()]);
    },
    []
  );

  /** 切换模型 */
  const handleModelChange = useCallback((newModel: string) => {
    setCurrentModel(newModel);
    provider.setModel(newModel);
  }, []);

  // 渲染 App 组件（React.createElement 等价于 JSX 的 <App .../>）
  // 之所以不用 JSX 是避免在这个文件中配置 JSX 转换
  return React.createElement(App, {
    version,
    sessionId: session.id,
    model: currentModel,
    workdir: config.workdir,
    sessionDir: config.sessionDir,
    messages,
    isProcessing,
    streamHandleRef,
    contextManager,
    onSubmit: handleSubmit,
    onModelChange: handleModelChange,
    onNewSession: handleNewSession,
    onResumeSession: handleResumeSession,
  });
};

// === 渲染 TUI 到终端 ===
// render() 返回 { waitUntilExit }，这是一个 Promise，
// 在 TUI 退出（用户按 Ctrl+C 或程序结束）时完成
const { waitUntilExit } = render(React.createElement(TuiWrapper));

// === 优雅退出处理 ===
// SIGINT = Signal Interrupt（通常是用户按 Ctrl+C）
process.on("SIGINT", () => {
  console.log("\n正在退出，会话已保存。");
  process.exit(0);  // exit code 0 = 正常退出
});

// 等待 TUI 退出完成（阻塞在这里直到用户关闭）
await waitUntilExit;
