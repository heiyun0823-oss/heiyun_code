# Heiyun Code — MVP 设计文档

**版本**：v0.1.0  
**日期**：2026-06-01  
**状态**：设计阶段  
**关联需求**：[heiyun_code.md](../../heiyun_code.md)

---

## 一、架构决策记录 (ADR)

### ADR-1: Monorepo 分包策略

**决策**：采用 npm workspaces 的 4 包架构。

| 包名 | 职责 | 依赖 |
|------|------|------|
| `@heiyun/ai` | LLM 通信抽象层（类型定义 + OpenAI 兼容协议实现） | 无 |
| `@heiyun/tools` | 四个原语工具实现（read/write/edit/bash） | `@heiyun/ai` |
| `@heiyun/agent-core` | Agent Loop、Session 管理、ToolRegistry | `@heiyun/ai`, `@heiyun/tools` |
| `@heiyun/cli` | CLI 入口 + ink TUI 界面 | `@heiyun/agent-core`, `@heiyun/ai`, `@heiyun/tools` |

**理由**：
- 各层职责清晰，可独立开发和测试
- 后续扩展（如新增 Provider）只需替换 `@heiyun/ai`
- npm workspaces 零额外依赖，符合极简原则

### ADR-2: TUI 方案选择

**决策**：采用**方案 B（展开型）**——工具调用和结果带边框内联完整展示。

**理由**：
- 信息透明，便于调试和审查 Agent 行为
- 与 Claude Code 体验一致，降低用户学习成本
- 虽然是 MVP，但工具调用的可见性是核心体验

**备选方案 A（紧凑型）**：作为后续可选配置项，通过 `--compact` 标志切换。

### ADR-3: Session ID 格式

**决策**：使用 `crypto.randomUUID()` 生成的 UUID 标准格式字符串（如 `a1b2c3d4-e5f6-7890-abcd-ef1234567890`）。

**理由**：
- 零碰撞风险，无需额外查重
- Node.js ≥ 20 原生支持，无需依赖
- 标准格式便于后续与外部系统对接

### ADR-4: 会话存储路径

**决策**：统一使用 `~/.heiyun/sessions/` 目录存储 JSONL 会话文件。`~` 通过 `os.homedir()` 解析为绝对路径。

**理由**：
- 集中管理，不污染项目目录
- 符合 Unix XDG 规范惯例
- 跨项目恢复会话时路径一致

---

## 二、组件详细设计

### 2.1 @heiyun/ai — LLM 抽象层

**核心接口**：

```typescript
interface LLMProvider {
  generateStream(req: GenerateRequest): AsyncGenerator<GenerateChunk>;
}
```

**关键设计点**：

1. **SSE 流式解析**：手动解析 `data:` 行，无需第三方 SSE 库
2. **Tool Call Delta 合并**：按 `index` 分槽位累积 `function.arguments` 片段，在 `finish_reason: "tool_calls"` 时视为完整
3. **错误重试**：网络错误重试 2 次（1s/3s 退避），4xx 不重试
4. **配置来源优先级**：命令行参数 > 环境变量 > 默认值

**ToolResult 统一格式**：

