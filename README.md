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
