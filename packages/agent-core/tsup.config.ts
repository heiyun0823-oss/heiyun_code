/**
 * @heiyun/agent-core — tsup.config.ts
 * ====================================
 * tsup 构建配置。详见 @heiyun/ai/tsup.config.ts 中的注释说明。
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
