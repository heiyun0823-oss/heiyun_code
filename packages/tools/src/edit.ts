import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

export const editDefinition = {
  name: "edit",
  description:
    "Perform exact string replacement in a file. Searches for old_string and replaces it with new_string.",
  parameters: {
    type: "object",
    description: "Parameters for editing a file",
    properties: {
      path: { type: "string", description: "文件路径" },
      old_string: { type: "string", description: "要替换的精确文本" },
      new_string: { type: "string", description: "替换后的文本" },
    },
    required: ["path", "old_string", "new_string"],
  } as import("@heiyun/ai").ToolParameter,
};

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

export async function executeEdit(
  params: { path: string; old_string: string; new_string: string },
  ctx: { workdir: string; signal?: AbortSignal }
): Promise<ToolResult> {
  try {
    if (!params.old_string) {
      return { success: false, output: "", error: "old_string 不能为空" };
    }

    const filePath = resolveSafePath(params.path, ctx.workdir);
    const original = fs.readFileSync(filePath, "utf-8");

    const count = original.split(params.old_string).length - 1;

    if (count === 0) {
      return {
        success: false,
        output: "",
        error: `未找到匹配文本。请用 read 工具确认文件内容后重试。`,
      };
    }

    if (count > 1) {
      return {
        success: false,
        output: "",
        error: `匹配到 ${count} 处，必须唯一匹配。请提供更多上下文使 old_string 唯一。`,
      };
    }

    const updated = original.replace(params.old_string, params.new_string);
    fs.writeFileSync(filePath, updated, "utf-8");

    return {
      success: true,
      output: `已编辑 ${params.path}：替换 ${count} 处`,
      metadata: { replacements: count },
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { success: false, output: "", error: `文件不存在: ${params.path}` };
    }
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
