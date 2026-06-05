/**
 * @heiyun/cli — settings.ts
 * =========================
 * settings.json 配置文件的管理模块。
 *
 * settings.json 存储了用户的持久化配置：
 *   - 有哪些 API 服务商（providers）及其密钥
 *   - 当前激活的服务商和模型
 *
 * 文件位置：~/.heiyun/settings.json
 *
 * 示例内容：
 *   {
 *     "providers": {
 *       "deepseek": { "apiBase": "https://api.deepseek.com/v1", "apiKey": "sk-xxx" }
 *     },
 *     "activeProvider": "deepseek",
 *     "activeModel": "deepseek-chat"
 *   }
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/** 单个模型服务商的配置 */
export interface ProviderConfig {
  apiBase: string;  // API 基础 URL
  apiKey: string;   // API 密钥
}

/** settings.json 文件的顶层结构 */
export interface SettingsData {
  providers: Record<string, ProviderConfig>;  // 服务商列表（名称 → 配置）
  activeProvider: string | null;               // 当前使用的服务商
  activeModel: string | null;                  // 当前使用的模型
}

/** 模型信息（用于 /model 命令的列表展示） */
export interface ModelInfo {
  id: string;        // 模型标识，如 "deepseek-chat"
  provider: string;  // 所属服务商，如 "deepseek"
}

/** 服务商注册表项（内置的服务商信息） */
export interface ProviderEntry {
  id: string;              // 服务商标识，如 "deepseek"
  name: string;            // 显示名称，如 "DeepSeek"
  defaultApiBase: string;  // 默认 API 地址
}

/** 内置服务商注册表 */
export const PROVIDER_REGISTRY: ProviderEntry[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultApiBase: "https://api.deepseek.com/v1",
  },
];

/** 获取 settings.json 的完整文件路径：~/.heiyun/settings.json */
export function settingsPath(): string {
  return path.join(os.homedir(), ".heiyun", "settings.json");
}

/**
 * 加载 settings.json 文件
 *
 * @returns 解析后的配置对象，文件不存在时返回 null
 *
 * ENOENT = Error NO ENTry，即"文件或目录不存在"的系统错误码。
 * 如果文件存在但 JSON 解析失败（损坏），会输出警告并返回 null。
 */
export function loadSettings(): SettingsData | null {
  const filePath = settingsPath();
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SettingsData;  // as 是 TS 的类型断言
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // 文件不存在，这是正常情况（首次运行）
      return null;
    }
    // 文件存在但内容损坏
    console.error(`警告: ${filePath} 文件损坏，已忽略`, err instanceof Error ? err.message : "");
    return null;
  }
}

/**
 * 保存 settings.json 文件
 * 自动创建不存在的父目录（~/.heiyun/）。
 *
 * JSON.stringify(data, null, 2)：
 *   第二个参数 null 表示不过滤字段。
 *   第三个参数 2 表示缩进 2 个空格（美化输出，方便用户手动编辑）。
 */
export function saveSettings(data: SettingsData): void {
  const filePath = settingsPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 从 API 的 /v1/models 端点获取可用模型列表
 * 用于 /model 命令的下拉选择列表。
 *
 * API 返回的是所有模型（包括 embedding、moderation 等非 chat 模型），
 * 我们需要过滤出 chat 类模型。
 *
 * 过滤逻辑：
 *   - 包含关键词：chat、reasoner、v4（这些是聊天/推理模型）
 *   - 不包含关键词：embedding、moderation（这些不是聊天模型）
 *
 * @param apiBase — API 基础地址
 * @param apiKey — API 密钥
 * @param providerName — 服务商名称
 * @param signal — 可选的 AbortSignal（用于取消请求）
 * @returns 过滤后的模型列表
 *
 * 错误处理：
 *   401/403 → 密钥无效，抛出带 code="INVALID_API_KEY" 的错误
 *   其他错误 → 直接抛出
 *   超时 → 5 秒超时自动中断
 */
export async function fetchModels(
  apiBase: string,
  apiKey: string,
  providerName: string,
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  // 去掉 URL 末尾的 /（如果有的话），再拼接 /models
  const url = `${apiBase.replace(/\/$/, "")}/models`;

  // 创建超时控制器：5 秒后自动中断请求
  // AbortController 是用来"取消"异步操作的对象
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  // 合并外部 signal：如果外部取消了，也中断我们的请求
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  // 发送 GET 请求
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);  // 无论成功还是失败，清除超时定时器
  }

  // 401 = Unauthorized（未授权），403 = Forbidden（禁止访问）
  // 都是因为 API 密钥不正确
  if (response.status === 401 || response.status === 403) {
    const err = new Error("INVALID_API_KEY");
    (err as any).code = "INVALID_API_KEY";  // 自定义错误码，供上层识别
    throw err;
  }

  // 其他错误状态码
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  // 解析响应 JSON
  const json = (await response.json()) as { data?: Array<{ id: string }> };
  const models = (json.data ?? []).map((m) => m.id);

  // 过滤非 chat 类模型
  const includeKeywords = ["chat", "reasoner", "v4"];
  const excludeKeywords = ["embedding", "moderation"];

  const filtered = models.filter((id) => {
    const lower = id.toLowerCase();
    // 必须包含至少一个 include 关键词
    const hasInclude = includeKeywords.some((kw) => lower.includes(kw));
    // 不能包含任意 exclude 关键词
    const hasExclude = excludeKeywords.some((kw) => lower.includes(kw));
    return hasInclude && !hasExclude;
  });

  // 按字母排序后返回
  return filtered
    .sort()
    .map((id) => ({ id, provider: providerName }));
}
