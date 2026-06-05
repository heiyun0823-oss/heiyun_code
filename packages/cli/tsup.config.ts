/**
 * @heiyun/cli — tsup.config.ts
 * ============================
 * CLI 包的 tsup 构建配置。
 * 与 ai/tools/agent-core 的主要区别：
 *   - entry 指向 main.ts（CLI 入口）而非 index.ts
 *   - target: "node20" 指定最低 Node.js 版本
 *   - external: 排除 ink、react、commander、ink-text-input，
 *     这些是运行时依赖（用户安装时会自动下载），不需要打包进 dist
 *   - banner: 注入 require 兼容代码（某些库依赖 CJS require）
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],    // CLI 入口文件
  format: ["esm"],            // ES Module 格式
  dts: true,                  // 生成类型声明
  sourcemap: true,            // 源码映射
  clean: true,                // 构建前清空
  target: "node20",           // 目标 Node.js 版本
  // @heiyun/* 内部包会被 tsup 自动打包进 dist，
  // ink/react/commander 作为运行时依赖不打包
  external: ["ink", "react", "commander", "ink-text-input"],
  banner: {
    // 注入 CJS require 兼容代码：某些老库仍使用 CommonJS 模块系统
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
