import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

export const writeDefinition = {
  name: "write",
  description:
    "Create a new file or completely overwrite an existing file. Parent directories are created automatically.",
  parameters: {
    type: "object",
    description: "Parameters for writing a file",
    properties: {
      path: { type: "string", description: "文件路径" },
      content: { type: "string", description: "文件内容" },
    },
    required: ["path", "content"],
  } as import("@heiyun/ai").ToolParameter,
};

// Reuse path resolution from read.ts
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

export async function executeWrite(
  params: { path: string; content: string },
  ctx: { workdir: string; signal?: AbortSignal }
): Promise<ToolResult> {
  try {
    const filePath = resolveSafePath(params.path, ctx.workdir);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const buf = Buffer.from(params.content, "utf-8");
    fs.writeFileSync(filePath, buf);

    return {
      success: true,
      output: `写入 ${buf.length} 字节到 ${params.path}`,
      metadata: { bytes_written: buf.length },
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
