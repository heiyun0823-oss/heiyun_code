/**
 * @heiyun/ai — tsup.config.ts
 * ============================
 * tsup 构建配置。tsup 是一个基于 esbuild 的 TypeScript 打包工具，
 * 速度快，配置简单。它把 TS 源码编译成可以在 Node.js 中直接运行的 JS 文件。
 *
 * 各选项含义：
 *   entry：入口文件，从 index.ts 开始，追踪所有 import 并打包
 *   format：输出模块格式。"esm" = ES Module，即使用 import/export 语法
 *   dts：是否生成 .d.ts 类型声明文件（给使用者提供类型提示）
 *   sourcemap：是否生成 .map 映射文件（调试时能看到 TS 源码而非编译后 JS）
 *   clean：构建前先清空 dist/ 目录
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],   // 从入口文件开始打包
  format: ["esm"],            // 输出 ES Module 格式
  dts: true,                  // 生成类型声明文件
  sourcemap: true,            // 生成源码映射
  clean: true,                // 构建前清空输出目录
});
