import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

export const readDefinition = {
  name: "read",
  description:
    "Read a file from the filesystem. Returns content in ToolResult JSON format.",
  parameters: {
    type: "object",
    description: "Parameters for reading a file",
    properties: {
      path: { type: "string", description: "文件路径，相对于当前工作目录" },
      offset: { type: "number", description: "起始行号，从 1 开始" },
      limit: { type: "number", description: "读取行数" },
    },
    required: ["path"],
  } as import("@heiyun/ai").ToolParameter,
};

export interface ToolContext {
  workdir: string;
  signal?: AbortSignal;
}

function resolveSafePath(inputPath: string, workdir: string): string {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workdir, inputPath);

  const normalizedWorkdir = path.resolve(workdir);
  if (!resolved.startsWith(normalizedWorkdir + path.sep) && resolved !== normalizedWorkdir) {
    throw new Error(`路径穿越被拒绝: ${inputPath}`);
  }

  const normalized = path.normalize(resolved).toLowerCase();
  const blockedPrefixes = ["/etc", "/proc", "/sys", "/dev", "/system", "/windows"];
  for (const bp of blockedPrefixes) {
    if (normalized.startsWith(bp) || normalized.includes(path.sep + bp.slice(1) + path.sep)) {
      throw new Error(`敏感路径被拒绝: ${resolved}`);
    }
  }

  return resolved;
}

export async function executeRead(
  params: { path: string; offset?: number; limit?: number },
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const filePath = resolveSafePath(params.path, ctx.workdir);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      return { success: false, output: "", error: `路径是目录: ${params.path}` };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const offset = params.offset ? Math.max(1, params.offset) : 1;
    const limit = params.limit ? Math.min(params.limit, 5000) : 5000;

    const startIdx = offset - 1;
    const sliced = lines.slice(startIdx, startIdx + limit);

    const resultText = sliced
      .map((line, i) => `${String(startIdx + i + 1).padStart(6, " ")}| ${line}`)
      .join("\n");

    return {
      success: true,
      output: resultText,
      metadata: {
        bytes_read: Buffer.byteLength(content, "utf-8"),
      },
    };
  } catch (err) {
    if (err instanceof Error) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, output: "", error: `文件不存在: ${params.path}` };
      }
      return { success: false, output: "", error: err.message };
    }
    return { success: false, output: "", error: String(err) };
  }
}
