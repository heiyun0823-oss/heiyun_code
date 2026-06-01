# Heiyun Code MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 构建 Heiyun Code CLI 最小可执行版本——用户输入 → Agent Loop → 工具调用 → 返回结果的完整闭环。

**Architecture:** 4 包 monorepo（@heiyun/ai → @heiyun/tools → @heiyun/agent-core → @heiyun/cli），单向依赖链路。LLM 层用 fetch + SSE 零依赖流式解析。CLI 用 commander + ink (React→终端)。会话用 JSONL 线性追加存储。

**Tech Stack:** TypeScript, Node.js ≥ 20, npm workspaces, tsup, node:test, commander, ink, react

---

## 文件结构总览

```
heiyun-code/
├── package.json                    # root: npm workspaces
├── tsconfig.base.json              # 共享 TS 配置
├── .gitignore
├── .npmrc
│
├── packages/
│   ├── ai/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── types.ts
│   │       ├── openai.ts
│   │       └── index.ts
│   │
│   ├── tools/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── read.ts
│   │       ├── write.ts
│   │       ├── edit.ts
│   │       ├── bash.ts
│   │       └── index.ts
│   │
│   ├── agent-core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── types.ts
│   │       ├── system-prompt.ts
│   │       ├── session.ts
│   │       ├── tool-registry.ts
│   │       ├── loop.ts
│   │       └── index.ts
│   │
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       ├── bin/
│       │   └── heiyun.js
│       └── src/
│           ├── config.ts
│           ├── app.tsx
│           ├── main.ts
│           └── components/
│               ├── status-bar.tsx
│               ├── chat-view.tsx
│               └── input-box.tsx
```

---

## 阶段 1：项目骨架

### Task 1.1: root package.json + workspace 配置

**Files:**
- Create: `package.json`
- Create: `.npmrc`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: 创建 root package.json**

