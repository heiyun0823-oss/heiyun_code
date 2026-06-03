# Repository Guidelines

## Project Overview

Heiyun Code is an interactive AI coding agent CLI built as an npm workspaces monorepo. It provides a terminal UI (ink/React) that lets users converse with an LLM that can read, write, edit files, and execute shell commands. The project targets Node.js ≥20, is fully ESM, and uses TypeScript 5.9 with strict mode.

## Architecture & Data Flow

**Dependency chain (strictly linear):** `@heiyun/ai` → `@heiyun/tools` → `@heiyun/agent-core` → `@heiyun/cli`

```
User input (TUI)
  → loadConfig() merges: settings.json > CLI args > env vars > defaults
  → OpenAIProvider.generateStream() sends POST to /v1/chat/completions
  → SSE stream parsed via ReadableStream; yields text chunks and tool_call deltas
  → agentLoop() accumulates deltas into full ToolCall[], then executes via ToolRegistry
  → Tool results serialized as JSON tool messages appended to session JSONL
  → Loop repeats up to maxRounds (default 50)
```

### Package responsibilities

| Package | Role | Key exports |
|---|---|---|
| `@heiyun/ai` | LLM provider abstraction | `OpenAIProvider`, `LLMProvider`, `Message`, `ToolCall`, `ToolDefinition`, `ToolResult`, `GenerateRequest`, `GenerateChunk` |
| `@heiyun/tools` | Four filesystem/shell primitives | `executeRead`, `executeWrite`, `executeEdit`, `executeBash`, `allTools[]`, `ToolContext` |
| `@heiyun/agent-core` | Agent loop + session + tool registry | `agentLoop()`, `Session`, `ToolRegistry`, `SYSTEM_PROMPT`, `LoopCallbacks`, `SessionNode`, `LoopOptions` |
| `@heiyun/cli` | CLI entry + ink TUI + slash commands | Commander arg parsing, React/ink components, `/login` and `/model` panels |

### Type system

All shared types originate in `@heiyun/ai/src/types.ts` and flow downstream:

- `Message` — the core currency: `{ role, content, tool_call_id?, tool_calls?, name? }`
- `ToolCall` — `{ id, type: "function", function: { name, arguments } }` (arguments is a JSON string)
- `ToolResult` — `{ success, output, error?, metadata? }` — every tool execution returns this shape
- `GenerateChunk` — discriminated union via `type`: `"text" | "tool_call" | "finish"`
- `LLMProvider` — interface with single method: `generateStream(req): AsyncGenerator<GenerateChunk>`

### Agent loop flow (packages/agent-core/src/loop.ts)

1. Append user message to Session (JSONL + in-memory)
2. Per round (1..maxRounds):
   - Check `signal.aborted` → throw `"用户中断"`
   - Build `GenerateRequest` with system prompt, all session messages, tool definitions
   - Stream from `provider.generateStream(req)`: text chunks → `callbacks.onText`, tool_call deltas → `mergeToolCallDelta()` (index-based accumulation with `+=` on arguments)
   - No tool calls: append assistant message, return content
   - Has tool calls: append assistant message with `tool_calls` array, then for each: `toolRegistry.execute()` → append tool result message
3. Max rounds exceeded → throws with session-count message

## Key Directories

```
.
├── packages/
│   ├── ai/src/           # types.ts, openai.ts, openai.test.ts
│   ├── tools/src/        # read.ts, write.ts, edit.ts, bash.ts (+ .test.ts each)
│   ├── agent-core/src/   # loop.ts, session.ts, tool-registry.ts, system-prompt.ts, types.ts
│   └── cli/
│       ├── bin/heiyun.js # shim: #!/usr/bin/env node → dynamic import dist/main.js
│       └── src/          # main.ts, config.ts, settings.ts, app.tsx, components/, slash-commands/
├── tsconfig.base.json    # base TS config extended by all packages
└── package.json          # root workspaces + scripts
```

## Development Commands

```bash
# Install all workspace dependencies
npm install

# Build all packages (tsup → ESM + dts + sourcemaps in dist/)
npm run build

# Run all tests (node:test across all packages)
npm test

# Run tests for a single package
cd packages/ai && npm test
cd packages/tools && npm test
cd packages/agent-core && npm test
cd packages/cli && npm test

# Run a single test file
node --test packages/ai/src/openai.test.ts

# Clean build artifacts
npm run clean
```

