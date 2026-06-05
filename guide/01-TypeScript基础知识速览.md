# 01 — TypeScript 基础知识速览

> **阅读时间**：约 30 分钟  
> **前置知识**：JavaScript 基础（变量、函数、对象、模块导入导出）  
> **阅读方式**：每学一个特性，建议打开对应的源码文件对照着看

---

TypeScript（简称 TS）是 JavaScript 的超集。可以理解为：**JavaScript + 类型标注**。TS 代码编译后会变成纯 JS。

本文不会从头教你 TypeScript，而是**以项目实际代码为例**，讲解看懂这个项目需要掌握的 TS 特性。每个特性都会标注项目中的具体位置，并用 JS 对比帮你理解"多了什么"。

---

## 1. 类型注解（Type Annotation）

### 是什么？

在变量名后面用 `: 类型` 标注这个变量"只能存什么类型的值"。

### 项目中的位置

**文件**：`packages/agent-core/src/session.ts`  
**行号**：第 10-11 行

```typescript
// session.ts 第 10-11 行
id: string;
filePath: string;
```

### JS vs TS 对比

```javascript
// === 如果用 JS 写 ===
// 没有类型约束，id 可以是任何东西
this.id = id ?? crypto.randomUUID();
this.filePath = path.join(sessionDir, `${this.id}.jsonl`);

// 可能不小心这样写（JS 不会报错，但逻辑就错了）：
this.id = 123;        // 本应是 string，JS 不会阻止
this.filePath = null; // 本应是 string，JS 也不会阻止
```

```typescript
// === TS 写法 ===
id: string;       // 明确标注：id 必须是字符串
filePath: string; // 明确标注：filePath 必须是字符串

// 如果试图赋其他类型，编辑器/编译时直接报错：
this.id = 123;        // ❌ 编译错误：Type 'number' is not assignable to type 'string'
this.filePath = null; // ❌ 编译错误（strict 模式下）
```

> **为什么好**：在写代码阶段就能发现类型错误，不用等到运行时报错。

---

## 2. 接口（interface）

### 是什么？

接口是 TS 最核心的概念之一。它**定义了一个对象的"形状"**——必须有哪些属性、每个属性是什么类型。

### 项目中的位置

**文件**：`packages/ai/src/types.ts`  
**行号**：第 3-12 行、第 20-26 行

```typescript
// types.ts 第 3-8 行 — 定义消息内容的接口
export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: { url: string };
}

// types.ts 第 20-26 行 — 定义一条消息的接口
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}
```

### JS vs TS 对比

```javascript
// === 如果用 JS 写 ===
// 没有结构约束，完全靠程序员自觉
const message = {
  role: "user",
  content: "你好",
  toolCrazy: "意外多出来的属性"   // JS 不会报错
};

function processMessage(msg) {
  // msg 有什么属性？完全不知道，只能靠注释或猜测
  console.log(msg.content.toUpperCase()); // 如果 content 是 null 就会崩
}
```

```typescript
// === TS 写法 ===
interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
}

function processMessage(msg: Message) {
  // 编辑器自动补全 msg.role、msg.content
  // 如果 msg.content 可能是 null，TS 会提示你先检查
  if (msg.content !== null) {
    console.log(msg.content.toUpperCase()); // ✅ 安全
  }
}
```

> **一句话**：`interface` 就是给对象画了一张"图纸"，不符合图纸的对象在编译时就会被拦截。

---

## 3. 联合类型（Union Type）— `|`

### 是什么？

用 `|` 表示"这个变量可以是类型 A，也可以是类型 B"。

### 项目中的位置

**文件**：`packages/ai/src/types.ts`  
**行号**：第 12 行、第 82 行

```typescript
// types.ts 第 12 行 — ContentPart 可以是文本或图片
export type ContentPart = TextContent | ImageContent;

// types.ts 第 82 行 — GenerateChunk 的消息类型只能是这三种之一
export interface GenerateChunk {
  type: "text" | "tool_call" | "finish";
  // ...
}
```

### JS vs TS 对比

