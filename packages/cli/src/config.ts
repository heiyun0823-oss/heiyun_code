/**
 * @heiyun/cli — config.ts
 * ========================
 * 配置加载模块。负责从多个来源读取配置，按优先级合并。
 *
 * 配置优先级（从高到低）：
 *   1. settings.json（用户编写的配置文件 ~/.heiyun/settings.json）
 *   2. CLI 命令行参数（--model gpt-4 --api-key sk-xxx）
 *   3. 环境变量（HEIYUN_CODE_*）
 *   4. 硬编码默认值
 *
 * 优先级为什么这样排列？
 *   配置文件的优先级最高，因为它代表了用户的"持久化偏好"。
 *   命令行参数次之（运行时临时覆盖）。
 *   环境变量再次之（用于 CI/CD 等自动化场景）。
 *   默认值兜底（防止什么都没配）。
 *
 * 空值合并运算符（??）：
 *   a ?? b 表示"如果 a 不是 null 或 undefined，用 a；否则用 b"。
 *   这和 || 的区别：?? 只把 null/undefined 视为空，
 *   而 || 会把 0、""、false 也视为空。
 */

import * as os from "node:os";
import * as path from "node:path";
import { loadSettings } from "./settings.js";

/**
 * 展开 ~ 符号为用户主目录
 * 例如 "~/.heiyun/sessions" → "/home/user/.heiyun/sessions"
 * Node.js 不会自动展开 ~，需要手动处理。
 */
function expandHome(p: string): string {
  if (p.startsWith("~")) {
    // os.homedir() 返回当前用户的主目录路径
    // p.slice(1) 去掉开头的 ~，保留后面的路径
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/** CLI 配置的数据结构 */
export interface CliConfig {
  apiBase: string;        // API 地址
  apiKey: string;         // API 密钥
  model: string;          // 模型名称
  maxRounds: number;      // 最大循环轮次
  temperature: number;    // 生成温度
  sessionDir: string;     // 会话存储目录
  workdir: string;        // 工作目录
  sessionId?: string;     // 要恢复的会话 ID（可选）
}

/**
 * 加载合并配置的主函数
 * @param cliArgs — 命令行参数（由 commander 解析后传入）
 * @returns 合并后的完整配置
 */
export function loadConfig(cliArgs: {
  apiBase?: string;
  apiKey?: string;
  model?: string;
  maxRounds?: string;
  temperature?: string;
  workdir?: string;
  session?: string;
}): CliConfig {
  // 加载 settings.json
  const settings = loadSettings();

  // 工作目录：CLI 参数指定的 > 当前进程目录
  const workdir = cliArgs.workdir
    ? path.resolve(cliArgs.workdir)   // resolve 将路径转为绝对路径
    : process.cwd();                  // process.cwd() = 当前终端所在目录

  // 获取当前 active 的 provider 配置
  // provider 是"模型服务商"的意思，如 DeepSeek、OpenAI
  const activeProvider = settings?.activeProvider ?? null;
  const providerConfig =
    activeProvider && settings?.providers[activeProvider]
      ? settings.providers[activeProvider]
      : null;

  // 逐字段按优先级合并
  return {
    // API 地址：settings.json 优先级最高
    apiBase:
      providerConfig?.apiBase ??
      cliArgs.apiBase ??
      process.env.HEIYUN_CODE_API_BASE ??
      "https://api.deepseek.com/v1",

    // API 密钥：settings.json 优先级最高
    apiKey:
      providerConfig?.apiKey ??
      cliArgs.apiKey ??
      process.env.HEIYUN_CODE_API_KEY ??
      "",

    // 模型名：settings.json 优先级最高
    model:
      settings?.activeModel ??
      cliArgs.model ??
      process.env.HEIYUN_CODE_MODEL ??
      "",

    // 最大轮次：CLI 参数优先级最高
    // parseInt(str, 10) 将字符串转为整数（10 表示十进制）
    maxRounds: cliArgs.maxRounds
      ? parseInt(cliArgs.maxRounds, 10)
      : parseInt(process.env.HEIYUN_CODE_MAX_ROUNDS ?? "50", 10),

    // 温度：CLI 参数优先级最高
    temperature: cliArgs.temperature
      ? parseFloat(cliArgs.temperature)    // parseFloat 转为浮点数
      : parseFloat(process.env.HEIYUN_CODE_TEMPERATURE ?? "0.7"),

    // 会话目录
    sessionDir: expandHome(
      process.env.HEIYUN_CODE_SESSION_DIR ?? "~/.heiyun/sessions"
    ),

    workdir,
    sessionId: cliArgs.session,
  };
}