```typescript
interface ToolResult {
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

### 2.2 @heiyun/tools — 工具实现

**路径安全模型**（两阶段校验）：

1. **路径解析**：相对路径基于会话 `workdir` 解析为绝对路径
2. **安全检查**：解析后路径必须在 `workdir` 子树内 + 硬编码拒绝系统敏感路径

系统敏感路径黑名单：`/etc`, `/proc`, `/sys`, `~/.ssh`, `~/.gnupg`, `/System`, `/Windows`

**read 工具**：
- 参数：`path` (string, required), `offset` (number, optional), `limit` (number, optional)
- 安全：最大 5000 行，拒绝读取目录
- 返回值：统一 `ToolResult` JSON

**write 工具**：
- 参数：`path` (string, required), `content` (string, required)
- 行为：自动创建父目录，全量覆盖
- 安全：拒绝系统路径

**edit 工具**：
- 参数：`path` (string, required), `old_string` (string, required), `new_string` (string, required)
- 匹配：精确字符串匹配，要求唯一匹配（0 次或 N>1 次均报错）
- 返回值：替换次数

**bash 工具**：
- 参数：`command` (string, required), `workdir` (string, optional)
- 超时：默认 120 秒
- 危险命令黑名单：`rm -rf /`, `sudo`, `chmod 777 /`, `dd if=`, `mkfs.`, `:(){ :|:& };:`
- Shell：Linux/macOS 用 `/bin/bash -c`，Windows 用 `cmd.exe /c`

### 2.3 @heiyun/agent-core — Agent 运行时

**Agent Loop 核心流程**：

```
1. 用户输入 → 追加到 session
2. 组装请求（system prompt + 历史 + 用户输入 + 工具定义）
3. 发送 LLM → 流式收集响应
4. 纯文本 → 追加到 session，返回给用户，结束
5. 工具调用 → 执行工具 → 追加结果到 session → 回到步骤 2
6. 终止条件：无工具调用 / 超过 max_rounds(50) / 用户中断
```

**Session 类设计**：

```typescript
class Session {
  id: string;
  filePath: string;  // sessions/{id}.jsonl
  private messages: SessionNode[];

  constructor(sessionDir: string, id?: string);
  append(node: Omit<SessionNode, "id" | "timestamp">): void;
  getMessages(): SessionNode[];
  toMessages(): Message[];
  static load(filePath: string): Session;
  static list(sessionDir: string): SessionMeta[];
}
```

**System Prompt**（~300 词，极简）：

- 角色声明：交互式编码代理 CLI
- 工具列表：简要描述 4 个工具
- 行为规则：读后编辑、小改 edit 大改 write、git/test/build 用 bash
- 输出要求：简洁、先推理再行动、完成后总结

**ToolRegistry**：

```typescript
class ToolRegistry {
  private tools: Map<string, ToolHandler>;
  register(handler: ToolHandler): void;
  getDefinitions(): ToolDefinition[];
  execute(toolCall: ToolCall): Promise<string>;
}
```

将 `ToolDefinition` 转换为 OpenAI function calling 格式（`type: "function"` wrapper）。

### 2.4 @heiyun/cli — CLI 与 TUI

**命令行参数**（commander 实现）：

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--model` | `-m` | `HEIYUN_CODE_MODEL` 或 `deepseek-chat` | 模型名称 |
| `--session` | `-s` | 无（新建） | 恢复会话 ID |
| `--list` | `-l` | - | 列出历史会话 |
| `--workdir` | `-d` | `cwd` | 工作目录 |
| `--max-rounds` | - | 50 | 最大工具调用轮次 |
| `--temperature` | - | 0.7 | 生成温度 |
| `--api-base` | - | `HEIYUN_CODE_API_BASE` 或 `https://api.deepseek.com/v1` | API 地址 |
| `--api-key` | - | `HEIYUN_CODE_API_KEY` | API 密钥 |
| `--version` | `-v` | - | 显示版本号 |
| `--help` | `-h` | - | 显示帮助 |

**界面语言**：CLI 帮助、TUI 状态栏、错误提示、工具输出说明均使用中文。System prompt 保留英文（仅 role/instruction 部分，输出指令要求 AI 用中文回复）。

**TUI 组件结构**（ink）：

```
<App>
  <StatusBar sessionId model workdir />   // 顶部状态栏
  <ChatView messages={messages} />        // 对话历史（可滚动）
  <InputBox onSubmit={handleSubmit} />    // 输入框
</App>
```

**核心状态流**：

```
InputBox.submit
  → App.handleSubmit(prompt)
    → agentLoop()
      → onText → 流式更新 ChatView 当前消息
      → onToolCall → 显示工具调用卡片
      → onToolResult → 显示工具结果卡片
    → agentLoop() 结束
    → 等待下一次用户输入
```

