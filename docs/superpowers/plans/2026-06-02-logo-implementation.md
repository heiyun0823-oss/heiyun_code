# Logo 组件实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 CLI 启动后 StatusBar 上方渲染双线框包围的彩虹霓虹轮转 "HEIYUN" logo

**Architecture:** 新增自包含 `Logo` 组件，用 `useEffect` + `setInterval` 驱动调色板轮转。在 `App` 组件 StatusBar 前插入一行。不修改其他组件。

**Tech Stack:** React 18, ink v5, TypeScript 5.9

---

### Task 1: 创建 Logo 组件

**Files:**
- Create: `packages/cli/src/components/logo.tsx`
- Create: `packages/cli/src/components/logo.test.tsx`

- [ ] **Step 1: 写出测试（先失败）**

创建 `packages/cli/src/components/logo.test.tsx`：

```tsx
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";
import { Logo } from "./logo.js";

describe("Logo", () => {
  it("renders default HEIYUN text in a box frame", () => {
    const { lastFrame } = render(<Logo />);
    const output = lastFrame();
    assert.ok(output?.includes("HEIYUN"), "should contain HEIYUN");
    assert.ok(output?.includes("╔"), "should have top-left corner");
    assert.ok(output?.includes("╗"), "should have top-right corner");
    assert.ok(output?.includes("╚"), "should have bottom-left corner");
    assert.ok(output?.includes("╝"), "should have bottom-right corner");
    assert.ok(output?.includes("║"), "should have vertical borders");
    assert.ok(output?.includes("═"), "should have horizontal borders");
  });

  it("adapts frame width to custom text", () => {
    const { lastFrame } = render(<Logo text="AB" />);
    const output = lastFrame();
    assert.ok(output?.includes("AB"), "should contain custom text");
    // 2 chars + 4 padding = 6 horizontal bars
    const topLine = output?.split("\n").find(l => l.includes("╔"));
    assert.ok(topLine, "should have top border line");
    // frame should be narrower than default
    assert.ok((topLine?.length ?? 0) < 20, "frame should be narrow for 2-char text");
  });

  it("cleans up interval on unmount", () => {
    const { unmount } = render(<Logo />);
    unmount();
    // no leak — if timer wasn't cleaned, process would hang
    // Verified by: no uncaught timer after test completes
  });
});
```

> 注意：ink-testing-library 可能不可用。若未安装，则用以下纯逻辑测试代替：

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RAINBOW } from "./logo.js";
describe("Logo (unit)", () => {
  it("RAINBOW palette has 6 colors", () => {
    assert.equal(RAINBOW.length, 6);
  });

  it("colorForChar cycles with offset", () => {
    const colorForChar = (i: number, offset: number) =>
      RAINBOW[(i + offset) % RAINBOW.length];
    assert.equal(colorForChar(0, 0), RAINBOW[0]);
    assert.equal(colorForChar(0, 1), RAINBOW[1]);
    assert.equal(colorForChar(5, 0), RAINBOW[5]);
    assert.equal(colorForChar(5, 1), RAINBOW[0]); // wraps
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**
```bash
cd packages/cli && node --test src/components/logo.test.tsx
```
预期：FAIL — 文件不存在或组件未导出
- [ ] **Step 3: 实现 Logo 组件**

创建 `packages/cli/src/components/logo.tsx`：

```tsx
import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";

export const RAINBOW = [
  "#ff0000", // 红
  "#ff8800", // 橙
  "#ffff00", // 黄
  "#00cc00", // 绿
  "#0088ff", // 蓝
  "#cc44ff", // 紫
];

interface LogoProps {
  text?: string;
  speed?: number;
}

export const Logo: React.FC<LogoProps> = ({ text = "HEIYUN", speed = 200 }) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setOffset((prev) => prev + 1);
    }, speed);
    return () => clearInterval(id);
  }, [speed]);

  const chars = text.split("");
  const innerWidth = text.length + 4; // 左右各2空格
  const topBorder = `╔${"═".repeat(innerWidth)}╗`;
  const bottomBorder = `╚${"═".repeat(innerWidth)}╝`;

  return (
    <Box flexDirection="column">
      <Text>{topBorder}</Text>
      <Box>
        <Text>║  </Text>
        {chars.map((ch, i) => {
          const colorIndex = (i + offset) % RAINBOW.length;
          return (
            <Text key={i} color={RAINBOW[colorIndex]}>
              {ch}{" "}
            </Text>
          );
        })}
        <Text> ║</Text>
      </Box>
      <Text>{bottomBorder}</Text>
    </Box>
  );
};
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd packages/cli && node --test src/components/logo.test.tsx
```
预期：PASS（若无 ink-testing-library，则先安装：`cd packages/cli && npm install --save-dev ink-testing-library`）

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/components/logo.tsx packages/cli/src/components/logo.test.tsx
git commit -m "feat: add Logo component with rainbow animation"
```

---

### Task 2: 集成到 App

**Files:**
- Modify: `packages/cli/src/app.tsx`

- [ ] **Step 1: 在 App 中导入并插入 Logo**

修改 `packages/cli/src/app.tsx`：

在文件顶部 import 区加一行：

```tsx
import { Logo } from "./components/logo.js";
```

在 `<StatusBar ... />` 之前插入 `<Logo />`：

```tsx
// 修改前 (app.tsx L68-69):
    <Box flexDirection="column" padding={0}>
      <StatusBar sessionId={sessionId} model={model} workdir={workdir} />

// 修改后:
    <Box flexDirection="column" padding={0}>
      <Logo />
      <StatusBar sessionId={sessionId} model={model} workdir={workdir} />
```

- [ ] **Step 2: 构建验证**

```bash
cd packages/cli && npm run build
```
预期：编译通过，无类型错误

- [ ] **Step 3: 全局构建验证**

```bash
npm run build
```
预期：所有包编译通过

- [ ] **Step 4: 提交**

```bash
git add packages/cli/src/app.tsx
git commit -m "feat: integrate Logo component above StatusBar"
```

---

### Task 3: 端到端验证

- [ ] **Step 1: 运行全部测试**

```bash
npm test
```
预期：所有已有测试通过，新增 logo 测试通过

- [ ] **Step 2: 手动启动验证**

```bash
node packages/cli/bin/heiyun.js --help
```
预期：看到帮助信息，logo 在交互模式下渲染

- [ ] **Step 3: 提交（如有修改）**

```bash
git add -A && git commit -m "chore: final verification after logo integration"
```
