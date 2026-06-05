/**
 * @heiyun/ai — types.ts
 * ====================
 * 这个文件定义了整个项目所有包共用的核心类型（TypeScript 接口）。
 * 类型 = 数据结构的"模具"，规定了数据长什么样、有哪些字段、字段是什么类型。
 * 所有包（@heiyun/tools、@heiyun/agent-core、@heiyun/cli）都依赖这里的类型。
 *
 * 注意：修改这里的类型会影响所有下游包，必须格外小心。
 */

// === 消息（Message）相关类型 ===
// 消息是 LLM 对话的核心数据结构。
// 每一轮对话中，用户、助手、系统、工具都会产生消息，
// 所有消息按时间顺序组成消息列表发送给 LLM API。

/**
 * 纯文本内容块
 * OpenAI API 支持在一条消息中混合文本和图片，
 * TextContent 表示其中的文本部分。
 */
export interface TextContent {
  type: "text"; // 内容类型标识，固定为 "text"
  text: string;  // 实际的文本内容
}

/**
 * 图片内容块
 * image_url.url 可以是：
 *   - 网络 URL：如 "https://example.com/photo.png"
 *   - Base64 编码：如 "data:image/png;base64,iVBOR..."
 * 注意：目前项目主要使用文本交互，图片功能为扩展预留。
 */
export interface ImageContent {
  type: "image_url";           // 内容类型标识
  image_url: { url: string };   // 图片的 URL 或 base64 数据
}

/**
 * 联合类型（Union Type）
 * ContentPart 可以是 TextContent 或 ImageContent 中的任一种。
 * 这是 TypeScript 的"或"语法：A | B 表示"要么是 A 类型，要么是 B 类型"。
 */
export type ContentPart = TextContent | ImageContent;

/**
 * 工具调用（Tool Call）
 * 当 LLM 决定调用某个工具时，会在回复中附带此结构。
 * 例如 LLM 想读取文件，就会生成一个 name="read" 的 ToolCall。
 *
 * 字段 fucntion.arguments 是 JSON 字符串（不是对象！），
 * 需要用 JSON.parse() 解析后才能使用。
 * 为什么要用字符串？因为 LLM 是逐 token 生成文本的，
 * 流式传输时参数是分片到达的，字符串方便拼接。
 */
export interface ToolCall {
  id: string;                   // 工具调用的唯一 ID（用于关联结果）
  type: "function";            // 固定为 "function"，表示这是一个函数调用
  function: {
    name: string;               // 要调用的工具名称，如 "read"、"bash"
    arguments: string;          // 工具参数的 JSON 字符串，如 '{"path":"/src/a.ts"}'
  };
}

/**
 * 消息（Message）— 对话的基本单元
 * 在 LLM API 中，一次对话由多条消息按时间顺序排列组成。
 * 每条消息有一个 role（角色）来表示是谁说的。
 *
 * 四种角色：
 *   - system：系统提示词，设定 AI 的行为规则（只在对话开头）
 *   - user：用户说的话
 *   - assistant：AI 助手的回复
 *   - tool：工具执行后返回的结果（必须配合 tool_call_id 使用）
 *
 * content 可以为 null：当 assistant 消息只包含工具调用而没有文字回复时，
 * content 就是 null。
 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";  // 消息角色
  content: string | null;           // 消息文本内容，可能为 null
  tool_call_id?: string;            // 当 role="tool" 时，关联到哪个工具调用
  tool_calls?: ToolCall[];          // 当 role="assistant" 时，AI 想要调用的工具列表
  name?: string;                    // 可选的消息发送者名称
}

// === 工具（Tool）相关类型 ===
// 工具是 LLM 能够调用的"外挂能力"。
// 通过工具定义（ToolDefinition），我们告诉 LLM：
// "你可以调用这些函数，它们各自需要哪些参数"，
// 然后 LLM 会在需要时自动生成 ToolCall 来调用它们。

/**
 * 工具参数描述（符合 JSON Schema 规范）
 * 这个结构告诉 LLM 每个工具接受哪些参数、参数是什么类型。
 * 它遵循 JSON Schema 标准——这是描述 JSON 数据结构的通用规范。
 *
 * type：参数的数据类型，如 "string"、"number"、"object"
 * description：参数的中文说明，帮助 LLM 理解参数含义
 * enum：可选，限定参数只能从这些值中选择（如 ["read", "write"]）
 * properties：当参数是对象类型时，描述对象内部有哪些属性
 * required：必填参数名称列表
 */
export interface ToolParameter {
  type: string;                                       // 数据类型
  description: string;                                // 参数说明
  enum?: string[];                                    // 可选值列表
  properties?: Record<string, ToolParameter>;          // 嵌套属性定义
  required?: string[];                                // 必填字段列表
}

/**
 * 工具定义（Tool Definition）
 * 每个工具在注册时需要提供：
 *   - name：工具的唯一名称（LLM 通过名称来调用）
 *   - description：工具功能描述（帮助 LLM 决定何时使用这个工具）
 *   - parameters：工具接受的参数规范（JSON Schema 格式）
 */
export interface ToolDefinition {
  name: string;              // 工具名称，如 "read"、"write"、"bash"
  description: string;       // 功能描述，用自然语言说明工具用途
  parameters: ToolParameter; // 参数规范
}

// === 流式传输相关类型 ===
// LLM API 使用 SSE（Server-Sent Events，服务器推送事件）协议进行流式输出。
// 简单理解：API 不是一次性返回全部结果，而是像打字机一样逐字输出。
// 这样做的好处是用户可以实时看到 AI 的回复，不用等待全部生成完毕。