**工具调用卡片渲染**（展开型）：

每个工具调用渲染为带边框的卡片：
- 头部：工具名 + 参数摘要（蓝底）
- 主体：工具返回内容（代码用等宽字体）
- 底部：执行状态 + 元数据（绿底成功 / 红底失败）

---

## 三、数据流

```
用户输入 prompt
  → CLI (InputBox.onSubmit)
    → AgentLoop.loop(session, prompt)
      → 组装 GenerateRequest { model, messages, tools }
      → Provider.generateStream(req)
        → fetch(apiBase + "/v1/chat/completions", stream)
        → SSE 解析 → yield GenerateChunk
      ← 文本 → 流式输出到 ChatView → 结束
      ← 工具调用 → ToolRegistry.execute(tc)
        → 工具 handler (read/write/edit/bash)
        ← ToolResult JSON
      → 追加到 session → 继续循环
    ← 最终结果
  ← CLI 渲染结果
```

---

## 四、错误处理矩阵

| 错误场景 | 处理策略 | 是否终止循环 |
|----------|----------|:----------:|
| API 不可达 | 重试 2 次（1s/3s），仍失败提示检查网络 | ✓ |
| API 4xx | 显示具体错误，不重试 | ✓ |
| API 5xx | 重试 2 次，仍失败终止 | ✓ |
| Tool arguments JSON.parse 失败 | 返回错误含原始参数，LLM 自行修正 | ✗（继续） |
| read 文件不存在 | 返回 ToolResult 错误，LLM 修正路径 | ✗（继续） |
| edit 匹配 0 次 | 返回 ToolResult 错误，建议 LLM 用 read 确认 | ✗（继续） |
| edit 匹配 >1 次 | 返回 ToolResult 错误，建议用更大上下文 | ✗（继续） |
| bash 超时 | kill 进程，返回超时信息 | ✗（继续） |
| bash 非 0 退出 | 返回 stdout+stderr+exit code | ✗（继续） |
| max_rounds 超限 | 终止 + 提示 + 保存会话 | ✓ |
| 用户 Ctrl+C | 捕获 SIGINT → 保存会话 → 优雅退出 | ✓ |
| 路径穿越检测 | 拒绝执行，返回安全错误 | ✗（继续） |

---

## 五、测试策略

| 层级 | 测试类型 | 工具 | 覆盖目标 |
|------|----------|------|----------|
| `@heiyun/ai` | 单元测试 | node:test + mock fetch | SSE 解析正确性、Tool call 合并、错误重试逻辑 |
| `@heiyun/tools` | 单元测试 | node:test + tmp dir | 每个工具的正常/边界/安全校验路径 |
| `@heiyun/agent-core` | 单元测试 | node:test + mock provider | Agent Loop 逻辑、Session 读写、ToolRegistry |
| 端到端 | 集成测试 | 真实 API | 完整对话链路的自动化验证 |

---

## 六、开发阶段（与需求文档一致）

1. **项目骨架**（1-2 天）：monorepo + TS + build
2. **LLM 抽象层**（1-2 天）：类型 + OpenAI Provider + SSE
3. **工具实现**（1 天）：4 个工具 + ToolRegistry
4. **Agent 运行时**（2 天）：Loop + Session + 端到端测试
5. **CLI & TUI**（2-3 天）：commander + ink 组件
6. **联调与打磨**（1-2 天）：端到端 + 边界 + 文档

---

## 七、未决事项

| # | 事项 | 状态 |
|---|------|------|
| 1 | 对话压缩（compaction）作为升级点，MVP 不实现 | 已确认 |
| 2 | 多模型混合调用作为升级点 | 已确认 |
| 3 | DAG 分支会话，后续升级 | 已确认 |
| 4 | 紧凑型 TUI 视图作为可选配置 | 后续版本 |
| 5 | Docker 沙箱安全隔离 | 后续版本 |
