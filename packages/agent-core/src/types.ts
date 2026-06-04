import type { ToolCall } from "@heiyun/ai";

export interface SessionNode {
  id: string;
  timestamp: string;
  role: "system" | "user" | "assistant" | "tool" | "summary";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface SessionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
}

export interface LoopOptions {
  model: string;
  maxRounds: number;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}