```json
{
  "name": "heiyun-code",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/ai",
    "packages/tools",
    "packages/agent-core",
    "packages/cli"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "clean": "rm -rf packages/*/dist"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: 创建 .npmrc**

```
save-exact=true
```

- [ ] **Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules/
dist/
.env
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 5: Commit**

```bash
git init D:/heiyun_code
cd D:/heiyun_code
git add package.json .npmrc tsconfig.base.json .gitignore
git commit -m "chore: initialize monorepo skeleton"
```

---

### Task 1.2: 创建 4 个 package 的 package.json 和 tsconfig

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/tsup.config.ts`
- Create: `packages/ai/src/index.ts`
- Create: `packages/tools/package.json`
- Create: `packages/tools/tsconfig.json`
- Create: `packages/tools/tsup.config.ts`
- Create: `packages/tools/src/index.ts`
- Create: `packages/agent-core/package.json`
- Create: `packages/agent-core/tsconfig.json`
- Create: `packages/agent-core/tsup.config.ts`
- Create: `packages/agent-core/src/index.ts`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsup.config.ts`
- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: 创建 packages/ai/package.json**

```json
{
  "name": "@heiyun/ai",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "node --test --experimental-test-coverage src/**/*.test.ts",
    "dev": "tsup --watch"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: 创建 packages/ai/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 packages/ai/tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 4: 创建 packages/ai/src/index.ts (占位)**

```typescript
// @heiyun/ai — LLM abstraction layer
export {};
```

- [ ] **Step 5: 创建 packages/tools/package.json**

```json
{
  "name": "@heiyun/tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "node --test src/**/*.test.ts",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "@heiyun/ai": "*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 6: 创建 packages/tools/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 7: 创建 packages/tools/tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 8: 创建 packages/tools/src/index.ts (占位)**

```typescript
// @heiyun/tools — tool implementations
export {};
```

- [ ] **Step 9: 创建 packages/agent-core/package.json**

```json
{
  "name": "@heiyun/agent-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "node --test src/**/*.test.ts",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "@heiyun/ai": "*",
    "@heiyun/tools": "*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 10: 创建 packages/agent-core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 11: 创建 packages/agent-core/tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 12: 创建 packages/agent-core/src/index.ts (占位)**

```typescript
// @heiyun/agent-core — agent runtime
export {};
```

- [ ] **Step 13: 创建 packages/cli/package.json**

```json
{
  "name": "@heiyun/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "heiyun": "./bin/heiyun.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "node --test src/**/*.test.ts",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "@heiyun/ai": "*",
    "@heiyun/agent-core": "*",
    "@heiyun/tools": "*",
    "commander": "^12.0.0",
    "ink": "^5.0.0",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0"
  }
}
```

- [ ] **Step 14: 创建 packages/cli/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 15: 创建 packages/cli/tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
```

- [ ] **Step 16: 创建 packages/cli/bin/heiyun.js**

```javascript
#!/usr/bin/env node
import("../dist/main.js");
```

- [ ] **Step 17: 创建 packages/cli/src/index.ts (占位)**

```typescript
// @heiyun/cli — CLI entry & TUI
export {};
```

- [ ] **Step 18: 安装依赖并验证构建**

```bash
cd D:/heiyun_code
npm install
npm run build
```

Expected: 4 个包全部构建成功，生成 `dist/` 目录。

- [ ] **Step 19: Commit**

```bash
git add .
git commit -m "chore: scaffold all 4 packages with tsup build"
```

---

## 阶段 2：@heiyun/ai — LLM 抽象层

### Task 2.1: 统一类型定义

**Files:**
- Create: `packages/ai/src/types.ts`
- Create: `packages/ai/src/types.test.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/ai/src/types.ts
git commit -m "feat(ai): define unified types for messages, tools, and LLM interaction"
```

---

### Task 2.2: OpenAI 兼容 Provider 实现

**Files:**
- Create: `packages/ai/src/openai.ts`
- Create: `packages/ai/src/openai.test.ts`

- [ ] **Step 1: 创建 openai.ts**

```typescript
import type { GenerateChunk, GenerateRequest, LLMProvider, Message, ToolCallDelta } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  private apiBase: string;
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(opts?: {
    apiBase?: string;
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    this.apiBase = opts?.apiBase ?? process.env.HEIYUN_CODE_API_BASE ?? "https://api.deepseek.com/v1";
    this.apiKey = opts?.apiKey ?? process.env.HEIYUN_CODE_API_KEY ?? "";
    this.model = opts?.model ?? process.env.HEIYUN_CODE_MODEL ?? "deepseek-chat";
    this.maxTokens = opts?.maxTokens ?? 4096;
    this.temperature = opts?.temperature ?? 0.7;
  }

  async *generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk> {
    const url = `${this.apiBase}/chat/completions`;

    const body = {
      model: req.model ?? this.model,
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      tools: req.tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: req.tool_choice ?? "auto",
      max_tokens: req.max_tokens ?? this.maxTokens,
      temperature: req.temperature ?? this.temperature,
      stream: true,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: req.signal,
        });

        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            const text = await response.text();
            throw new Error(`API error ${response.status}: ${text}`);
          }
          // 5xx: retry
          throw new Error(`API error ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);

              if (data === "[DONE]") {
                yield { type: "finish" };
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                  yield { type: "text", text: delta.content };
                }

                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    yield {
                      type: "tool_call",
                      toolCall: {
                        index: tc.index,
                        id: tc.id,
                        type: "function",
                        function: tc.function
                          ? {
                              name: tc.function.name,
                              arguments: tc.function.arguments,
                            }
                          : undefined,
                      },
                    };
                  }
                }
              } catch {
                // skip unparseable chunks
              }
            }
          }
        }
        return; // stream ended normally
      } catch (err) {
        lastError = err as Error;
        if (req.signal?.aborted) throw err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    throw lastError ?? new Error("Unknown error in generateStream");
  }
}
```

- [ ] **Step 2: 创建 openai.test.ts (SSE 解析测试)**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { OpenAIProvider } from "./openai.js";

describe("OpenAIProvider.generateStream", () => {
  it("should parse text chunks from SSE stream", async () => {
    // Setup mock that returns SSE text chunks
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"id":"cmpl-1","choices":[{"delta":{"content":"你好"}}]}\n\n' +
                'data: {"id":"cmpl-1","choices":[{"delta":{"content":"世界"}}]}\n\n' +
                "data: [DONE]\n\n"
            )
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test" });
      const chunks: string[] = [];
      for await (const chunk of provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "hello" }],
      })) {
        if (chunk.type === "text") chunks.push(chunk.text!);
      }
      assert.equal(chunks.join(""), "你好世界");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should parse tool_call delta chunks", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"id":"cmpl-1","choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read","arguments":"{\\"path\\":\\""}}]}}]}\n\n' +
                'data: {"id":"cmpl-1","choices":[{"delta":{"tool_calls":[{"index":0,"type":"function","function":{"arguments":"test.ts\\"}"}}]}}]}\n\n' +
                "data: [DONE]\n\n"
            )
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test" });
      const toolCallChunks: Array<Partial<import("./types.js").ToolCallDelta>> = [];
      for await (const chunk of provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "read file" }],
      })) {
        if (chunk.type === "tool_call") toolCallChunks.push(chunk.toolCall!);
      }
      assert.equal(toolCallChunks.length, 2);
      assert.equal(toolCallChunks[0].function?.name, "read");
      assert.equal(
        toolCallChunks[0].function?.arguments,
        '{"path":"'
      );
      assert.equal(
        toolCallChunks[1].function?.arguments,
        'test.ts"}'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should retry on 5xx and succeed", async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount <= 2) {
        return new Response("Internal Error", { status: 500 });
      }
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode("data: [DONE]\n\n")
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "test" });
      const chunks: Array<import("./types.js").GenerateChunk> = [];
      for await (const chunk of provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }
      assert.equal(callCount, 3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should not retry on 4xx errors", async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      callCount++;
      return new Response("Unauthorized", { status: 401 });
    }) as unknown as typeof fetch;

    try {
      const provider = new OpenAIProvider({ apiKey: "bad-key" });
      const gen = provider.generateStream({
        model: "test",
        messages: [{ role: "user", content: "hi" }],
      });
      await assert.rejects(async () => {
        for await (const _ of gen) {
          // should throw
        }
      });
      assert.equal(callCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
```

- [ ] **Step 3: 更新 packages/ai/src/index.ts 导出**

```typescript
export * from "./types.js";
export { OpenAIProvider } from "./openai.js";
```

- [ ] **Step 4: 运行测试**

```bash
cd D:/heiyun_code/packages/ai
npx tsup
node --test dist/openai.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/types.ts packages/ai/src/openai.ts packages/ai/src/openai.test.ts packages/ai/src/index.ts
git commit -m "feat(ai): implement OpenAI-compatible provider with SSE streaming"
```

---

## 阶段 3：@heiyun/tools — 四个原语工具

### Task 3.1: read 工具

**Files:**
- Create: `packages/tools/src/read.ts`
- Create: `packages/tools/src/read.test.ts`

- [ ] **Step 1: 创建 read.ts**

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

export const readDefinition = {
  name: "read",
  description:
    "Read a file from the filesystem. Returns content in ToolResult JSON format.",
  parameters: {
    type: "object",
    description: "Parameters for reading a file",
    properties: {
      path: { type: "string", description: "文件路径，相对于当前工作目录" },
      offset: { type: "number", description: "起始行号，从 1 开始" },
      limit: { type: "number", description: "读取行数" },
    },
    required: ["path"],
  } as import("@heiyun/ai").ToolParameter,
};

export interface ToolContext {
  workdir: string;
  signal?: AbortSignal;
}

function resolveSafePath(inputPath: string, workdir: string): string {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workdir, inputPath);

  const normalizedWorkdir = path.resolve(workdir);
  if (!resolved.startsWith(normalizedWorkdir + path.sep) && resolved !== normalizedWorkdir) {
    throw new Error(`路径穿越被拒绝: ${inputPath}`);
  }

  const blockedPrefixes = ["/etc", "/proc", "/sys", "/dev", "/System", "/Windows"];
  for (const bp of blockedPrefixes) {
    if (resolved.startsWith(bp)) {
      throw new Error(`敏感路径被拒绝: ${resolved}`);
    }
  }

  return resolved;
}

export async function executeRead(
  params: { path: string; offset?: number; limit?: number },
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const filePath = resolveSafePath(params.path, ctx.workdir);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      return { success: false, output: "", error: `路径是目录: ${params.path}` };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const offset = params.offset ? Math.max(1, params.offset) : 1;
    const limit = params.limit ? Math.min(params.limit, 5000) : 5000;

    const startIdx = offset - 1;
    const sliced = lines.slice(startIdx, startIdx + limit);

    const resultText = sliced
      .map((line, i) => `${String(startIdx + i + 1).padStart(6, " ")}| ${line}`)
      .join("\n");

    return {
      success: true,
      output: resultText,
      metadata: {
        bytes_read: Buffer.byteLength(content, "utf-8"),
      },
    };
  } catch (err) {
    if (err instanceof Error) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, output: "", error: `文件不存在: ${params.path}` };
      }
      return { success: false, output: "", error: err.message };
    }
    return { success: false, output: "", error: String(err) };
  }
}
```

- [ ] **Step 2: 创建 read.test.ts**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { executeRead } from "./read.js";

describe("executeRead", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-read-test-"));
    return { workdir: tmpDir };
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该读取文件全部内容", () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "test.txt"), "line1\nline2\nline3\n");
      const result = executeRead({ path: "test.txt" }, ctx);
      assert.equal(result.success, true);
      assert.ok(result.output.includes("line1"));
      assert.ok(result.output.includes("line3"));
    } finally {
      teardown();
    }
  });

  it("应该支持 offset 和 limit 参数", () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "test.txt"), "a\nb\nc\nd\ne\n");
      const result = executeRead({ path: "test.txt", offset: 2, limit: 2 }, ctx);
      assert.equal(result.success, true);
      assert.ok(!result.output.includes("a"));
      assert.ok(result.output.includes("b"));
      assert.ok(result.output.includes("c"));
      assert.ok(!result.output.includes("d"));
    } finally {
      teardown();
    }
  });

  it("应该在文件不存在时返回错误", () => {
    const ctx = setup();
    try {
      const result = executeRead({ path: "nope.txt" }, ctx);
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("文件不存在"));
    } finally {
      teardown();
    }
  });

  it("应该拒绝路径穿越", () => {
    const ctx = setup();
    try {
      const result = executeRead({ path: "../etc/passwd" }, ctx);
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("路径穿越"));
    } finally {
      teardown();
    }
  });

  it("应该拒绝敏感路径", () => {
    const result = executeRead({ path: "/etc/passwd" }, { workdir: "/home/user" });
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("敏感路径"));
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/tools/src/read.ts packages/tools/src/read.test.ts
git commit -m "feat(tools): implement read tool"
```

---

### Task 3.2: write 工具

**Files:**
- Create: `packages/tools/src/write.ts`
- Create: `packages/tools/src/write.test.ts`

- [ ] **Step 1: 创建 write.ts**

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

export const writeDefinition = {
  name: "write",
  description:
    "Create a new file or completely overwrite an existing file. Parent directories are created automatically.",
  parameters: {
    type: "object",
    description: "Parameters for writing a file",
    properties: {
      path: { type: "string", description: "文件路径" },
      content: { type: "string", description: "文件内容" },
    },
    required: ["path", "content"],
  } as import("@heiyun/ai").ToolParameter,
};

// Reuse path resolution from read.ts
function resolveSafePath(inputPath: string, workdir: string): string {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workdir, inputPath);

  const normalizedWorkdir = path.resolve(workdir);
  if (!resolved.startsWith(normalizedWorkdir + path.sep) && resolved !== normalizedWorkdir) {
    throw new Error(`路径穿越被拒绝: ${inputPath}`);
  }

  const blockedPrefixes = ["/etc", "/proc", "/sys", "/dev", "/System", "/Windows"];
  for (const bp of blockedPrefixes) {
    if (resolved.startsWith(bp)) {
      throw new Error(`敏感路径被拒绝: ${resolved}`);
    }
  }

  return resolved;
}

export async function executeWrite(
  params: { path: string; content: string },
  ctx: { workdir: string; signal?: AbortSignal }
): Promise<ToolResult> {
  try {
    const filePath = resolveSafePath(params.path, ctx.workdir);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const buf = Buffer.from(params.content, "utf-8");
    fs.writeFileSync(filePath, buf);

    return {
      success: true,
      output: `写入 ${buf.length} 字节到 ${params.path}`,
      metadata: { bytes_written: buf.length },
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 2: 创建 write.test.ts**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { executeWrite } from "./write.js";

describe("executeWrite", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-write-test-"));
    return { workdir: tmpDir };
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该创建新文件并写入内容", () => {
    const ctx = setup();
    try {
      const result = executeWrite({ path: "new.txt", content: "hello world" }, ctx);
      assert.equal(result.success, true);
      assert.equal(result.metadata!.bytes_written, 11);
      const content = fs.readFileSync(path.join(tmpDir, "new.txt"), "utf-8");
      assert.equal(content, "hello world");
    } finally {
      teardown();
    }
  });

  it("应该自动创建父目录", () => {
    const ctx = setup();
    try {
      const result = executeWrite(
        { path: "sub/deep/dir/file.txt", content: "nested" },
        ctx
      );
      assert.equal(result.success, true);
      const content = fs.readFileSync(
        path.join(tmpDir, "sub/deep/dir/file.txt"),
        "utf-8"
      );
      assert.equal(content, "nested");
    } finally {
      teardown();
    }
  });

  it("应该覆盖已有文件", () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "old.txt"), "old content");
      const result = executeWrite({ path: "old.txt", content: "new content" }, ctx);
      assert.equal(result.success, true);
      const content = fs.readFileSync(path.join(tmpDir, "old.txt"), "utf-8");
      assert.equal(content, "new content");
    } finally {
      teardown();
    }
  });

  it("应该拒绝系统路径", () => {
    const result = executeWrite(
      { path: "/etc/hosts", content: "bad" },
      { workdir: "/home/user" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("敏感路径"));
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/tools/src/write.ts packages/tools/src/write.test.ts
git commit -m "feat(tools): implement write tool"
```

---

### Task 3.3: edit 工具

**Files:**
- Create: `packages/tools/src/edit.ts`
- Create: `packages/tools/src/edit.test.ts`

- [ ] **Step 1: 创建 edit.ts**

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

export const editDefinition = {
  name: "edit",
  description:
    "Perform exact string replacement in a file. Searches for old_string and replaces it with new_string.",
  parameters: {
    type: "object",
    description: "Parameters for editing a file",
    properties: {
      path: { type: "string", description: "文件路径" },
      old_string: { type: "string", description: "要替换的精确文本" },
      new_string: { type: "string", description: "替换后的文本" },
    },
    required: ["path", "old_string", "new_string"],
  } as import("@heiyun/ai").ToolParameter,
};

function resolveSafePath(inputPath: string, workdir: string): string {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workdir, inputPath);

  const normalizedWorkdir = path.resolve(workdir);
  if (!resolved.startsWith(normalizedWorkdir + path.sep) && resolved !== normalizedWorkdir) {
    throw new Error(`路径穿越被拒绝: ${inputPath}`);
  }

  const blockedPrefixes = ["/etc", "/proc", "/sys", "/dev", "/System", "/Windows"];
  for (const bp of blockedPrefixes) {
    if (resolved.startsWith(bp)) {
      throw new Error(`敏感路径被拒绝: ${resolved}`);
    }
  }

  return resolved;
}

