/**
 * @heiyun/agent-core — index.ts（包入口）
 * ========================================
 * 导出 agent-core 包的所有公开 API。
 * 包括：会话管理、工具注册、Agent 循环、日志、上下文管理、Token 计数。
 *
 * 注意区分：
 *   export { X } — 导出具体的值（类、函数、常量等）
 *   export type { X } — 只导出类型（编译时存在，运行时消失）
 */

export { Session } from "./session.js";
export { ToolRegistry } from "./tool-registry.js";
export { agentLoop } from "./loop.js";
export { SYSTEM_PROMPT } from "./system-prompt.js";
export { Logger } from "./logger.js";
export type { LogEntry } from "./logger.js";
export type { SessionNode, SessionMeta, LoopOptions } from "./types.js";
export type { LoopCallbacks } from "./loop.js";
export { ContextManager } from "./context-manager.js";
export type { ContextManagerConfig, CompactPreview, OnCompactCallback } from "./context-manager.js";
export { TokenCounter } from "./token-counter.js";
