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
