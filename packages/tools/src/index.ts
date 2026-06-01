import type { ToolResult } from "@heiyun/ai";
import { executeRead, readDefinition } from "./read.js";
import { executeWrite, writeDefinition } from "./write.js";
import { executeEdit, editDefinition } from "./edit.js";
import { executeBash, bashDefinition } from "./bash.js";

export interface ToolContext {
  workdir: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const allTools = [
  { definition: readDefinition, execute: executeRead },
  { definition: writeDefinition, execute: executeWrite },
  { definition: editDefinition, execute: executeEdit },
  { definition: bashDefinition, execute: executeBash },
] as const;