## Code Conventions & Common Patterns

### Module system
- **Strict ESM only.** All imports use `.js` extension: `import { foo } from "./bar.js"`
- Workspace packages referenced by name: `import type { ToolResult } from "@heiyun/ai"`
- Barrel exports: each package has `src/index.ts` re-exporting all public symbols

### Tool pattern (packages/tools/)
Each tool exports two things:
```ts
export const readDefinition: ToolDefinition = { name, description, parameters };
export async function executeRead(params, ctx): Promise<ToolResult>;
```
Registered via `allTools` array in `index.ts`, auto-loaded by `ToolRegistry.registerBuiltins()`.

### Tool result pattern
All tool executions return `ToolResult` JSON. Consistent shape:
- Success: `{ success: true, output: "result text", metadata: { ... } }`
- Failure: `{ success: false, output: "", error: "reason" }`
- Errors are caught, never thrown — failures are surfaced through the result object so the agent loop can continue

### Path security
Every filesystem tool runs paths through `resolveSafePath()` which:
1. Resolves relative paths against `ctx.workdir`
2. Rejects paths whose resolved prefix does not start with workdir (directory traversal)
3. Blocks known sensitive system paths: `/etc`, `/proc`, `/sys`, `/dev`, `/system`, `/windows`
4. Rejects directory paths (read only)

### Bash security
`isDangerous()` applies regex patterns: `rm -rf /`, `sudo`, `mkfs`, `dd if=`, fork bombs (`:(){ :|:& };:`), `>/dev/sda`, `chmod 777 /`

### Configuration priority
`loadConfig()` in `packages/cli/src/config.ts` merges in this order (earlier beats later):
1. `settings.json` (`~/.heiyun/settings.json`) — provider config, active model
2. CLI arguments (`--model`, `--api-key`, etc.)
3. Environment variables (`HEIYUN_CODE_*`)
4. Hardcoded defaults

### Environment variables
| Variable | Default | Purpose |
|---|---|---|
| `HEIYUN_CODE_API_BASE` | `https://api.deepseek.com/v1` | OpenAI-compatible API endpoint |
| `HEIYUN_CODE_API_KEY` | (required) | API authentication key |
| `HEIYUN_CODE_MODEL` | `deepseek-chat` | Model name |
| `HEIYUN_CODE_MAX_ROUNDS` | `50` | Max agent loop iterations |
| `HEIYUN_CODE_TEMPERATURE` | `0.7` | LLM temperature |
| `HEIYUN_CODE_SESSION_DIR` | `~/.heiyun/sessions` | JSONL session storage |

### Naming
- Chinese comments throughout (interfaces labeled `// === 消息 ===`, etc.)
- Error messages in Chinese (`"未知工具"`, `"用户中断"`, `"JSON 解析失败"`)
- Filenames: kebab-case (`tool-registry.ts`, `system-prompt.ts`, `status-bar.tsx`)

### Async patterns
- `async *generateStream()` — async generator for SSE streaming
- `for await...of` consumption
- `AbortSignal` passed through the entire stack (CLI → loop → fetch)
- Tool execution: `async function`, but session I/O is synchronous (`appendFileSync`, `readFileSync`)

### State management
- `OpenAIProvider`: mutable config (setModel, setApiKey, setApiBase) — no setter for maxTokens/temperature
- `Session`: append-only JSONL + in-memory `SessionNode[]` array; load replays from disk
- `ToolRegistry`: internal `Map<string, ToolHandler>`, builtins registered at construction
- CLI: React state via `useState` in ink components; TuiWrapper closure captures config

### Error handling
- Retry: 3 attempts with exponential backoff (1s, 2s) for network errors and 5xx; 4xx not retried
- Tool errors: caught and returned as `{ success: false }` — loop continues
- Abort: checked at round boundary; throws user-facing message
- Invalid SSE JSON: silently skipped (empty catch)

## Important Files