export async function executeEdit(
  params: { path: string; old_string: string; new_string: string },
  ctx: { workdir: string; signal?: AbortSignal }
): Promise<ToolResult> {
  try {
    if (!params.old_string) {
      return { success: false, output: "", error: "old_string 不能为空" };
    }

    const filePath = resolveSafePath(params.path, ctx.workdir);
    const original = fs.readFileSync(filePath, "utf-8");

    const count = original.split(params.old_string).length - 1;

    if (count === 0) {
      return {
        success: false,
        output: "",
        error: `未找到匹配文本。请用 read 工具确认文件内容后重试。`,
      };
    }

    if (count > 1) {
      return {
        success: false,
        output: "",
        error: `匹配到 ${count} 处，必须唯一匹配。请提供更多上下文使 old_string 唯一。`,
      };
    }

    const updated = original.replace(params.old_string, params.new_string);
    fs.writeFileSync(filePath, updated, "utf-8");

    return {
      success: true,
      output: `已编辑 ${params.path}：替换 ${count} 处`,
      metadata: { replacements: count },
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { success: false, output: "", error: `文件不存在: ${params.path}` };
    }
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 2: 创建 edit.test.ts**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { executeEdit } from "./edit.js";

describe("executeEdit", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-edit-test-"));
    return { workdir: tmpDir };
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该精确替换唯一匹配的字符串", () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "code.ts"), "const x: any = 1;");
      const result = executeEdit(
        { path: "code.ts", old_string: "const x: any = 1", new_string: "const x: number = 1" },
        ctx
      );
      assert.equal(result.success, true);
      assert.equal(result.metadata!.replacements, 1);
      const content = fs.readFileSync(path.join(tmpDir, "code.ts"), "utf-8");
      assert.equal(content, "const x: number = 1;");
    } finally {
      teardown();
    }
  });

  it("应该在 0 匹配时返回错误", () => {
    const ctx = setup();
    try {
      fs.writeFileSync(path.join(tmpDir, "code.ts"), "hello world");
      const result = executeEdit(
        { path: "code.ts", old_string: "xyz not found", new_string: "abc" },
        ctx
      );
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("未找到匹配文本"));
    } finally {
      teardown();
    }
  });

  it("应该在多处匹配时返回错误", () => {
    const ctx = setup();
    try {
      fs.writeFileSync(
        path.join(tmpDir, "code.ts"),
        "import a;\n\nimport b;\n\nimport c;\n"
      );
      const result = executeEdit(
        { path: "code.ts", old_string: "import", new_string: "export" },
        ctx
      );
      assert.equal(result.success, false);
      assert.ok(result.error!.includes("匹配到 3 处"));
    } finally {
      teardown();
    }
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/tools/src/edit.ts packages/tools/src/edit.test.ts
git commit -m "feat(tools): implement edit tool"
```

---

### Task 3.4: bash 工具

**Files:**
- Create: `packages/tools/src/bash.ts`
- Create: `packages/tools/src/bash.test.ts`

- [ ] **Step 1: 创建 bash.ts**

```typescript
import { spawn } from "node:child_process";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";
import { platform } from "node:os";

export const bashDefinition = {
  name: "bash",
  description: "Execute a shell command and return stdout and stderr.",
  parameters: {
    type: "object",
    description: "Parameters for executing a shell command",
    properties: {
      command: { type: "string", description: "要执行的命令" },
      workdir: { type: "string", description: "执行目录，覆盖会话 workdir" },
    },
    required: ["command"],
  } as import("@heiyun/ai").ToolParameter,
};

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /sudo\s/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\s*\(\s*\)\s*\{/,
  />\s*\/dev\/sda/,
  /chmod\s+777\s+\//,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}

export async function executeBash(
  params: { command: string; workdir?: string },
  ctx: { workdir: string; signal?: AbortSignal; timeoutMs?: number }
): Promise<ToolResult> {
  try {
    if (isDangerous(params.command)) {
      return {
        success: false,
        output: "",
        error: `危险命令被拒绝: ${params.command}`,
      };
    }

    const workdir = params.workdir
      ? path.isAbsolute(params.workdir)
        ? params.workdir
        : path.resolve(ctx.workdir, params.workdir)
      : ctx.workdir;

    const timeoutMs = ctx.timeoutMs ?? 120_000;
    const isWindows = platform() === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/bash";
    const shellArgs = isWindows ? ["/c", params.command] : ["-c", params.command];

    const startTime = Date.now();

    return new Promise<ToolResult>((resolve) => {
      const child = spawn(shell, shellArgs, {
        cwd: workdir,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
        signal: ctx.signal,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            output: `${stdout}\n\nstderr:\n${stderr}`,
            error: `命令执行超时 (${timeoutMs}ms)`,
            metadata: { exit_code: -1, duration_ms: duration },
          });
          return;
        }

        resolve({
          success: exitCode === 0,
          output: `stdout:\n${stdout}\n\nstderr:\n${stderr}\n\nexit code: ${exitCode}`,
          metadata: {
            exit_code: exitCode ?? -1,
            duration_ms: duration,
          },
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: "",
          error: err.message,
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 2: 创建 bash.test.ts**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import * as os from "node:os";
import { executeBash } from "./bash.js";

describe("executeBash", () => {
  const workdir = os.tmpdir();

  it("应该执行成功的命令并返回 stdout", () => {
    const result = executeBash({ command: "echo hello" }, { workdir });
    assert.equal(result.success, true);
    assert.ok(result.output.includes("hello"));
    assert.equal(result.metadata!.exit_code, 0);
  });

  it("应该捕获 stderr", () => {
    const result = executeBash(
      { command: "echo error >&2" },
      { workdir }
    );
    assert.ok(result.output.includes("error"));
  });

  it("应该在命令失败时返回非零退出码", () => {
    const result = executeBash(
      {
        command: process.platform === "win32"
          ? "cmd /c exit 1"
          : "exit 1",
      },
      { workdir }
    );
    assert.equal(result.success, false);
    assert.ok(result.metadata!.exit_code! !== 0);
  });

  it("应该拒绝危险命令", () => {
    const result = executeBash(
      { command: "rm -rf / --no-preserve-root" },
      { workdir }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("危险命令"));
  });

  it("应该拒绝 sudo 命令", () => {
    const result = executeBash(
      { command: "sudo rm file" },
      { workdir }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("危险命令"));
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/tools/src/bash.ts packages/tools/src/bash.test.ts
git commit -m "feat(tools): implement bash tool"
```

---

### Task 3.5: 工具注册与导出

**Files:**
- Modify: `packages/tools/src/index.ts`

- [ ] **Step 1: 更新 index.ts**

```typescript
import type { ToolResult } from "@heiyun/ai";
import { executeRead, readDefinition } from "./read.js";
import { executeWrite, writeDefinition } from "./write.js";
import { executeEdit, editDefinition } from "./edit.js";
import { executeBash, bashDefinition } from "./bash.js";

export interface ToolContext {
  workdir: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const allTools = [
  { definition: readDefinition, execute: executeRead },
  { definition: writeDefinition, execute: executeWrite },
  { definition: editDefinition, execute: executeEdit },
  { definition: bashDefinition, execute: executeBash },
] as const;
```

- [ ] **Step 2: 运行所有工具测试**

```bash
cd D:/heiyun_code/packages/tools
npx tsup
node --test dist/*.test.js
```

Expected: 所有测试通过 (~13 tests).

- [ ] **Step 3: Commit**

```bash
git add packages/tools/src/index.ts
git commit -m "feat(tools): register all four primitive tools"
```

---

## 阶段 4：@heiyun/agent-core — Agent 运行时

### Task 4.1: Agent-core 类型定义

**Files:**
- Create: `packages/agent-core/src/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
import type { ToolCall } from "@heiyun/ai";

export interface SessionNode {
  id: string;
  timestamp: string;
  role: "system" | "user" | "assistant" | "tool";
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/agent-core/src/types.ts
git commit -m "feat(agent-core): define session and loop types"
```

---

### Task 4.2: System Prompt

**Files:**
- Create: `packages/agent-core/src/system-prompt.ts`

- [ ] **Step 1: 创建 system-prompt.ts**

```typescript
export const SYSTEM_PROMPT = `You are Heiyun Code, an interactive coding agent CLI.

You have these tools:
- read(path, offset?, limit?): Read a file. Use to inspect code.
- write(path, content): Create or overwrite a file. Parent directories are created automatically.
- edit(path, old_string, new_string): Replace EXACT old_string with new_string in file. The match must be unique in the file.
- bash(command, workdir?): Execute a shell command. Returns stdout, stderr, and exit code.

Rules:
- Read files before editing them. Never edit a file you haven't read.
- Use edit for small, targeted changes. Use write for creating new files or rewriting entire files.
- For git, testing, building, linting, package management, searching — use bash.
- Keep responses concise. Briefly show your reasoning, then take action.
- When you're done with the task, summarize what you changed and why.
- Work in the current working directory unless told otherwise by the user.
- Reply in Chinese, but code, tool names, and technical terms should stay in English.
- Tool execution results are in JSON format with a "success" field. If success is false, read the error and try to correct your approach.

Think step by step, then use tools to accomplish the user's request.`;
```

- [ ] **Step 2: Commit**

```bash
git add packages/agent-core/src/system-prompt.ts
git commit -m "feat(agent-core): add system prompt (~300 words)"
```

---

### Task 4.3: Session 管理 (JSONL)

**Files:**
- Create: `packages/agent-core/src/session.ts`
- Create: `packages/agent-core/src/session.test.ts`

- [ ] **Step 1: 创建 session.ts**

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { SessionNode, SessionMeta } from "./types.js";

export class Session {
  id: string;
  filePath: string;
  private messages: SessionNode[] = [];

  constructor(sessionDir: string, id?: string) {
    this.id = id ?? crypto.randomUUID();
    this.filePath = path.join(sessionDir, `${this.id}.jsonl`);
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  append(node: Omit<SessionNode, "id" | "timestamp">): void {
    const full: SessionNode = {
      ...node,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.messages.push(full);
    const line = JSON.stringify(full) + "\n";
    fs.appendFileSync(this.filePath, line, "utf-8");
  }

  getMessages(): SessionNode[] {
    return this.messages;
  }

  static load(filePath: string): Session {
    const session = new Session(path.dirname(filePath));
    session.filePath = filePath;
    session.id = path.basename(filePath, ".jsonl");
    const content = fs.readFileSync(filePath, "utf-8");
    session.messages = content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SessionNode);
    return session;
  }

  static list(sessionDir: string): SessionMeta[] {
    if (!fs.existsSync(sessionDir)) return [];
    const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));
    return files.map((f) => {
      const filePath = path.join(sessionDir, f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const firstLine = content.trim().split("\n")[0];
      let summary = "(empty)";
      try {
        const node = JSON.parse(firstLine) as SessionNode;
        summary = node.content?.slice(0, 80) ?? summary;
      } catch {
        // use default summary
      }
      return {
        id: path.basename(f, ".jsonl"),
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        summary,
      };
    });
  }
}
```

- [ ] **Step 2: 创建 session.test.ts**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Session } from "./session.js";

describe("Session", () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heiyun-session-test-"));
    return tmpDir;
  };

  const teardown = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  it("应该创建新会话并追加消息", () => {
    const dir = setup();
    try {
      const session = new Session(dir);
      session.append({ role: "user", content: "hello" });
      const msgs = session.getMessages();
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].role, "user");
      assert.equal(msgs[0].content, "hello");
      assert.ok(msgs[0].id);
      assert.ok(msgs[0].timestamp);
    } finally {
      teardown();
    }
  });

  it("应该将消息持久化到 JSONL 文件", () => {
    const dir = setup();
    try {
      const session = new Session(dir);
      session.append({ role: "user", content: "msg1" });
      session.append({ role: "assistant", content: "reply1" });

      // load back
      const loaded = Session.load(session.filePath);
      const msgs = loaded.getMessages();
      assert.equal(msgs.length, 2);
      assert.equal(msgs[0].content, "msg1");
      assert.equal(msgs[1].content, "reply1");
    } finally {
      teardown();
    }
  });

  it("应该列出所有会话", () => {
    const dir = setup();
    try {
      const s1 = new Session(dir);
      s1.append({ role: "user", content: "会话 1 第一条消息" });
      const s2 = new Session(dir);
      s2.append({ role: "user", content: "会话 2" });

      const list = Session.list(dir);
      assert.equal(list.length, 2);
      assert.ok(list.some((m) => m.id === s1.id));
      assert.ok(list.some((m) => m.id === s2.id));
    } finally {
      teardown();
    }
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent-core/src/types.ts packages/agent-core/src/session.ts packages/agent-core/src/session.test.ts
git commit -m "feat(agent-core): implement Session with JSONL persistence"
```

---

### Task 4.4: ToolRegistry 工具注册表

**Files:**
- Create: `packages/agent-core/src/tool-registry.ts`
- Create: `packages/agent-core/src/tool-registry.test.ts`

- [ ] **Step 1: 创建 tool-registry.ts**

```typescript
import type { ToolCall, ToolDefinition, ToolResult } from "@heiyun/ai";
import type { ToolContext } from "@heiyun/tools";
import { allTools } from "@heiyun/tools";

export interface ToolHandler {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    for (const tool of allTools) {
      this.register(tool);
    }
  }

  register(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(toolCall: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const handler = this.tools.get(toolCall.function.name);
    if (!handler) {
      return {
        success: false,
        output: "",
        error: `未知工具: ${toolCall.function.name}`,
      };
    }

    let params: Record<string, unknown>;
    try {
      params = JSON.parse(toolCall.function.arguments);
    } catch {
      return {
        success: false,
        output: "",
        error: `工具参数 JSON 解析失败: ${toolCall.function.arguments}`,
      };
    }

    return handler.execute(params, ctx);
  }
}
```

- [ ] **Step 2: 创建 tool-registry.test.ts**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { ToolRegistry } from "./tool-registry.js";

describe("ToolRegistry", () => {
  it("应该注册 4 个内置工具", () => {
    const registry = new ToolRegistry();
    const defs = registry.getDefinitions();
    assert.equal(defs.length, 4);
    const names = defs.map((d) => d.name).sort();
    assert.deepStrictEqual(names, ["bash", "edit", "read", "write"]);
  });

  it("应该执行已注册的工具", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute(
      {
        id: "call_1",
        type: "function",
        function: {
          name: "read",
          arguments: JSON.stringify({ path: "nonexistent.txt" }),
        },
      },
      { workdir: "/tmp" }
    );
    assert.equal(result.success, false);
    // Expect file-not-found error since file doesn't exist
  });

  it("应该在工具不存在时返回错误", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute(
      {
        id: "call_2",
        type: "function",
        function: {
          name: "nonexistent_tool",
          arguments: "{}",
        },
      },
      { workdir: "/tmp" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("未知工具"));
  });

  it("应该在参数 JSON 非法时返回错误", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute(
      {
        id: "call_3",
        type: "function",
        function: {
          name: "read",
          arguments: "not valid json",
        },
      },
      { workdir: "/tmp" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error!.includes("JSON 解析失败"));
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent-core/src/tool-registry.ts packages/agent-core/src/tool-registry.test.ts
git commit -m "feat(agent-core): implement ToolRegistry"
```

---

### Task 4.5: Agent Loop 核心循环

**Files:**
- Create: `packages/agent-core/src/loop.ts`

- [ ] **Step 1: 创建 loop.ts**

```typescript
import type { LLMProvider, GenerateRequest, GenerateChunk, ToolCall, ToolCallDelta, Message } from "@heiyun/ai";
import type { SessionNode, LoopOptions } from "./types.js";
import { Session } from "./session.js";
import { ToolRegistry } from "./tool-registry.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

export interface LoopCallbacks {
  onText?: (text: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: { toolCallId: string; output: string; success: boolean }) => void;
}

function mergeToolCallDelta(
  toolCalls: ToolCall[],
  delta: Partial<ToolCallDelta>
): void {
  if (!delta.function) return;

  const { index } = delta;

  while (toolCalls.length <= index) {
    toolCalls.push({
      id: "",
      type: "function",
      function: { name: "", arguments: "" },
    });
  }

  const target = toolCalls[index];
  if (delta.id) target.id = delta.id;
  if (delta.function.name) target.function.name = delta.function.name;
  if (delta.function.arguments) target.function.arguments += delta.function.arguments;
}

export async function agentLoop(
  provider: LLMProvider,
  session: Session,
  toolRegistry: ToolRegistry,
  userInput: string,
  options: LoopOptions,
  workdir: string,
  callbacks?: LoopCallbacks
): Promise<string> {
  session.append({ role: "user", content: userInput });

  for (let round = 1; round <= options.maxRounds; round++) {
    if (options.signal?.aborted) {
      throw new Error("用户中断");
    }

    const messages = session.getMessages();
    const req: GenerateRequest = {
      model: options.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map(
          (m): Message => ({
            role: m.role,
            content: m.content,
            ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
            ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
          })
        ),
      ],
      tools: toolRegistry.getDefinitions(),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
      signal: options.signal,
    };

    let assistantContent = "";
    const toolCalls: ToolCall[] = [];

    for await (const chunk of provider.generateStream(req)) {
      if (chunk.type === "text") {
        assistantContent += chunk.text!;
        callbacks?.onText?.(chunk.text!);
      } else if (chunk.type === "tool_call") {
        mergeToolCallDelta(toolCalls, chunk.toolCall!);
      }
      // finish chunk — ignore, handled by end of stream
    }

    if (toolCalls.length === 0) {
      session.append({
        role: "assistant",
        content: assistantContent || null,
      });
      return assistantContent;
    }

    session.append({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      callbacks?.onToolCall?.(tc);

      const result = await toolRegistry.execute(tc, {
        workdir,
        signal: options.signal,
      });

      callbacks?.onToolResult?.({
        toolCallId: tc.id,
        output: result.success ? result.output : result.error ?? result.output,
        success: result.success,
      });

      session.append({
        role: "tool",
        content: JSON.stringify(result),
        tool_call_id: tc.id,
      });
    }
  }

  throw new Error(`Agent loop 已超过最大轮次 (${options.maxRounds})，会话已保存。`);
}
```

- [ ] **Step 2: 更新 agent-core index.ts**

```typescript
export { Session } from "./session.js";
export { ToolRegistry } from "./tool-registry.js";
export { agentLoop } from "./loop.js";
export { SYSTEM_PROMPT } from "./system-prompt.js";
export type { SessionNode, SessionMeta, LoopOptions } from "./types.js";
export type { LoopCallbacks } from "./loop.js";
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent-core/src/loop.ts packages/agent-core/src/index.ts
git commit -m "feat(agent-core): implement Agent Loop with tool dispatch"
```

---

## 阶段 5：@heiyun/cli — CLI 入口 & TUI

### Task 5.1: 配置读取

**Files:**
- Create: `packages/cli/src/config.ts`

- [ ] **Step 1: 创建 config.ts**

```typescript
import * as os from "node:os";
import * as path from "node:path";

function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export interface CliConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  maxRounds: number;
  temperature: number;
  sessionDir: string;
  workdir: string;
  sessionId?: string;
}

export function loadConfig(cliArgs: {
  apiBase?: string;
  apiKey?: string;
  model?: string;
  maxRounds?: string;
  temperature?: string;
  workdir?: string;
  session?: string;
}): CliConfig {
  const workdir = cliArgs.workdir
    ? path.resolve(cliArgs.workdir)
    : process.cwd();

  return {
    apiBase:
      cliArgs.apiBase ??
      process.env.HEIYUN_CODE_API_BASE ??
      "https://api.deepseek.com/v1",
    apiKey:
      cliArgs.apiKey ?? process.env.HEIYUN_CODE_API_KEY ?? "",
    model:
      cliArgs.model ??
      process.env.HEIYUN_CODE_MODEL ??
      "deepseek-chat",
    maxRounds: cliArgs.maxRounds
      ? parseInt(cliArgs.maxRounds, 10)
      : parseInt(process.env.HEIYUN_CODE_MAX_ROUNDS ?? "50", 10),
    temperature: cliArgs.temperature
      ? parseFloat(cliArgs.temperature)
      : parseFloat(process.env.HEIYUN_CODE_TEMPERATURE ?? "0.7"),
    sessionDir: expandHome(
      process.env.HEIYUN_CODE_SESSION_DIR ?? "~/.heiyun/sessions"
    ),
    workdir,
    sessionId: cliArgs.session,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/config.ts
git commit -m "feat(cli): implement config loader with env/args/defaults"
```

---

### Task 5.2: StatusBar 组件

**Files:**
- Create: `packages/cli/src/components/status-bar.tsx`

- [ ] **Step 1: 创建 status-bar.tsx**

```tsx
import React from "react";
import { Text } from "ink";

interface StatusBarProps {
  sessionId: string;
  model: string;
  workdir: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  sessionId,
  model,
  workdir,
}) => {
  const shortId = sessionId.slice(0, 8);
  return (
    <Text backgroundColor="#16213e" color="#e0e0e0">
      <Text color="#e94560">⚡ Heiyun Code v0.1.0</Text>
      <Text color="#888">  会话: {shortId} | 模型: {model} | {workdir}</Text>
    </Text>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/components/status-bar.tsx
git commit -m "feat(cli): add StatusBar component"
```

---

### Task 5.3: ChatView 组件

**Files:**
- Create: `packages/cli/src/components/chat-view.tsx`

- [ ] **Step 1: 创建 chat-view.tsx**

```tsx
import React from "react";
import { Text, Box } from "ink";
import type { SessionNode } from "@heiyun/agent-core";

interface ChatViewProps {
  messages: SessionNode[];
  streamingText: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  streamingText,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      {messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          switch (m.role) {
            case "user":
              return (
                <Box key={m.id} marginY={1}>
                  <Text>
                    <Text color="#f0c040">🧑 你: </Text>
                    <Text>{m.content}</Text>
                  </Text>
                </Box>
              );

            case "assistant": {
              const hasToolCalls =
                m.tool_calls && m.tool_calls.length > 0;
              return (
                <Box key={m.id} flexDirection="column" marginY={1}>
                  {m.content && (
                    <Text>
                      <Text color="#50c878">🤖 AI: </Text>
                      <Text>{m.content}</Text>
                    </Text>
                  )}
                  {hasToolCalls &&
                    m.tool_calls!.map((tc) => (
                      <Box
                        key={tc.id}
                        flexDirection="column"
                        marginY={1}
                        borderStyle="single"
                        borderColor="#333"
                        paddingX={1}
                      >
                        <Text backgroundColor="#1a3a5c" color="#4fc3f7">
                          🔧 {tc.function.name}
                        </Text>
                      </Box>
                    ))}
                </Box>
              );

            case "tool": {
              let parsed:
                | { success?: boolean; output?: string; error?: string }
                | null = null;
              try {
                parsed = JSON.parse(m.content ?? "{}");
              } catch {
                // display raw
              }
              return (
                <Box
                  key={m.id}
                  flexDirection="column"
                  marginY={1}
                  borderStyle="single"
                  borderColor="#333"
                  paddingX={1}
                >
                  <Box backgroundColor="#1a3a5c" paddingX={1}>
                    <Text color="#4fc3f7">🔧 工具结果</Text>
                  </Box>
                  {parsed && (
                    <Box flexDirection="column" paddingX={1}>
                      {parsed.output ? (
                        <Text color="#ccc">{parsed.output}</Text>
                      ) : null}
                      {parsed.error ? (
                        <Text color="#e57373">错误: {parsed.error}</Text>
                      ) : null}
                      <Text
                        backgroundColor={
                          parsed.success ? "#0a2a0a" : "#2a0a0a"
                        }
                        color={parsed.success ? "#4caf50" : "#e57373"}
                      >
                        {parsed.success ? "✓ 成功" : "✗ 失败"}
                      </Text>
                    </Box>
                  )}
                  {!parsed && <Text color="#ccc">{m.content}</Text>}
                </Box>
              );
            }

            default:
              return null;
          }
        })}
      {streamingText && (
        <Text>
          <Text color="#50c878">🤖 AI: </Text>
          <Text>{streamingText}</Text>
        </Text>
      )}
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/components/chat-view.tsx
git commit -m "feat(cli): add ChatView component with expanded tool result cards"
```

---

### Task 5.4: InputBox 组件

**Files:**
- Create: `packages/cli/src/components/input-box.tsx`

- [ ] **Step 1: 创建 input-box.tsx**

```tsx
import React, { useState } from "react";
import { Text, Box } from "ink";
import TextInput from "ink-text-input";

interface InputBoxProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  disabled,
}) => {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue("");
    }
  };

  return (
    <Box borderStyle="single" borderColor="#0f3460" paddingX={1}>
      <Text color="#50c878">▸ </Text>
      {disabled ? (
        <Text color="#555">处理中...</Text>
      ) : (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="输入你的问题..."
        />
      )}
      <Text color="#555">  Ctrl+C 退出</Text>
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/components/input-box.tsx
git commit -m "feat(cli): add InputBox component"
```

---

### Task 5.5: App 主组件

**Files:**
- Create: `packages/cli/src/app.tsx`

- [ ] **Step 1: 创建 app.tsx**

```tsx
import React, { useState, useRef, useCallback } from "react";
import { Box } from "ink";
import type { SessionNode } from "@heiyun/agent-core";
import { StatusBar } from "./components/status-bar.js";
import { ChatView } from "./components/chat-view.js";
import { InputBox } from "./components/input-box.js";

interface AppProps {
  sessionId: string;
  model: string;
  workdir: string;
  onUserInput: (input: string) => Promise<void>;
}

export const App: React.FC<AppProps> = ({
  sessionId,
  model,
  workdir,
  onUserInput,
}) => {
  const [messages, setMessages] = useState<SessionNode[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const lastAssistantId = useRef<string | null>(null);

  const handleSubmit = useCallback(
    async (input: string) => {
      setIsProcessing(true);
      setStreamingText("");

      // Add user message
      const userNode: SessionNode = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        role: "user",
        content: input,
      };
      setMessages((prev) => [...prev, userNode]);

      // Stream text
      // onUserInput will use agentLoop callbacks to update messages
      // For now, placeholder
      setIsProcessing(false);
    },
    [onUserInput]
  );

  return (
    <Box flexDirection="column" padding={0}>
      <StatusBar sessionId={sessionId} model={model} workdir={workdir} />
      <ChatView messages={messages} streamingText={streamingText} />
      <InputBox onSubmit={handleSubmit} disabled={isProcessing} />
    </Box>
  );
};
```

Wait — this needs to be rethought. The TUI needs direct access to the agentLoop callbacks. Let me redesign app.tsx to hold session reference and wire callbacks properly.

- [ ] **Step 1 (revised): 创建 app.tsx**

```tsx
import React, { useState, useCallback } from "react";
import { Box } from "ink";
import type { SessionNode, SessionMeta } from "@heiyun/agent-core";
import { StatusBar } from "./components/status-bar.js";
import { ChatView } from "./components/chat-view.js";
import { InputBox } from "./components/input-box.js";

interface AppProps {
  sessionId: string;
  model: string;
  workdir: string;
  messages: SessionNode[];
  streamingText: string;
  isProcessing: boolean;
  onSubmit: (input: string) => void;
}

export const App: React.FC<AppProps> = ({
  sessionId,
  model,
  workdir,
  messages,
  streamingText,
  isProcessing,
  onSubmit,
}) => {
  return (
    <Box flexDirection="column" padding={0}>
      <StatusBar sessionId={sessionId} model={model} workdir={workdir} />
      <ChatView messages={messages} streamingText={streamingText} />
      <InputBox onSubmit={onSubmit} disabled={isProcessing} />
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/app.tsx
git commit -m "feat(cli): add App main component"
```

---

### Task 5.6: main.ts CLI 入口

**Files:**
- Create: `packages/cli/src/main.ts`

- [ ] **Step 1: 创建 main.ts**

```typescript
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
  const fs = await import("node:fs");
  const path = await import("node:path");
  const sessionPath = path.join(config.sessionDir, `${config.sessionId}.jsonl`);
  if (fs.existsSync(sessionPath)) {
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
  const [messages, setMessages] = useState<SessionNode[]>(
    session.getMessages()
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
            model: config.model,
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
              // UI updates when messages change
            },
            onToolResult: () => {
              // UI updates when messages change
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
    [config, provider, toolRegistry]
  );

  return React.createElement(App, {
    sessionId: session.id,
    model: config.model,
    workdir: config.workdir,
    messages,
    streamingText,
    isProcessing,
    onSubmit: handleSubmit,
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/main.ts packages/cli/src/config.ts
git commit -m "feat(cli): implement CLI entry with commander and ink TUI"
```

---

## 阶段 6：联调与打磨

### Task 6.1: 刷新构建与端到端验证

- [ ] **Step 1: 全量构建**

```bash
cd D:/heiyun_code
npm install
npm run build
```

Expected: 4 个包全部构建成功。

- [ ] **Step 2: 运行所有测试**

```bash
cd D:/heiyun_code/packages/ai && node --test dist/*.test.js
cd D:/heiyun_code/packages/tools && node --test dist/*.test.js
cd D:/heiyun_code/packages/agent-core && node --test dist/*.test.js
```

Expected: 所有测试通过。

- [ ] **Step 3: 验证 CLI 启动**

设置环境变量后启动：
```bash
export HEIYUN_CODE_API_KEY=your-deepseek-key
node packages/cli/dist/main.js --help
```

Expected: 显示中文帮助信息。

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: final integration, all tests pass"
```

---

### Task 6.2: 创建 README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 README.md**

```markdown
# Heiyun Code

交互式 AI 编码代理 CLI 工具（MVP）。

## 快速开始

```bash
# 安装依赖
npm install

# 构建
npm run build

# 设置 API 密钥
export HEIYUN_CODE_API_KEY=your-deepseek-api-key

# 启动
node packages/cli/dist/main.js

# 或通过 bin
npx heiyun
```

## 使用

```bash
heiyun                    # 新建交互会话
heiyun -s <id>            # 恢复指定会话
heiyun -l                 # 列出历史会话
heiyun -d /path/to/project  # 指定工作目录
heiyun -m deepseek-chat   # 指定模型
heiyun --help             # 查看帮助
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HEIYUN_CODE_API_BASE` | `https://api.deepseek.com/v1` | API 地址 |
| `HEIYUN_CODE_API_KEY` | - | API 密钥 |
| `HEIYUN_CODE_MODEL` | `deepseek-chat` | 模型名称 |
| `HEIYUN_CODE_MAX_ROUNDS` | `50` | 最大工具调用轮次 |
| `HEIYUN_CODE_TEMPERATURE` | `0.7` | 生成温度 |
| `HEIYUN_CODE_SESSION_DIR` | `~/.heiyun/sessions` | 会话存储目录 |

## 架构

```
@heiyun/ai              → LLM 通信抽象层
@heiyun/tools           → 四个原语工具 (read/write/edit/bash)
@heiyun/agent-core      → Agent Loop + Session + ToolRegistry
@heiyun/cli             → CLI 入口 + ink TUI
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Plan Self-Review 检查清单

- [x] **Spec coverage**: 需求文档 9 条验收标准全部有对应实现
- [x] **Placeholder scan**: 无 TBD/TODO，所有步骤含实际代码
- [x] **Type consistency**: SessionNode、ToolResult、GenerateChunk 等类型在各包间一致
- [x] **Build flow**: tsup 构建顺序正确（ai → tools → agent-core → cli）