```javascript
// === 如果用 JS 写 ===
function handleChunk(chunk) {
  if (chunk.type === "text") {
    console.log(chunk.text);
  } else if (chunk.type === "tool_call") {
    console.log(chunk.toolCall);
  }
  // 问题：如果有人传了 type: "unknown"，代码静默跳过，难以排查
}
```

```typescript
// === TS 写法 ===
function handleChunk(chunk: GenerateChunk) {
  // TS 知道 type 只能是 "text" | "tool_call" | "finish"
  // switch 写漏了编辑器会报警
  switch (chunk.type) {
    case "text":
      console.log(chunk.text); // TS 知道这里 text 属性一定存在
      break;
    case "tool_call":
      console.log(chunk.toolCall); // TS 知道这里 toolCall 属性一定存在
      break;
    case "finish":
      break;
  }
}
```

> **一句话**：`|` 让 TS 知道"只有这几种情况"，帮你写更安全的分支逻辑。

---

## 4. 类型别名（type）

### 是什么？

`type` 给一个类型起个简短的名字，方便复用。看起来和 `interface` 很像，但 `type` 更灵活（可以做联合、交叉等操作）。

### 项目中的位置

**文件**：`packages/ai/src/types.ts`  
**行号**：第 12 行

```typescript
// types.ts 第 12 行
export type ContentPart = TextContent | ImageContent;
```

这里 `ContentPart` 就是一个**类型别名**——它本身不是新类型，只是 `TextContent | ImageContent` 这个联合类型的"简称"。

### interface vs type 快速区分

| | `interface` | `type` |
|---|---|---|
| 定义对象形状 | ✅ 推荐 | ✅ 可以 |
| 定义联合类型 | ❌ 不行 | ✅ 可以（`type A = B \| C`） |
| 可以被"扩展" | ✅ `extends` | ✅ `&` 交叉 |
| 同名自动合并 | ✅ | ❌ |

项目中简单规则：**描述对象形状用 `interface`，给复杂类型起别名用 `type`**。

---

## 5. 可选属性 — `?`

### 是什么？

属性名后面加 `?` 表示"这个属性可有可无"。

### 项目中的位置

**文件**：`packages/ai/src/types.ts`  
**行号**：第 23-26 行

```typescript
// types.ts 第 23-26 行
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;   // ← ? 表示"不传也没关系"
  tool_calls?: ToolCall[];  // ← ? 表示"不传也没关系"
  name?: string;            // ← ? 表示"不传也没关系"
}
```

### JS vs TS 对比

```javascript
// === 如果用 JS 写 ===
const msg = { role: "user", content: "你好" };
// JS 里所有属性本来就可选，没有"强制要求"的概念
// 但如果你忘记传了一个必需属性，只会在运行时出错
```

```typescript
// === TS 写法 ===
const msg: Message = { role: "user", content: "你好" };
// ✅ 合法：tool_call_id 是可选的，不传没问题

const msg2: Message = { role: "user" };
// ❌ 编译错误：content 没有 ?，必须传
```

---

## 6. 类与 `implements` 关键字

### 是什么？

`implements` 表示"这个类必须实现某个接口定义的所有方法"。

### 项目中的位置

**文件**：`packages/ai/src/openai.ts`  
**行号**：第 3 行

```typescript
// openai.ts 第 3 行
export class OpenAIProvider implements LLMProvider {
  // ...
  async *generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk> {
    // 具体实现...
  }
}
```

这里 `OpenAIProvider` 类实现了 `LLMProvider` 接口。`LLMProvider` 的定义在 `packages/ai/src/types.ts` 第 88-90 行：

```typescript
// types.ts 第 88-90 行
export interface LLMProvider {
  generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk>;
}
```

### JS vs TS 对比

```javascript
// === 如果用 JS 写 ===
class OpenAIProvider {
  // 可以随便写，没有任何约束
  generateStream(req) { /* ... */ }
  // 如果哪天不小心把方法名改成了 generateStrem，JS 不会报错
  // 只有运行到那一行才会发现"方法未定义"
}
```

