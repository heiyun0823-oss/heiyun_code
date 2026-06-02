# Logo 组件设计规格

日期: 2026-06-02
状态: 已批准

## 概述

在 CLI 启动后，标题栏上方显示一个双线框包围的 "HEIYUN" 文字，带有霓虹轮转彩虹动画效果。

## 功能需求

1. 双线框（╔══╗ / ╚══╝ 风格）包裹 logo 文字
2. 文字逐字着色，颜色随时间从左向右轮转（霓虹轮转）
3. 文字内容可通过 prop 自定义，默认 "HEIYUN"
4. 框宽自动适配文字长度
5. 组件卸载时清理定时器

## 非功能需求

- 动画流畅，不阻塞 UI 渲染
- 组件自包含，不侵入其他模块
- 为后续配置化预留接口

## 架构

### 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `packages/cli/src/components/logo.tsx` | Logo 组件 |
| 修改 | `packages/cli/src/app.tsx` | 插入 `<Logo />` 到 StatusBar 上方 |

### Logo 组件接口

```ts
interface LogoProps {
  text?: string;   // 默认 "HEIYUN"
  speed?: number;  // 动画间隔 ms，默认 200
}
```

### 调色板

```ts
const RAINBOW = [
  "#ff0000", // 红
  "#ff8800", // 橙
  "#ffff00", // 黄
  "#00cc00", // 绿
  "#0088ff", // 蓝
  "#cc44ff", // 紫
];
```

### 动画逻辑

```
offset 每 speed ms +1，第 i 个字符颜色 = RAINBOW[(i + offset) % 6]

t=0:  H(#f00) E(#f80) I(#ff0) Y(#0c0) U(#08f) N(#c4f)
t=1:  H(#c4f) E(#f00) I(#f80) Y(#ff0) U(#0c0) N(#08f)
...
```

使用 `useEffect` + `setInterval`，cleanup 返回 `clearInterval`。

### 渲染输出示例

```
╔══════════════╗
║  H E I Y U N  ║
╚══════════════╝
```

- 四角: `╔ ╗ ╚ ╝`
- 横边: `═` × (文字长度 + 4)
- 竖边: `║`
- 文字左右各 2 空格留白
- 字母间 1 空格

### App 集成

在 `App` 组件的 `<Box flexDirection="column">` 中，StatusBar 之前插入：

```tsx
<Logo text={logoText} />
```

`logoText` 当前硬编码为 `"HEIYUN"`，后续可通过 `AppProps` → `config` 链路配置化。

## 测试

- 组件渲染快照：验证框结构、文字内容
- 动画：验证 offset 随时间递增
- 自定义 text prop：验证框宽随文字长度自适应
- 卸载清理：验证定时器被清除

## 后续扩展（不在本规格范围）

- `settings.json` 中 `logoText` 字段
- `--logo <text>` CLI 参数
- `HEIYUN_CODE_LOGO` 环境变量
