import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  // @heiyun/* 内部包会被 tsup 自动打包进 dist
  // ink/react/commander 作为 runtime 依赖，不被打包
  external: ["ink", "react", "commander", "ink-text-input"],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
