/**
 * @heiyun/ai — index.ts（包的入口文件）
 * =======================================
 * 这是 @heiyun/ai 包的"桶文件"（barrel file），
 * 把包内所有公开的类型和类统一从这里导出。
 * 其他包只需 import ... from "@heiyun/ai" 就能拿到所有内容。
 *
 * export * from：重新导出（re-export）某个模块的所有导出。
 * export { X } from：按名称重新导出指定的符号。
 */

// 导出 types.ts 中的所有类型定义
export * from "./types.js";

// 导出 OpenAI 兼容 API 的 Provider 实现类
export { OpenAIProvider } from "./openai.js";
