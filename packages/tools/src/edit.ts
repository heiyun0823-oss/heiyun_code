/**
 * @heiyun/tools — edit.ts
 * ========================
 * 文件编辑工具。通过在文件中查找精确文本并替换来实现局部修改。
 *
 * 核心设计：
 *   只做"精确字符串替换"（exact string replacement）。
 *   这比"按行号修改"更可靠，因为文件可能在两次读取之间被修改。
 *   也比"正则替换"更安全，因为 AI 生成的代码是精确的。
 *
 * 严格要求：old_string 必须在文件中匹配且唯一。
 *   - 匹配 0 处 → 报错（可能文件已被修改，先用 read 重新查看）
 *   - 匹配 1 处 → 执行替换 ✓
 *   - 匹配多处 → 报错（要求 AI 提供更多上下文使匹配唯一）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

/**
 * edit 工具的定义
 * 三个参数都是必填：path（文件路径）、old_string（要替换的文本）、new_string（替换后的文本）
 */
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

/** 路径安全检查（与 read.ts 中实现相同） */
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

/**
 * 执行文件编辑（精确字符串替换）
 *
 * 编辑流程：
 *   1. 验证 old_string 不为空
 *   2. 安全检查 & 读取文件
 *   3. 计频：计算 old_string 在文件中出现的次数
 *   4. 判断：0 次 → 报错；>1 次 → 报错；==1 次 → 继续
 *   5. 执行替换：String.replace() 只替换第一个匹配
 *   6. 写回文件
 */
export async function executeEdit(
  params: { path: string; old_string: string; new_string: string },
  ctx: { workdir: string; signal?: AbortSignal }
): Promise<ToolResult> {
  try {
    // 1. 验证 old_string 不为空（空字符串匹配任何内容，无意义）
    if (!params.old_string) {
      return { success: false, output: "", error: "old_string 不能为空" };
    }

    // 2. 安全检查 + 读取文件内容
    const filePath = resolveSafePath(params.path, ctx.workdir);
    const original = fs.readFileSync(filePath, "utf-8");

    // 3. 计算匹配次数
    // split(old_string) 按匹配文本切分数组，被切成 n 段说明匹配了 n-1 次
    const count = original.split(params.old_string).length - 1;

    // 4. 根据匹配次数做出判断
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

    // 5. 执行替换（只有一个匹配，安全替换）
    // String.replace() 默认只替换第一个匹配
    const updated = original.replace(params.old_string, params.new_string);
    // 6. 写回文件
    fs.writeFileSync(filePath, updated, "utf-8");

    return {
      success: true,
      output: `已编辑 ${params.path}：替换 ${count} 处`,
      metadata: { replacements: count },
    };
  } catch (err) {
    // 文件不存在错误（ENOENT）给友好提示
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
