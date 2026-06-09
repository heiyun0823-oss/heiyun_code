# Heiyun Code

交互式 AI 编码代理 CLI 工具。

Heiyun Code 是一个运行在终端中的 AI 编程助手，可以理解你的自然语言指令并帮你读写文件、执行命令、修改代码。

![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![npm](https://img.shields.io/npm/v/@heiyun2169/heiyun)

## 安装

```bash
npm install -g @heiyun2169/heiyun
```

## 快速开始

```bash
# 设置 API 密钥（以 DeepSeek 为例）
export HEIYUN_CODE_API_KEY=your-api-key

# 启动交互会话
heiyun
```

启动后，你就可以用自然语言向 Heiyun 描述你的需求了。

## 功能特性

- **智能文件操作**：读取、写入、编辑文件，支持精确的文本替换
- **Shell 命令执行**：运行任意 Shell 命令，实时显示输出结果
- **上下文管理**：自动滑动窗口和 LLM 摘要压缩，防止超出上下文限制
- **流式渲染优化**：使用 Static 组件消除闪烁，提供流畅的交互体验
- **会话持久化**：JSONL 格式保存会话历史，支持恢复和继续对话
- **调试日志**：详细的 JSONL 日志记录，便于排查问题
- **个性化界面**：水墨像素风 Logo 和呼吸动画，状态栏显示版本信息

## 使用

```bash
heiyun                    # 新建交互会话
heiyun -s <id>            # 恢复指定会话
heiyun -l                 # 列出历史会话
heiyun -d /path/to/project  # 指定工作目录
heiyun -m deepseek-chat   # 指定模型
heiyun --help             # 查看帮助
```

## 交互命令

在 TUI 中输入 `/` 会显示可用命令列表：

| 命令 | 说明 |
|------|------|
| `/login` | 配置 API 登录（选择服务商并输入密钥） |
| `/model` | 选择模型 |
| `/new` | 开启新对话 |
| `/resume` | 恢复历史对话 |
| `/compact` | 手动触发上下文压缩（生成对话摘要） |

使用 ↑↓ 键浏览，Tab 键自动补全，Enter 键执行。

### Shell 命令输出

当 AI 调用 `bash` 工具执行 Shell 命令时，命令的输出会直接显示在聊天界面中，格式如下：

```
$ 命令内容
命令输出结果
```

这让你能实时看到命令执行的结果，无需额外操作。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HEIYUN_CODE_API_BASE` | `https://api.deepseek.com/v1` | API 地址 |
| `HEIYUN_CODE_API_KEY` | - | API 密钥 |
| `HEIYUN_CODE_MODEL` | `deepseek-chat` | 模型名称 |
| `HEIYUN_CODE_MAX_ROUNDS` | `50` | 最大工具调用轮次 |
| `HEIYUN_CODE_TEMPERATURE` | `0.7` | 生成温度 |
| `HEIYUN_CODE_SESSION_DIR` | `~/.heiyun/sessions` | 会话存储目录 |

## 开发者

本项目是 npm workspaces 单仓库，包含 4 个包：

```text
@heiyun/ai           → LLM 通信层
@heiyun/tools        → 文件系统与 Shell 工具
@heiyun/agent-core   → Agent 循环与会话管理
@heiyun/cli          → CLI 入口与 TUI
```

本地开发：

```bash
git clone <repo>
cd heiyun-code
npm install
npm run build
# 本地测试
npm link -w packages/cli
heiyun
```

### 调试日志

Heiyun Code 会自动生成 JSONL 格式的调试日志，记录所有工具调用过程：

- **日志位置**：`~/.heiyun/logs/heiyun-YYYYMMDD-HHmmss.log`
- **日志内容**：工具调用参数、执行结果、耗时、错误信息等
- **用途**：排查问题、分析 AI 行为、优化提示词

日志文件是只追加的，不会覆盖历史记录。

## License

MIT