| File | Purpose |
|---|---|
| `packages/ai/src/types.ts` | All shared type definitions — edit with extreme care, affects all packages |
| `packages/ai/src/openai.ts` | `OpenAIProvider` — SSE streaming, retry, config |
| `packages/agent-core/src/loop.ts` | `agentLoop()` — core orchestration logic |
| `packages/agent-core/src/system-prompt.ts` | ~740 char system prompt in Chinese+English |
| `packages/agent-core/src/session.ts` | `Session` class — JSONL persistence |
| `packages/agent-core/src/tool-registry.ts` | Tool dispatch and registration |
| `packages/cli/src/main.ts` | CLI entry — commander setup, TUI mount |
| `packages/cli/src/config.ts` | `loadConfig()` — config merge logic |
| `packages/cli/bin/heiyun.js` | Node.js bin entry shim |
| `tsconfig.base.json` | Base TS config — all packages extend this |

## Runtime/Tooling Preferences

- **Runtime:** Node.js ≥ 20 (Web Streams API, `crypto.randomUUID`, `node:test` all available)
- **Package manager:** npm (workspaces)
- **Bundler:** tsup — all packages build via `tsup` with ESM output, declaration files, sourcemaps
- **TypeScript:** 5.9.3, `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
- **CLI framework:** commander for arg parsing, ink v5 (React 18) for terminal UI
- **No linter/formatter configured** — no ESLint, Prettier, or Biome
- **No CI/CD configured** — no GitHub Actions, GitLab CI, or similar
- **No runtime dependencies** in `@heiyun/ai` — pure fetch + Web Streams + Node built-ins
- **JSX only in CLI package** — `tsconfig.json` sets `"jsx": "react-jsx"` (only deviation from base config)

## Testing & QA

- **Framework:** Node.js built-in `node:test` (`describe`/`it` imported from `"node:test"`)
- **Assertions:** `node:assert/strict`
- **No mocking libraries** — tests manually mock `globalThis.fetch` and filesystem via `os.tmpdir()` + `fs.mkdtempSync()`
- **Test file convention:** co-located with source: `src/foo.test.ts` alongside `src/foo.ts`
- **Test commands:**
  - Per package: `node --test src/**/*.test.ts`
  - Single file: `node --test packages/ai/src/openai.test.ts`
  - With coverage (ai package): `node --test --experimental-test-coverage`
- **Test structure:** temp directory created in `before`/top of test, cleaned in `finally`/`after`
- **Test coverage:** 9 test files, 40+ test cases across all packages

### Test files inventory
| Package | Test file | Cases |
|---|---|---|
| ai | `openai.test.ts` | 4 (SSE text, SSE tool_call, 5xx retry, 4xx no-retry) |
| tools | `read.test.ts` | 5 (full read, offset+limit, missing file, traversal, sensitive path) |
| tools | `write.test.ts` | 4 (create, auto-dirs, overwrite, system path) |
| tools | `edit.test.ts` | 3 (unique match, 0-match, multi-match) |
| tools | `bash.test.ts` | 5 (stdout, stderr, exit code, danger cmd, sudo) |
| agent-core | `session.test.ts` | 3 (append, persistence, list) |
| agent-core | `tool-registry.test.ts` | 4 (builtins, execute, unknown, bad JSON) |
| cli | `config.test.ts` | 5 (defaults, CLI, env, CLI>env, settings>all) |
| cli | `settings.test.ts` | 6 (load, save, path, registry, fetchModels) |

## npm 发布

### 发布命令

```bash
# 构建并发布
npm run publish

# 先试运行，检查发布内容
npm run publish:dry
```

### 版本管理

```bash
# 手动 bump 版本
npm version patch -w packages/cli   # 0.1.0 → 0.1.1
npm version minor -w packages/cli   # 0.1.1 → 0.2.0
npm version major -w packages/cli   # 0.2.0 → 1.0.0
```

### 发布内容

`packages/cli/package.json` 中 `files` 字段定义了发布内容：
- `dist/` — 构建产物（tsup 打包，包含 `@heiyun/*` 内部包代码）
- `bin/` — CLI 入口
- `README.md`

### 本地测试发布效果

```bash
npm run build
npm link -w packages/cli
heiyun                    # 模拟用户安装后的体验
npm unlink -w packages/cli
```

### 重要须知

- `@heiyun/*` 内部包在 `devDependencies` 中，发布后用户不会安装它们
- `ink`、`react`、`commander`、`ink-text-input` 在 `dependencies` 中，安装时会自动下载
- npm 包名为 `@heiyun2169/heiyun`，需以 `@heiyun2169` 身份登录 npm 才能发布
- 使用 `publish:dry` 可以预览发布内容而不会真正上传

###
每次改动完帮我提交git
###
用中文和用户对话
