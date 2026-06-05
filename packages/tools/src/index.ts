/**
 * @heiyun/tools — index.ts（工具包入口）
 * =======================================
 * 这个包提供四个文件系统和 Shell 操作工具。
 * 每个工具由两部分组成：
 *   - definition：告诉 LLM 这个工具叫什么、做什么、需要什么参数
 *   - execute 函数：实际执行工具逻辑的代码
 *
 * allTools 数组统一收集所有工具，供 ToolRegistry 批量注册。
 * "as const" 是 TypeScript 的断言，告诉编译器数组内容不会变，
 * 这样类型推断会更精确（推断为具体的字面量类型而非宽泛的 string）。
 */

import type { ToolResult } from "@heiyun/ai";
import { executeRead, readDefinition } from "./read.js";
import { executeWrite, writeDefinition } from "./write.js";
import { executeEdit, editDefinition } from "./edit.js";
import { executeBash, bashDefinition } from "./bash.js";

/**
 * 工具执行上下文
 * 所有工具在执行时都需要知道以下信息：
 *   - workdir：当前工作目录（所有相对路径都以此为基准）
 *   - signal：AbortSignal 中断信号（用户按 Ctrl+C 时传过来）
 *   - timeoutMs：命令执行超时时间（毫秒，只对 bash 工具有意义）
 */
export interface ToolContext {
  workdir: string;       // 工作目录绝对路径
  signal?: AbortSignal;  // 中断信号对象
  timeoutMs?: number;    // 超时毫秒数
}

/**
 * 所有内置工具的集合
 * 每个元素包含 definition（给 LLM 看的描述）和 execute（实际执行函数）
 */
export const allTools = [
  { definition: readDefinition, execute: executeRead },
  { definition: writeDefinition, execute: executeWrite },
  { definition: editDefinition, execute: executeEdit },
  { definition: bashDefinition, execute: executeBash },
] as const;
