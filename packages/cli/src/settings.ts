import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/** 单个模型服务商配置 */
export interface ProviderConfig {
  apiBase: string;
  apiKey: string;
}

/** settings.json 顶层结构 */
export interface SettingsData {
  providers: Record<string, ProviderConfig>;
  activeProvider: string | null;
  activeModel: string | null;
}

/** 模型信息（用于 /model 列表展示） */
export interface ModelInfo {
  id: string;
  provider: string;
}

/** 服务商注册表项 */
export interface ProviderEntry {
  id: string;
  name: string;
  defaultApiBase: string;
}

/** 内置服务商注册表 */
export const PROVIDER_REGISTRY: ProviderEntry[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultApiBase: "https://api.deepseek.com/v1",
  },
];

/** settings.json 文件路径 */
export function settingsPath(): string {
  return path.join(os.homedir(), ".heiyun", "settings.json");
}

/** 加载 settings，文件不存在返回 null */
export function loadSettings(): SettingsData | null {
  const filePath = settingsPath();
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SettingsData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // 文件存在但损坏，输出警告
    console.error(`警告: ${filePath} 文件损坏，已忽略`, err instanceof Error ? err.message : "");
    return null;
  }
}

/** 保存 settings，自动创建父目录 */
export function saveSettings(data: SettingsData): void {
  const filePath = settingsPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/** 从 /v1/models 获取模型列表，过滤非 chat 类模型 */
export async function fetchModels(
  apiBase: string,
  apiKey: string,
  providerName: string,
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  const url = `${apiBase.replace(/\/$/, "")}/models`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  // 合并外部 signal
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

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
    clearTimeout(timeoutId);
  }

  if (response.status === 401 || response.status === 403) {
    const err = new Error("INVALID_API_KEY");
    (err as any).code = "INVALID_API_KEY";
    throw err;
  }

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as { data?: Array<{ id: string }> };
  const models = (json.data ?? []).map((m) => m.id);

  // 过滤非 chat 类模型
  const includeKeywords = ["chat", "reasoner", "v4"];
  const excludeKeywords = ["embedding", "moderation"];

  const filtered = models.filter((id) => {
    const lower = id.toLowerCase();
    const hasInclude = includeKeywords.some((kw) => lower.includes(kw));
    const hasExclude = excludeKeywords.some((kw) => lower.includes(kw));
    return hasInclude && !hasExclude;
  });

  return filtered
    .sort()
    .map((id) => ({ id, provider: providerName }));
}
