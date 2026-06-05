# Heiyun Code 学习指导文档 — 设计方案

**日期**：2026-06-06  
**状态**：设计中  
**目标读者**：具备基础 JS 知识、对 TS 和项目不熟悉的开发者

---

## 一、目标

在 `guide/` 目录下生成 6 份中文 Markdown 学习文档，帮助读者由浅入深理解 Heiyun Code 项目架构，同时学习 TypeScript。

## 二、文档清单与阅读顺序

```
00 项目概览（站在门外看全貌）
  ↓
01 TS 速览（拿起放大镜看语言工具）
  ↓
02 核心模块（深入四大包的代码细节）
  ↓
03 辅助模块（补齐周边支撑系统）
  ↓
04 数据流（把散点串成完整链路）
  ↓
05 疑问与路线（查漏补缺 + 未来方向）
```

| # | 文件 | 主题 | 预估字数 | 核心结构 |
|---|------|------|:--:|------|
| 00 | `guide/00-项目整体概览.md` | 项目是什么、解决什么问题、目录结构、启动流程 | ~800 | 一句话定位 → 功能拆解 → 目录树注释 → 依赖关系图 → 启动链路 |
| 01 | `guide/01-TypeScript基础知识速览.md` | 结合项目代码讲解 TS 核心特性，每个特性附 JS 对比 | ~2000 | 按特性逐一：定义 → 项目位置(路径+行号) → JS 对比 |
| 02 | `guide/02-项目核心模块详解.md` | 四大包（ai / tools / agent-core / cli）逐模块分析 | ~3000 | 每包：职责 → 文件清单 → 核心类/函数 → 逐段解读 → 调用关系 |
| 03 | `guide/03-辅助模块详解.md` | ContextManager / Logger / TokenCounter / 斜杠命令 / 配置系统 | ~2000 | 同上结构，覆盖 5 个子模块 |
| 04 | `guide/04-数据流与状态管理.md` | 完整数据链路 + React 状态管理设计 | ~1500 | 一条用户输入走完全链路 → 每环节文件+代码位置 → 状态管理解析 |
| 05 | `guide/05-常见疑问与学习路线.md` | 5-8 个常见困惑 + 学习路线建议 | ~1500 | 困惑列表 → 逐个解答 → JS→TS 过渡路线 → 进阶资源 |

## 三、内容规范

- **语言**：中文撰写，代码/技术术语保留英文
- **代码块**：标注语言（`typescript`、`bash`、`text`）
- **文件路径**：全部使用项目根目录的相对路径
- **代码定位**：每条讲解标注 `路径 + 行号范围或函数名`
- **JS 对比**：文档 01 中每个 TS 特性都附带等价的 JS 写法，指出 TS 改进点
- **Mermaid 流程图**：模块调用关系、数据流使用 mermaid 图表
- **详细程度**：假设读者只有 JS 基础，TS 和项目完全陌生

## 四、覆盖的 TS 特性清单

以下特性将在文档 01 中逐一讲解（点到为止，不深入边角语法）：

| 特性 | 项目典型位置 |
|------|------------|
| `interface` 接口 | `packages/ai/src/types.ts` 全篇 |
| `type` 类型别名 + 联合类型 `\|` | `packages/ai/src/types.ts` L12 |
| `export` / `import type` | `packages/ai/src/index.ts` L1-2 |
| `class` 与 `implements` | `packages/ai/src/openai.ts` L3 |
| 泛型 `Map<K, V>` / `Promise<T>` | `packages/agent-core/src/tool-registry.ts` L11 |
| `async *` 异步生成器 | `packages/ai/src/openai.ts` L50 |
| `??` / `?.` 空值合并与可选链 | `packages/ai/src/openai.ts` L19-22 |
| `Omit<>` 工具类型 | `packages/agent-core/src/session.ts` L15 |
| `as const` 常量断言 | `packages/tools/src/index.ts` L13-18 |
| `enum` 字面量联合（无真实 enum） | `packages/agent-core/src/types.ts` L6 |
| `Readonly` 与类型推导 | 各 tsconfig / 函数签名 |
| `AbortSignal` 类型的跨层传递 | `packages/cli/src/main.ts` → loop → fetch |

## 五、未纳入文档的内容

以下内容暂不覆盖，读者入门后自行探索：
- 单元测试代码（`*.test.ts`）
- tsup 构建配置细节
- npm 发布流程
- ink 框架本身的 API 细节

## 六、执行方式

每份文档完成后立即提交 git；所有文档写完后统一审阅。
