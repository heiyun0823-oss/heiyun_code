# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Build & Test

```bash
# Install all dependencies (npm workspaces monorepo)
npm install

# Build all packages
npm run build

# Run all tests across all packages
npm test

# Run tests for a specific package
cd packages/ai && npm test
cd packages/tools && npm test
cd packages/agent-core && npm test
cd packages/cli && npm test

# Clean build artifacts
npm run clean
```

Tests use Node.js built-in test runner (`node --test`), not Jest/Vitest. Run a single test file:
```bash
node --test packages/ai/src/openai.test.ts
```

## Architecture

Heiyun Code is a monorepo (npm workspaces) with four packages:

```
@heiyun/ai          — LLM communication abstraction (OpenAI-compatible API via fetch + SSE)
@heiyun/tools       — Four primitive tools: read, write, edit, bash
@heiyun/agent-core  — Agent Loop + Session management (JSONL) + ToolRegistry
@heiyun/cli         — CLI entry point (commander) + ink TUI (React terminal UI)
```

**Dependency chain:** `ai` → `tools` → `agent-core` → `cli`

### @heiyun/ai (packages/ai)
- `types.ts` — Shared types: Message, ToolCall, ToolDefinition, GenerateRequest/Chunk, LLMProvider interface
- `openai.ts` — `OpenAIProvider` implementing `LLMProvider` with SSE streaming, tool call delta merging, retry (2 attempts on 5xx, no retry on 4xx)
- Defaults to DeepSeek API but works with any OpenAI-compatible endpoint

### @heiyun/tools (packages/tools)
- Four tools, each exporting `{name}Definition` and `execute{Name}`:
  - `read` — File reading with offset/limit, line-numbered output, path traversal protection
  - `write` — File creation with auto-creating parent directories
  - `edit` — Exact string replacement (must be unique match in file)
  - `bash` — Shell command execution, danger-command filter, timeout (default 120s)
- Path security: rejects traversal outside workdir, blocks system-sensitive paths (/etc, /proc, /sys, /dev)
- All tools return `ToolResult` JSON (`{ success, output, error?, metadata? }`)

### @heiyun/agent-core (packages/agent-core)
- `loop.ts` — `agentLoop()`: send messages → receive stream → if tool calls → execute → repeat (max 50 rounds)
- `session.ts` — `Session` class: append-only JSONL persistence, load/list support
- `tool-registry.ts` — `ToolRegistry`: register tools, convert to LLM tool definitions, dispatch execution
- `system-prompt.ts` — ~300-word system prompt directing agent behavior
- `types.ts` — SessionNode, LoopOptions, SessionMeta types

### @heiyun/cli (packages/cli)
- `main.ts` — Entry: commander arg parsing, ink TUI rendering, agent loop integration
- `config.ts` — Environment variable + CLI argument config loading
- `app.tsx` — Main ink component composing StatusBar + ChatView + InputBox
- `components/` — Three ink components: status-bar, chat-view (message display), input-box
- `bin/heiyun.js` — Node.js bin entry point

## Config

Environment variables (prefixed `HEIYUN_CODE_`):
- `HEIYUN_CODE_API_BASE` — API base URL (default: `https://api.deepseek.com/v1`)
- `HEIYUN_CODE_API_KEY` — API key (required)
- `HEIYUN_CODE_MODEL` — Model name (default: `deepseek-chat`)
- `HEIYUN_CODE_MAX_ROUNDS` — Max agent loop rounds (default: 50)
- `HEIYUN_CODE_TEMPERATURE` — Temperature (default: 0.7)
- `HEIYUN_CODE_SESSION_DIR` — Session storage directory (default: `~/.heiyun/sessions`)

## Key Design Decisions

- **Minimal tool set:** Only 4 primitive tools (read/write/edit/bash); complex operations delegated to bash
- **Model-driven:** No agent-side task planning — trust LLM's own reasoning
- **Linear sessions (MVP):** JSONL append-only, no DAG branching or compaction yet
- **SSE streaming:** Manual SSE line parser from ReadableStream, tool_call delta accumulation by index
- **All tools return ToolResult JSON** — consistent interface for LLM consumption
