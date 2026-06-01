import { spawn } from "node:child_process";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";
import { platform } from "node:os";

export const bashDefinition = {
  name: "bash",
  description: "Execute a shell command and return stdout and stderr.",
  parameters: {
    type: "object",
    description: "Parameters for executing a shell command",
    properties: {
      command: { type: "string", description: "要执行的命令" },
      workdir: { type: "string", description: "执行目录，覆盖会话 workdir" },
    },
    required: ["command"],
  } as import("@heiyun/ai").ToolParameter,
};

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /sudo\s/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\s*\(\s*\)\s*\{/,
  />\s*\/dev\/sda/,
  /chmod\s+777\s+\//,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}

export async function executeBash(
  params: { command: string; workdir?: string },
  ctx: { workdir: string; signal?: AbortSignal; timeoutMs?: number }
): Promise<ToolResult> {
  try {
    if (isDangerous(params.command)) {
      return {
        success: false,
        output: "",
        error: `危险命令被拒绝: ${params.command}`,
      };
    }

    const workdir = params.workdir
      ? path.isAbsolute(params.workdir)
        ? params.workdir
        : path.resolve(ctx.workdir, params.workdir)
      : ctx.workdir;

    const timeoutMs = ctx.timeoutMs ?? 120_000;
    const isWindows = platform() === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/bash";
    const shellArgs = isWindows ? ["/c", params.command] : ["-c", params.command];

    const startTime = Date.now();

    return new Promise<ToolResult>((resolve) => {
      const child = spawn(shell, shellArgs, {
        cwd: workdir,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
        signal: ctx.signal,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            output: `${stdout}\n\nstderr:\n${stderr}`,
            error: `命令执行超时 (${timeoutMs}ms)`,
            metadata: { exit_code: -1, duration_ms: duration },
          });
          return;
        }

        resolve({
          success: exitCode === 0,
          output: `stdout:\n${stdout}\n\nstderr:\n${stderr}\n\nexit code: ${exitCode}`,
          metadata: {
            exit_code: exitCode ?? -1,
            duration_ms: duration,
          },
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: "",
          error: err.message,
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