```typescript
// === TS 写法 ===
class OpenAIProvider implements LLMProvider {
  // ✅ 必须实现 generateStream，否则编译报错
  async *generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk> {
    // ...
  }
}
```

> **一句话**：`implements` 就像一个合同——"你要当 LLMProvider，就必须会 generateStream 这个技能"。

---

## 7. 泛型（Generics）

### 是什么？

泛型允许你在定义类或函数时不指定具体类型，而是用一个"类型变量"占位，等使用时再确定。

### 项目中的位置

**文件**：`packages/agent-core/src/tool-registry.ts`  
**行号**：第 11 行

```typescript
// tool-registry.ts 第 11 行
private tools = new Map<string, ToolHandler>();
```

`Map<string, ToolHandler>` 就是泛型的典型用法。`Map` 是 JS 本身就有的数据结构，`<string, ToolHandler>` 是 TS 附加的类型信息：键是 `string`，值是 `ToolHandler` 类型。

### 另一个常见例子

**文件**：`packages/tools/src/read.ts`  
**行号**：第 45 行（函数返回值类型）

```typescript
// read.ts 第 45 行
export async function executeRead(
  params: { path: string; offset?: number; limit?: number },
  ctx: ToolContext
): Promise<ToolResult> {  // ← Promise<ToolResult> 是泛型
  // ...
}
```

### JS vs TS 对比

```javascript
// === 如果用 JS 写 ===
const tools = new Map();
tools.set("read", readHandler);
tools.set(123, "oops");  // JS 不会报错，但逻辑上键应该是 string

const result = tools.get("read");
// result 的类型？不知道。编辑器无法提示你有什么属性和方法
```

```typescript
// === TS 写法 ===
const tools = new Map<string, ToolHandler>();
tools.set("read", readHandler);
tools.set(123, "oops");  // ❌ 编译错误：键必须是 string

const result = tools.get("read");
// result 的类型是 ToolHandler | undefined
// 编辑器知道 result 有 .definition 和 .execute
```

> **一句话**：泛型让你写代码时不用把类型写死，但使用时 TS 又能精确知道是什么类型。

---

## 8. 异步生成器 — `async *`

### 是什么？

`async function*` 创建的是一个"能暂停、能恢复、能异步"的函数。它不会一次性返回所有结果，而是**一个一个地"产出"值**。

### 项目中的位置

**文件**：`packages/ai/src/openai.ts`  
**行号**：第 50 行

```typescript
// openai.ts 第 50 行
async *generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk> {
  // ...
  yield { type: "text", text: "这是第一段..." };
  yield { type: "text", text: "这是第二段..." };
  yield { type: "finish" };
}
```

### 为什么需要它？

LLM 的回复不是一次性返回的，而是一个字一个字"流式"传过来的。`async *` 让代码可以在每收到一个字时立即 `yield`（产出）它，外面用 `for await...of` 来接收：

**文件**：`packages/agent-core/src/loop.ts`  
**行号**：第 100 行

```typescript
// loop.ts 第 100 行
for await (const chunk of provider.generateStream(req)) {
  if (chunk.type === "text") {
    assistantContent += chunk.text!;
    callbacks?.onText?.(chunk.text!);  // 实时展示给用户
  }
}
```

### JS vs TS 对比

```javascript
// === 如果用 JS 写（没有 async generator）===
// 只能等整个响应回来再处理，做不到"流式展示"
const response = await fetch(url, { body: JSON.stringify(req) });
const allData = await response.json();
// 用户要等所有数据到了才能看到回复 → 体验差
```

```typescript
// === TS 写法（async generator）===
async *generateStream(req) {
  // 每收到一小段数据就 yield，外面立刻就能处理
  yield { type: "text", text: "刚收到的片段" };
}
```

> **一句话**：`async *` + `yield` = 像水龙头一样，数据流到一段就放出一段，不用等全部流完。

---

## 9. 空值合并 `??` 与可选链 `?.`

### 是什么？

- `??`：如果左边是 `null` 或 `undefined`，就用右边的值，否则用左边的。
- `?.`：如果左边是 `null` 或 `undefined`，整个表达式返回 `undefined`（不会报错）。

