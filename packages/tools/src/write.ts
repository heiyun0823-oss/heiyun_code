/**
 * @heiyun/tools — write.ts
 * =========================
 * 文件写入工具。让 AI 能够创建新文件或完全重写已有文件。
 *
 * 功能：
 *   1. 创建新文件（自动创建不存在的父目录）
 *   2. 完全覆盖已有文件（注意：不是追加，是整个替换）
 *
 * 安全措施：与 read 工具相同的路径安全检查
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolResult } from "@heiyun/ai";

/**
 * write 工具的定义（给 LLM 看的）
 * path 和 content 都是必填参数
 */
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

/**
 * 路径安全检查（与 read.ts 中的实现完全相同）
 * 这里复写了一份，避免工具之间产生循环依赖。
 * 如需修改安全策略，请同时修改 read.ts、edit.ts、write.ts 中的同名函数。
 */
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
 * 执行文件写入
 *
 * 写入流程：
 *   1. 安全检查：验证路径在工作目录内
 *   2. 创建父目录：mkdirSync recursive=true 自动创建不存在的目录层级
 *   3. 编码内容：Buffer.from() 将字符串转为 UTF-8 字节
 *   4. 写入文件：writeFileSync 完整覆盖（不是追加）
 *
 * 注意：这个工具是"全量覆盖"而非"追加"。
 * 如果需要局部修改，应该使用 edit 工具。
 */
export async function executeWrite(
  params: { path: string; content: string },
  ctx: { workdir: string; signal?: AbortSignal }
): Promise<ToolResult> {
  try {
    // 1. 路径安全检查
    const filePath = resolveSafePath(params.path, ctx.workdir);

    // 2. 确保父目录存在
    // path.dirname 获取目录部分："src/utils/foo.ts" → "src/utils"
    const dir = path.dirname(filePath);
    // { recursive: true } 自动创建所有不存在的父级目录（类似 mkdir -p）
    fs.mkdirSync(dir, { recursive: true });

    // 3. 将内容编码为 UTF-8 字节（Buffer 是 Node.js 中表示二进制数据的类型）
    const buf = Buffer.from(params.content, "utf-8");
    // 4. 写入文件（同步操作，会覆盖已有文件的内容）
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
