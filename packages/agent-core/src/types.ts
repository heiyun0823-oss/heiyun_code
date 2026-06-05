/**
 * @heiyun/agent-core — types.ts
 * ==============================
 * agent-core 包的内部类型定义。
 * 这些类型用于会话管理、日志记录和循环配置，
 * 不暴露给外部 API，只在本包内流转。
 */

import type { ToolCall } from "@heiyun/ai";

/**
 * 会话节点（SessionNode）
 * 一次对话由多个节点组成，每个节点代表一条消息。
 * 它是 Message 类型在 session 层面的展开版本：
 *   - 多了 id（唯一标识）和 timestamp（时间戳）用于持久化存储
 *   - 多了 "summary" 角色（上下文压缩后产生的摘要节点）
 *
 * role 角色类型：
 *   - system：系统提示词
 *   - user：用户输入
 *   - assistant：AI 回复
 *   - tool：工具执行结果
 *   - summary：上下文压缩后的历史摘要
 */
export interface SessionNode {
  id: string;                  // UUID 唯一标识
  timestamp: string;           // ISO 8601 时间戳，如 "2026-06-06T12:00:00.000Z"
  role: "system" | "user" | "assistant" | "tool" | "summary";
  content: string | null;      // 消息文本内容
  tool_calls?: ToolCall[];     // AI 想要调用的工具
  tool_call_id?: string;       // 关联的工具调用 ID
  name?: string;               // 消息名称
}

/**
 * 会话元数据（Meta）
 * 用于会话列表展示，不包含完整的消息内容。
 * 类似于文件系统中的"文件属性"：看文件名/修改时间而不打开文件。
 */
export interface SessionMeta {
  id: string;           // 会话唯一 ID
  createdAt: string;    // 创建时间
  updatedAt: string;    // 最后更新时间
  summary: string;      // 会话摘要（取第一条消息的前 80 个字符）
}

/**
 * Agent 循环配置选项
 * 传递给 agentLoop() 函数的配置参数
 */
export interface LoopOptions {
  model: string;           // 使用的模型名
  maxRounds: number;       // 最大循环轮次（防止无限循环）
  maxTokens: number;       // 每次请求的最大输出 token 数
  temperature: number;     // 生成温度
  signal?: AbortSignal;    // 中断信号（用于取消正在进行的循环）
}