### 项目中的位置

**文件**：`packages/ai/src/openai.ts`  
**行号**：第 19-22 行

```typescript
// openai.ts 第 19-22 行（构造函数中的默认值处理）
this.apiBase = opts?.apiBase ?? process.env.HEIYUN_CODE_API_BASE ?? "https://api.deepseek.com/v1";
this.apiKey = opts?.apiKey ?? process.env.HEIYUN_CODE_API_KEY ?? "";
this.model = opts?.model ?? process.env.HEIYUN_CODE_MODEL ?? "deepseek-chat";
this.maxTokens = opts?.maxTokens ?? 4096;
this.temperature = opts?.temperature ?? 0.7;
```

### JS vs TS 对比

```javascript
// === 旧 JS 写法（用 ||）===
this.apiBase = opts.apiBase || process.env.HEIYUN_CODE_API_BASE || "https://api.deepseek.com/v1";
// 问题：如果 opts.apiBase 是空字符串 ""，|| 也会跳过它（因为 "" 是 falsy）
// 但实际上空字符串是有效的配置值！
```

```typescript
// === 新写法（用 ??）===
this.apiBase = opts?.apiBase ?? process.env.HEIYUN_CODE_API_BASE ?? "https://api.deepseek.com/v1";
// ?? 只在 null/undefined 时走默认值
// "" 和 0 都会被保留（不像 || 会丢弃它们）
```

分解理解：
```typescript
opts?.apiBase       // 如果 opts 是 null/undefined → 返回 undefined（不会报错）
                    // 如果 opts 存在 → 等同于 opts.apiBase

value ?? fallback   // 如果 value 是 null/undefined → 用 fallback
                    // 其他情况（包括 0、""、false）→ 用 value
```

> **一句话**：`??` 是更精确的"默认值"写法，`?.` 是更安全的"可能为空"访问写法。

---

## 10. 工具类型 `Omit<>`

### 是什么？

`Omit<原始类型, '要删除的属性'>` 创建一个新类型，从原始类型中去掉某些属性。

### 项目中的位置

**文件**：`packages/agent-core/src/session.ts`  
**行号**：第 15 行

```typescript
// session.ts 第 15 行
append(node: Omit<SessionNode, "id" | "timestamp">): void {
```

`SessionNode` 的完整定义在 `packages/agent-core/src/types.ts` 第 3-10 行：

```typescript
// types.ts 第 3-10 行
export interface SessionNode {
  id: string;
  timestamp: string;
  role: "system" | "user" | "assistant" | "tool" | "summary";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
```

`Omit<SessionNode, "id" | "timestamp">` 的意思是：**除了 `id` 和 `timestamp` 之外，其他属性都要**。

```typescript
// 等价于：
{
  role: "system" | "user" | "assistant" | "tool" | "summary";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
```

### 为什么这样设计？

`id` 和 `timestamp` 是 `append()` 方法内部自动生成的（第 17-18 行），调用者不需要操心。用 `Omit<>` 强制调用者不能自己传这两个字段：

```typescript
session.append({
  role: "user",
  content: "你好",
  // id: "xxx",     ← ❌ 编译错误！Omit 把这个属性删掉了
  // timestamp: ".." ← ❌ 编译错误！
});
```

---

## 11. `as const` 常量断言

### 是什么？

告诉 TS："把这个值当作不可修改的常量，推导出最精确的字面量类型"。

### 项目中的位置

**文件**：`packages/tools/src/index.ts`  
**行号**：第 13-18 行

```typescript
// tools/index.ts 第 13-18 行
export const allTools = [
  { definition: readDefinition, execute: executeRead },
  { definition: writeDefinition, execute: executeWrite },
  { definition: editDefinition, execute: executeEdit },
  { definition: bashDefinition, execute: executeBash },
] as const;
```

### 有无 `as const` 的区别

