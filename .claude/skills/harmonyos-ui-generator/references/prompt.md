# Prompt 模式与 JSON 裁剪策略

> 给 AI 后端组装 system/developer prompt 用。目标是让模型产出符合 ArkTS Visualizer 解析器的 `.ets`，同时控制上下文 token。

## system prompt 组装

按任务裁剪后拼接（不要全量灌）：

1. **角色**：你是 ArkUI 代码生成器，输出能被 ArkTS Visualizer 解析渲染的 `.ets`。
2. **组件目录**：只带本次任务涉及的组件 FieldSpec（从 catalog.md 摘取相关行）。
3. **保真规则**：fidelity.md 的「单位/颜色/默认对齐/容器尺寸」四节（裁掉枚举速查除非要用）。
4. **输出契约**：一个完整 `.ets` 文件，代码块标 `ets`，只一个 struct，不解释。

## JSON 裁剪（设计稿 → 代码）

设计稿 JSON（Figma / 设计工具）通常很大，直接灌模型会爆 token 且引入噪声。裁剪步骤：

1. **节点归一化**：每个设计稿节点只保留 `{ type, children, layout(box), style }`，删掉 id/prototyping/pluginData 等无关字段。
2. **坐标转相对**：绝对 (x,y,w,h) → 相对父的约束（`'100%'` / space / flex 对齐），只对 Stack/绝对定位保留 position。
3. **样式归类**：把样式原子聚合成 ArkUI 修饰符组（边框=border+borderRadius、阴影=shadow、渐变=linearGradient）。
4. **token 预算**：单次请求目标 < 8k token；超出就分层——先让模型出布局骨架（容器树），再逐子树填充。
5. **媒体引用**：图片资源转 `$r('app.media.<去扩展名>')`，由项目媒体表解析；未导入的留占位字符串。

## 用户消息模板（自然语言 → 页面）

```
页面：<用户描述>
设备：<vp 宽×高，如 360×780>
风格：<简述，如 圆角卡片/留白/主色 #0A59F7>
要求：用 Column/Row/Stack 等组合，单位 vp，颜色 AARRGGBB，交叉轴默认 Center。
输出一个完整 .ets（@Entry @Component struct + build()），只给代码。
```

## 用户消息模板（设计稿 JSON → 页面）

```
设计稿（裁剪后 JSON）：
<归一化节点树，带 box 与 style>

按组件映射规则转 .ets：
- 容器层 → Column/Row/Stack/Scroll/List/Grid
- px → vp（÷3）
- 颜色 → AARRGGBB
- 圆角/边框/阴影 → 对应修饰符
只输出 .ets 代码块。
```

## 流式与回退

- 后端用 stream:true 调 Claude API，前端逐 token 显示。
- 拿到完整代码后，正则提取第一个 ` ets ` 代码块 → `setCode()`。
- 若代码块缺 import/struct，前端解析失败会在代码窗报错；可在 system prompt 里强调「输出必须自包含完整结构」降低概率。
