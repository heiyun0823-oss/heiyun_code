// === 消息 ===

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: { url: string };
}

export type ContentPart = TextContent | ImageContent;

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

// === 工具 ===

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter;
}

// === 工具调用 Delta ===

export interface ToolCallDelta {
  index: number;
  id?: string;
  type: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

// === LLM 交互 ===

export interface GenerateRequest {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | "required";
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface GenerateChunk {
  type: "text" | "tool_call" | "finish";
  text?: string;
  toolCall?: Partial<ToolCallDelta>;
}

// === Provider 接口 ===

export interface LLMProvider {
  generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk>;
}

// === 工具执行结果 ===

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: {
    bytes_read?: number;
    bytes_written?: number;
    replacements?: number;
    exit_code?: number;
    duration_ms?: number;
  };
}