```typescript
// === 没有 as const ===
const tools = [
  { name: "read", type: "file" },
  { name: "bash", type: "shell" },
];
// TS 推导出：Array<{ name: string; type: string }>
// name 只是 "string"，丢失了具体值信息
```

```typescript
// === 有 as const ===
const tools = [
  { name: "read", type: "file" },
  { name: "bash", type: "shell" },
] as const;
// TS 推导出：readonly [{ name: "read"; type: "file" }, { name: "bash"; type: "shell" }]
// name 是字面量 "read" | "bash"，类型信息完全保留
```

> **一句话**：`as const` 让数组/对象的类型"收窄"到最精确的状态，避免类型信息在推导过程中丢失。

---

## 12. `import type` — 仅导入类型

### 是什么？

`import type` 表示"我只导入这个模块的**类型信息**，不需要运行时的值"。编译成 JS 后这行导入会被完全删除。

### 项目中的位置

**文件**：`packages/ai/src/openai.ts`  
**行号**：第 1 行

```typescript
// openai.ts 第 1 行
import type { GenerateChunk, GenerateRequest, LLMProvider, Message, ToolCallDelta } from "./types.js";
```

对比普通 `import`：

```typescript
// 普通 import — 编译后保留（因为需要运行时的类/函数/变量）
import { OpenAIProvider } from "./openai.js";

// import type — 编译后删除（因为只是用来做类型检查的）
import type { Message } from "./types.js";
```

> **一句话**：`import type` 让 TS 知道你只是在用类型做检查，不会增加最终 JS 文件的体积。

---

## 13. `AbortSignal` — 跨层传递的取消信号

### 是什么？

`AbortSignal` 是 Web 标准中的"取消令牌"。当你按 Ctrl+C 中断操作时，这个信号会通知所有正在进行的异步操作"别做了，用户取消了"。

### 项目中的位置

信号传递了四层：

```
main.ts (用户按 Ctrl+C)
  → config 对象中 options.signal
    → agentLoop() 检查 signal.aborted
      → provider.generateStream() 传给 fetch 的 signal
```

**文件**：`packages/agent-core/src/loop.ts`  
**行号**：第 57-60 行（检查中断）

```typescript
// loop.ts 第 57-60 行
if (options.signal?.aborted) {
  logger?.warn("用户中断");
  throw new Error("用户中断");
}
```

**文件**：`packages/ai/src/openai.ts`  
**行号**：第 83 行（传给 fetch）

```typescript
// openai.ts 第 83 行
const response = await fetch(url, {
  // ...
  signal: req.signal,  // ← 把取消信号传给底层网络请求
});
```

这个设计的好处是：用户按一个 Ctrl+C，所有层级的操作都立刻停止，不会出现"界面显示已取消但后台还在请求"的情况。

---

## 小结

你不需要一次记住上面所有特性。把这篇文章当作"速查手册"——后面读源码时遇到看不懂的 TS 语法，回来找对应的章节即可。

| 特性 | 一句话 | 项目中最典型的位置 |
|------|--------|-----------------|
| `: 类型` | 标注变量类型 | `session.ts` L10-11 |
| `interface` | 定义对象形状 | `types.ts` L20-26 |
| `\|` 联合类型 | 可以是 A 或 B | `types.ts` L82 |
| `type` 别名 | 给类型起名字 | `types.ts` L12 |
| `?` 可选属性 | 可传可不传 | `types.ts` L23-26 |
| `implements` | 类必须实现接口 | `openai.ts` L3 |
| `Map<K,V>` 泛型 | 精确标注容器类型 | `tool-registry.ts` L11 |
| `async *` | 逐个产出异步值 | `openai.ts` L50 |
| `??` / `?.` | 安全默认值/访问 | `openai.ts` L19-22 |
| `Omit<>` | 删除部分属性 | `session.ts` L15 |
| `as const` | 收窄为精确常量 | `tools/index.ts` L13-18 |
| `import type` | 仅导入类型 | `openai.ts` L1 |
| `AbortSignal` | 取消令牌 | `loop.ts` L57-60 |

> **下一步**：打开 `guide/02-项目核心模块详解.md`，我们开始逐包深入。
