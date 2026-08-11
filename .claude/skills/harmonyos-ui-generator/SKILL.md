---
name: harmonyos-ui-generator
description: 高保真设计稿/自然语言 → ArkUI（HarmonyOS 声明式 UI）代码生成。封装 ArkUI 组件目录、IR 节点 schema、保真规则（vp 单位/颜色通道/默认对齐）与设计稿→ArkTS 的 prompt 模式。在生成 ArkTS UI 代码、做组件映射/属性转换/布局解析、或把设计稿/Figma JSON 转 ArkUI 时使用。
---

# HarmonyOS UI Generator

把高保真设计稿（或自然语言描述）转成能被 **ArkTS Visualizer** 解析渲染的 ArkUI `.ets` 代码。

## 何时用

- 用户描述想要一个界面，要生成 ArkTS 代码并在画布同步渲染。
- 给定设计稿 JSON（Figma / 设计工具）或截图，要做组件映射 + 属性转换 + 布局解析，产出 `.ets`。
- 现有 `.ets` 要做保真度优化（单位/颜色/默认对齐对齐真机）。

## 核心原则（决定成败）

1. **输出是 `.ets` 文本，不是结构化 JSON。** ArkTS Visualizer 有完整的 `parse → IR → render → serialize` 闭环；你只要产出符合其解析器的 `.ets`，`setCode()` 一调画布自动同步。不要自己发明 IR。
2. **只用收录的组件类型。** 见 `references/catalog.md`。用未收录类型会变成灰底占位卡片（不崩，但不保真）。容器有子类型约束（List 只收 ListItem、Grid 只收 GridItem、Tabs 只收 TabContent），违反会被落点校验拦截。
3. **保真 = 和真机语义一致，不是和设计稿像素一致。** 关键规则见 `references/fidelity.md`：单位 vp（不是 px）、颜色 AARRGGBB、Column/Row 交叉轴默认 Center、滚动容器默认占满交叉轴、Stack 尺寸 = 最大子节点。
4. **JSON 裁剪策略：** 给上游模型的上下文要按需裁剪——只带当前任务涉及的组件 FieldSpec + 用到的修饰符枚举，不要把全量 registry 灌进去。见 `references/prompt.md`。

## 工作流

### A. 自然语言 → 页面
1. 读 `references/catalog.md` 选合适的容器/基础组件组合。
2. 按 `references/fidelity.md` 的单位与默认值生成 `.ets`。
3. 输出**一个完整可解析文件**：`import` + `@Entry @Component struct` + `build()`。不要省略 import、不要给伪代码。
4. 调用方会用 `setCode(code)` 喂进画布；解析失败会在代码窗报错，所以代码必须能过解析器（合法 ArkTS 声明式 DSL）。

### B. 设计稿 JSON → 页面
1. 识别设计稿里的容器层级 → 映射到 Column/Row/Stack/Scroll/List/Grid。
2. 逐节点属性转换：设计稿 px → vp（÷ 设备 dpi×160，或近似 ÷3 若 dpi≈480）；颜色 hex → AARRGGBB；圆角/边框/阴影 → 对应修饰符。
3. **裁剪输入**：把设计稿 JSON 压缩成「节点类型 + 几何 + 关键样式」的最小集合再喂模型（去掉冗余 token、绝对坐标转相对布局）。
4. 产出 `.ets`，保留结构层级与视觉一致。

### C. 输出契约
- 代码块语言标记 `ets`。
- 文件首行可带 `// AI-GEN` 注释，但不要包裹解释性长注释。
- 一个响应只产出一个 struct（多页面让用户分次请求）。

## 参考文件

- `references/catalog.md` —— 组件目录（裁剪自 registry/specs.ts：类型/分类/容器性/子类型约束/构造参数/常用修饰符/枚举值）
- `references/fidelity.md` —— 保真规则（单位换算、颜色通道、默认对齐、容器尺寸语义）
- `references/prompt.md` —— prompt 模板与 JSON 裁剪策略（给 AI 后端组装 system prompt 用）