/**
 * 工具调用的流式增量（Delta）
 * 在流式传输中，一个完整的工具调用信息是分多次送达的：
 *   第1帧：{"index": 0, "id": "call_abc", "function": {"name": "read"}}
 *   第2帧：{"index": 0, "function": {"arguments": "{\"path\""}}
 *   第3帧：{"index": 0, "function": {"arguments": ": \"/src/a.ts\"}"}}
 *
 * 我们需要把这些碎片拼接起来，才能得到完整的工具调用。
 * index 字段用于区分多个并行的工具调用（LLM 可能同时调用多个工具）。
 */
export interface ToolCallDelta {
  index: number;     // 索引号，属于第几个工具调用（从 0 开始）
  id?: string;       // 工具调用 ID（只在第一帧出现）
  type: "function"; // 固定为 "function"
  function?: {
    name?: string;      // 工具名称（只在第一帧出现）
    arguments?: string; // 参数的片段（每次一小段，需要拼接）
  };
}

// === LLM 交互相关类型 ===
// 这些类型定义了我们如何与 LLM API 通信。

/**
 * 生成请求（GenerateRequest）
 * 每次调用 LLM API 时，我们把以下信息打包发送：
 *
 * model：模型名称，如 "deepseek-chat"、"gpt-4o"（决定用哪个 AI 模型）
 * messages：完整的对话历史（包含所有之前的消息，让 AI 理解上下文）
 * tools：可用的工具列表（告诉 AI 它可以调用哪些函数）
 * tool_choice：工具调用策略
 *   - "auto"：AI 自动判断是否需要调用工具（默认）
 *   - "none"：禁止调用工具，只生成文本
 *   - "required"：强制必须调用工具
 * max_tokens：限制回复的最大 token 数（"token" ≈ 约 0.75 个英文单词或 1-2 个汉字）
 * temperature：生成温度（0~1），越高越有创造性/随机性，越低越确定/保守
 * stream：是否使用流式传输（通常为 true）
 * signal：AbortSignal 对象，用于取消正在进行的请求
 */
export interface GenerateRequest {
  model: string;                           // 模型名称
  messages: Message[];                     // 对话消息列表
  tools?: ToolDefinition[];                // 可用工具定义
  tool_choice?: "auto" | "none" | "required"; // 工具调用策略
  max_tokens?: number;                     // 最大输出 token 数
  temperature?: number;                    // 生成温度（0~1）
  stream?: boolean;                        // 是否流式输出
  signal?: AbortSignal;                    // 取消信号（用于中断请求）
}

/**
 * 流式生成的单次输出块（Chunk）
 * 在流式传输中，AI 的回复被拆分成许多小块逐个到达。
 * 每个块可能是以下三种之一：
 *   - text：一段文本内容（AI 正在说的话）
 *   - tool_call：工具调用的一个片段
 *   - finish：流结束标记
 *
 * 这就是"discriminated union"（可辨识联合类型）：
 * 通过 type 字段区分当前是哪种数据，TypeScript 能据此做类型收窄。
 */
export interface GenerateChunk {
  type: "text" | "tool_call" | "finish";   // 块类型标识
  text?: string;                             // 当 type="text" 时的文本内容
  toolCall?: Partial<ToolCallDelta>;         // 当 type="tool_call" 时的工具调用片段
}

// === Provider（供应商）接口 ===
// Provider 是对 LLM API 的抽象层。
// 因为我们可能对接不同的 AI 服务商（DeepSeek、OpenAI、Moonshot 等），
// 所以定义统一的接口，方便切换。
//
// AsyncGenerator（异步生成器）是什么？
// 它是一个特殊的函数，可以"分批次地"产出数据。
// 用 for await...of 循环来消费它，每次迭代拿到一个 Chunk。
// 类比：普通函数 return 是一下子把整碗饭端出来，
// 而 AsyncGenerator 是像回转寿司一样，一个一个地上菜。
// 这样做的好处是：不用等全部数据生成完毕就能开始处理，
// 用户可以实时看到 AI 的回复逐字出现。

export interface LLMProvider {
  generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk>;
}

// === 工具执行结果 ===
// 每个工具执行完毕后，都必须返回统一格式的 ToolResult。
// 无论成功还是失败，都不应该抛出异常（throw），
// 而是把错误信息放在 error 字段中返回。
// 这样做的好处是：工具执行失败不会导致整个 agent 循环崩溃，
// AI 可以读取 error 信息，调整策略后重试。

/**
 * 工具执行结果
 *
 * success：是否执行成功（true=成功，false=失败）
 * output：执行输出（成功时是结果文本，失败时可为空字符串）
 * error：失败原因（只有 success=false 时有值）
 * metadata：可选的元数据，记录执行细节
 *   - bytes_read：读取了多少字节（read 工具）
 *   - bytes_written：写入了多少字节（write 工具）
 *   - replacements：替换了多少处（edit 工具）
 *   - exit_code：命令退出码（bash 工具，0=成功，非0=失败）
 *   - duration_ms：执行耗时（毫秒）
 */
export interface ToolResult {
  success: boolean;    // 是否成功
  output: string;      // 输出内容
  error?: string;      // 错误描述
  metadata?: {         // 执行详情
    bytes_read?: number;    // 读取字节数
    bytes_written?: number; // 写入字节数
    replacements?: number;  // 替换次数
    exit_code?: number;     // 退出码
    duration_ms?: number;   // 耗时（毫秒）
  };
}
