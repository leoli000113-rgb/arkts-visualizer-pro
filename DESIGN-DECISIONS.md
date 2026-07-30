# ArkTS UI 可视化编辑器 · 设计决策文档

> 本文档随"拷问"过程持续更新。所有重大决策以 ADR 形式记录，待决问题显式列出。
> 项目根目录：`C:\Users\l30080326\Desktop\ArkTS-UI-Visualizer`

---

## 0. 项目一句话（草稿，待定）
一个网页工具：导入 ArkTS 代码 → 渲染出 UI → 可视化拖拽/点击修改 UI → ArkTS 代码实时同步；精确适配 Mate 80 Pro Max / Pura X Max / Mate X7（1px 精度）。

## 1. 已定决策

### ADR-001 · ArkTS 渲染技术路径
- **上下文**：浏览器原生不认识 ArkTS（HarmonyOS 声明式 UI 语言）。要"生成 UI 界面"必须解决解析+渲染问题。
- **备选方案**：
  1. 服务端跑 HarmonyOS Previewer/模拟器并桥接到 Web —— 成本极高，官方 Previewer 未对 Web 开放。
  2. 自研有限 ArkTS 子集解析器 + Web 端 ArkUI-lite 组件库（ArkTS→HTML/CSS/组件的转译+自渲染）。
  3. 接入华为官方对外开放的 ArkUI Preview API（若存在）。
- **决策**：采用方案 2。
- **理由**：可控、可扩展、可解耦；不依赖华为未公开能力；可在 Web 上自主演进。
- **约束**：v1 锁定一个可控的 ArkTS 子集；架构必须满足"可扩展 + 解耦"，以便后续增量加语法/组件。
- **代价（已知 tradeoff）**：永远只能覆盖 ArkTS 的一个子集；与官方 ArkUI 行为可能存在语义偏差，需自行对齐。

### ADR-002 · v1 最小子集（由 `sample.ets` 反推）
- **验收靶子**：`sample.ets` 能被正确解析+渲染，v1 核心即通过。
- **覆盖项**：
  - 声明：`@Entry` / `@Component` / `struct` / `build()`
  - 状态：`@State`（string / number 基本类型）
  - 组件：`Column` `Row` `Stack` `RelativeContainer` `Text`
  - 链式修饰符：`width` `height` `padding` `margin` `backgroundColor` `justifyContent` `alignItems` `alignContent` `fontSize` `fontColor` `alignRules` `id`
  - 值类型：string(`'100%'`) / number(`60`) / hex(`0xRRGGBB`) / 对象(`{top:12,left:8}`) / 枚举(`FlexAlign.SpaceBetween` `VerticalAlign.Center` `Alignment.Center` `HorizontalAlign.Start/End`)
- **理由**：用户原始需求=三布局（线性/层叠/相对）。v1 必须是能在一个迭代内交付的最薄垂直切片。

### ADR-002b · 北极星目标全景（由 `sample_full.ets` 定义，非 v1）
- **布局**：线性 `Row/Column` · 层叠 `Stack` · 相对 `RelativeContainer` · 弹性 `Flex`
- **容器**：列表 `List/ListItem/ForEach` · 网格 `Grid/GridItem` · 滚动 `Scroll`
- **基础组件**：文本 `Text` · 按钮 `Button` · 图片 `Image` · 视频 `Video` · 蒙版（半透明遮罩层，用 `Stack` 实现）
- **表单**：输入框 `TextInput` · 开关 `Toggle` · 滑块 `Slider` · 复选框 `Checkbox` · 单选框 `Radio`
- **导航**：标签页 `Tabs/TabContent`
- **反馈**：弹窗（条件渲染对话框 + 蒙版） · 进度条 `Progress`（Linear/Circular）
- **范围警告**：此全景 ≈ ArkUI 主体，绝不能当 v1。必须分期（见 Q4）。

### ADR-003 · 设备规格与 vp/px 转换模型
- **核心事实**：vp 是设备无关单位，**1 vp = 1/160 英寸**，与具体设备 dpi 无关。dpi 只决定"一个屏幕有多少物理像素"（即 `screenW_vp = round(screenW_px × 160 / dpi)`），不改变 vp 的物理大小。
- **Web 渲染换算**：1 vp = 0.6 CSS px（因 96 CSS px = 1 英寸，160 vp = 1 英寸 → 1 vp = 96/160 = 0.6 CSS px）。此比率为**常数**，不随设备变化。
- **"1px 精度"重定义**：渲染逻辑与真机 vp 布局一致、误差 0 vp；物理像素级还原在浏览器不可达（浏览器拿不到物理屏）。
- **设备档案**：`devices.json`，数据驱动非硬编码。初版填入估算规格（⚠️ 待用华为开发者官网数据校准）。
- **折叠屏**：`Pura X Max`（翻盖式 clamshell）、`Mate X7`（书本式 book）各含 `unfolded`/`folded` 两套尺寸；UI 需支持状态切换。
- **可编辑**：应用内提供"设备档案"编辑窗口，用户可随时修改 dpi / 像素尺寸 / vp 派生。

### ADR-004 · v1 范围锁定（Phase 0 + 部分 Phase 1）
- **v1 包含**：
  - 组件：`Text` `Button` `Image` + 布局 `Row` `Column` `Stack` `RelativeContainer`（弹性 `Flex` 搁置，移出 v1）
  - 修饰符：基础集 + `Button.type/onClick/stateEffect` + `Image.objectFit`
  - 设备：`Mate 80 Pro Max`（直板）+ **`Mate X7`（书本折叠屏，含 folded/unfolded 状态切换）**——折叠态切换是核心功能，必须在 v1
  - 编辑闭环：拖拽改 `width/height`、点击改 `text/backgroundColor` → ArkTS 代码实时回写
  - 导入渲染 + 单文件
- **v1 不含**：`Flex`、`List/Grid/Scroll`、`ForEach`、表单 5 件、`Tabs`、`Video`、蒙版、弹窗、`Progress`、`Pura X Max`、设备档案编辑窗口（devices.json 直接改文件）
- **分期路线图**：
  - Phase 1：`Flex` + `Pura X Max` + 设备档案编辑窗口
  - Phase 2：容器 `List/Grid/Scroll` + `ForEach`
  - Phase 3：表单 + `Tabs`
  - Phase 4：`Video`/蒙版/弹窗/`Progress`
- **理由**：用户坚持 Button/Image 为高频必需、折叠态切换为核心。砍掉 Flex 与其余容器/表单，保住端到端闭环可在 v1 交付。

### ADR-005 · 代码回写架构（AST/IR 为唯一真相源）
- **架构**：`ArkTS 代码 → 解析 → IR（内存语法树）→ 渲染 UI`；反向 `拖拽/点击改 UI → 改 IR 节点 → 序列化 IR → 代码文本`。IR 是唯一真相，代码文本与 UI 都是 IR 的"视图"。
- **回写保真度**：**有损规范化**。序列化按我们的规范格式（缩进/顺序/引号风格统一）输出；用户手写的原始格式与注释**不保留**。理由：无损保留需维护原始 token 流，复杂度×3，v1 不可行。
- **解析器选型（修订）**：Q5 初提 tree-sitter；**修订为自研递归下降解析器（TypeScript）**。理由：我们拥有 IR 且接受有损重生成，tree-sitter 的强项（任意代码增量解析）用不上、且其"从 AST 重生成文本"能力弱；自研解析器对 v1 微小子集可行、可学、无原生/WASM 依赖、且仍可模块化扩展。
- **同步时机**：UI 在拖拽过程中实时更新（React 重渲廉价）；代码文本窗在 drag-end 或防抖 150ms 后刷新，避免每像素刷屏。离散编辑（点击改 text/color）立即回写。
- **代价**：用户改完代码→重新解析→IR 重建（若用户手改了格式，会被规范化）。

### ADR-006 · 技术栈与部署形态
- **部署形态**：纯前端静态站点，**无后端**。代码导入=浏览器 FileReader/粘贴；解析+IR+渲染+回写全在浏览器内；`devices.json` 打包进站点。零部署零运维。
- **技术栈**：React 18 + Vite + TypeScript。
  - 拖拽：`@dnd-kit`（可访问性好、命中可靠）。
  - 状态：IR 存于轻量 store（Zustand）；代码文本=IR 的派生视图（变更后重序列化）。
  - 渲染：每个 IR 节点类型对应一个 React 组件；按 1 vp = 0.6 CSS px 渲染。
- **理由**：核心交互=拖拽，React 侧 `@dnd-kit` 成熟；TS 类型系统为 IR/AST 结构化数据挡 bug；资料最多适合菜鸟。用户无框架偏好，默认 React。
- **后续若需后端**（保存项目/多用户）在 Phase 之后再加，届时以独立服务接入、不污染前端。

### ADR-007 · v1 可视化编辑动作清单（全功能版）
- **编辑能力（v1 全含）**：
  1. 选中（click → 高亮 + 属性面板）
  2. 改文本（Text/Button 的 text）
  3. 拖拽改尺寸（width/height，vp↔0.6CSSpx 映射）
  4. 改背景色（backgroundColor）
  5. 改字号（fontSize）
  6. 删除节点（Delete）
  7. **从组件面板拖入新增组件**——**全功能落点语义**：inside / before / after 三态落点判定，精确插入到目标下标
  8. **拖拽重排子组件顺序**——**含跨容器搬运**（从 Column 拖到 Stack）
- **落点判定**：基于鼠标坐标与目标节点包围盒的相对位置计算 inside/before/after；需视觉落点指示线。
- **面板**：v1 的 7 种组件可拖（Text/Button/Image/Row/Column/Stack/RelativeContainer）；新节点带合理默认值。
- **代价（用户已认）**：落点三态判定 + 跨容器搬运是 v1 最难两块，工期显著；v1 交付时间后移。菜鸟单人需有心理预期。
- **后续 Phase 才做的**：精确下标已在 v1；后续仅扩面板组件种类与更复杂嵌套规则。

### ADR-008 · 导入超范围/非法 ArkTS 的行为
- **超范围语法**（用了 v1 不支持的节点，如 `ForEach`/`Video`/`@Builder`/自定义 `@Component`）：**方案 2 = 部分渲染 + 占位框**。支持的节点正常渲染可编辑；不支持的节点渲染成带标签占位框（如"⚠️ ForEach 暂不支持编辑"），并原样保留进 IR、序列化时原样吐回（不丢节点）。
- **语法错误**（真解析失败，非超范围）：报错 + 定位行列，不渲染（无法渲染）。
- **理由**：真实代码几乎必含超范围语法；部分渲染+占位让用户照样导入、照样改能改的部分，且明示边界不骗人。

### ADR-009 · v1 验收门槛（端到端一遍打通即交付）
1. 导入 `sample.ets` → 渲染 线性/层叠/相对 三布局 + Text/Button/Image，默认 Mate 80 Pro Max 视口
2. 切 Mate X7 → 视口变 unfolded；切 folded → 视口再变（vp 换算准确）
3. 面板拖 Button 到某 Row 的 before 位 → 代码出现新节点，顺序正确
4. 拖 Text 右边缘改宽 → 代码 `width` 值变（vp），UI 实时跟
5. 同 Row 内 B 拖到 A 前 → 代码顺序交换；跨容器 Column→Stack → 代码节点搬家
6. 点改 text/backgroundColor → 代码字符串同步
7. 全程代码窗=IR，无静默丢节点、无格式错乱 → **v1 通过**
- **最难两块**：第 3、5 步（落点三态 + 跨容器搬运），通了即成。

### ADR-010 · 持久化
- v1 用 `localStorage` 自动存最近一次"导入代码 + 编辑后的 IR + 当前设备/折叠态"，刷新不丢。
- 纯前端、无后端，无用户体系；多项目/多用户是 Phase 之后。

### ADR-011 · 交付与运维
- dev：`vite dev` 本地起站。
- prod：`vite build` 产出纯静态站，可丢任意静态托管（GitHub Pages / 本地直接开）。
- 无密钥、无后端、无 CI 必需；无告警需求（静态站）。

## 3. 决策树状态：✅ 已收尾
全部产品/架构主枝已定。剩余仅 tech-lead 实现细节（落点坐标映射、IR schema、解析器错误恢复），开发时随写随定，无需再拷问。

## 4. 对话流水
- **Q1（渲染路径）** → A：选方案 2，要求可扩展+解耦。用户自述菜鸟，技术细节 tech lead 决，产品/范围用户拍板。
- **Q2（子集边界/真实样本）** → A：用户无真实文件，tech lead 生成覆盖三布局样本。已写入 `sample.ets`（v1 靶子）、`sample_full.ets`（北极星全景）。反推 ADR-002/002b。
- **Q3（1px 精度 / 设备规格）** → A：按 dpi 做 vp↔px 转换、先填后改、估算待校准。已落 ADR-003 + `devices.json`。关键澄清：vp=1/160 英寸为常数，dpi 仅决定屏幕 vp 维度。
- **Q4（范围爆炸 / v1 切片）** → A：v1 = Phase 0 + Button/Image + Mate X7 折叠态；Flex 搁置；其余容器/表单/反馈移出 v1。ADR-004。
- **Q5（回写架构）** → A：路 A（AST/IR 为真相源）+ 有损规范化。ADR-005，解析器改自研递归下降、同步=drag-end/防抖。
- **Q6（技术栈）** → A：纯前端无后端；React + Vite + TS。ADR-006。
- **Q7（编辑动作清单）** → A：6 条基础上追加"面板拖入新增"+"拖拽重排"。
- **Q8（新增/重排成本折中）** → A：拒 scoped 折中，要全功能（精确插入+跨容器）。ADR-007，代价已认。
- **Q9（导入超范围代码）** → A：方案 2，部分渲染+占位+原样保留。ADR-008。
- **Q10（验收门槛）** → A：认 7 步端到端测试为 v1 交付门槛。ADR-009。

## 5. v1 构建规格速览（蓝本）

**一句话**：纯前端 React 站，导入 `.ets` → 自研解析器成 IR → IR 渲染成手机视口里的 UI → 拖拽/点击改 IR → IR 序列化回代码文本；适配 Mate 80 Pro Max + Mate X7（折叠态切换）。

**技术栈**：React 18 + Vite + TypeScript；`@dnd-kit` 拖拽；Zustand 存 IR；`devices.json` 设备档案。

**核心数据流**：
```
.ets 文本 ──parse──▶ IR ──render──▶ React DOM（手机视口，1vp=0.6CSSpx）
                        │
                        ▼
                   mutate（选中/拖拽/点击）
                        │
                        ▼
                   serialize ──▶ 代码文本窗（派生视图）
```

**v1 组件支持**：Text/Button/Image + Row/Column/Stack/RelativeContainer（无 Flex）。
**v1 修饰符**：width/height/padding/margin/backgroundColor/justifyContent/alignItems/alignContent/fontSize/fontColor/alignRules/id + Button(type/onClick/stateEffect) + Image(objectFit)。
**v1 编辑**：选中/改文本/拖改尺寸/改色/改字号/删除/面板拖入新增(before/inside/after)/同父与跨容器重排。
**v1 设备**：Mate 80 Pro Max（直板）+ Mate X7（folded/unfolded 切换）。
**单位换算**：1 vp = 0.6 CSS px（常数）；`screenW_vp = round(screenW_px × 160 / dpi)`。

## 6. 工程骨架建议（待你点头再生成）

```
ArkTS-UI-Visualizer/
├─ DESIGN-DECISIONS.md      ← 本文档（蓝本）
├─ sample.ets               ← v1 验收靶子
├─ sample_full.ets          ← 北极星全景
├─ devices.json             ← 设备档案（估算，待校准）
└─ app/                     ← Vite 工程根（待 scaffold）
   ├─ src/
   │  ├─ parser/            ← .ets → IR（自研递归下降；含错误恢复+占位节点）
   │  ├─ ir/                 ← IR schema + mutate + serialize
   │  ├─ renderer/           ← IR 节点 → React 组件（ArkUI-lite）
   │  ├─ editor/             ← 画布/属性面板/组件面板/落点判定/拖拽编排
   │  ├─ devices/            ← 读 devices.json + vp↔px 换算 + 折叠态
   │  ├─ store/              ← Zustand：IR、当前设备/折叠态、选中节点
   │  └─ App.tsx
   ├─ public/
   └─ vite.config.ts
```

## 7. 实现进度

**工程已 scaffold 并实测通过**（`app/`，`npm install` 已完成，`tsc --noEmit` 干净，`vite build` 通过）。

文件实况：
- `src/parser/{tokenizer,parser}.ts` — 递归下降解析器 `.ets → IR`（覆盖 v1 子集；含 ctorArgs/对象/枚举/hex/嵌套 alignRules）
- `src/ir/{types,mutate,serialize,defaults}.ts` — IR schema、`getNodeAtPath/updateNodeAtPath/removeNodeAtPath/insertChildAtPath/setModifier/getModifier/numModifier/samePath`、序列化器、新节点默认值
- `src/renderer/Renderer.tsx` + `resize.ts` + `RelativeContainer.tsx` — IR→React（ArkUI-lite）、选中高亮、尺寸把手、pointer 拖拽→IR mutate、**RelativeContainer 约束求解引擎**
- `src/editor/dnd.ts` — pointer DnD：palette 新增 + 节点移动（阈值判定 + 落点三态 + 跨容器）
- `src/devices/{devices.ts,devices.json}` — 设备档案 + vp↔CSSpx（0.6）+ 折叠态
- `src/store/store.ts` — Zustand：code/ir/error/device/fold/selectedPath/dropTarget + mutateNode/removeNode/insertChild/moveNode + localStorage 持久化
- `src/App.tsx` — 顶栏（导入/设备/折叠）+ 组件面板 + 画布 + 属性面板 + 代码窗

验收门槛对账（ADR-009）：
- [x] 1. 导入 `sample.ets` → 渲染 线性/层叠/相对 三布局 + 代码窗（实测通过）
- [x] 2. Mate X7 展开 969×864 / 折叠 419×950 vp，视口切换正确（实测通过）
- [x] 3. 面板拖入新增组件（before/inside/after）——实测：Button 拖到 Row 顶部=before 插入；Column 拖到根空隙=inside 追加末子，落点指示线/框均显示
- [x] 4. 拖 Text 右边缘改宽 → 代码 `width` 值变（vp），UI 实时跟
- [x] 5. 同父重排 + 跨容器搬运 ——实测：Row 内"中"拖到"左"前（左,中,右→中,左,右）；"左"从 Row 搬到根 Column 作兄弟（Row 后、Stack 前）
- [x] 6. 点改 text/backgroundColor → 代码同步（实测：`Text('中')`→`Text('中中')`）
- [x] 7. 代码窗=IR 派生视图，无静默丢失（架构已立；实测 moveNode 无丢节点）

**v1 验收：7/7 全通过 ✅**（ADR-009 全绿）。最难两块（落点三态 + 跨容器搬运）已通。

**DnD 实现要点**：放弃 HTML5 DnD（headless/合成事件不触发 React 回调、DataTransfer 不可靠），改用 pointer 事件全链路（palette 节点 onPointerDown→startNewDrag；已存在节点 onPointerDown→beginMaybeMove 阈值判定→startMoveDrag；window pointermove 用 `elementsFromPoint` 命中 `[data-path]` 节点算 before/inside/after；pointerup→performDrop）。与 resize 同套 pointer 机制，page.mouse 可靠驱动。

**RelativeContainer 相对布局引擎（已完成，像素级精准）**：`renderer/RelativeContainer.tsx`。解析每个子节点的 `alignRules`（left/right/top/bottom，anchor = `__container__` 或兄弟 `.id()`，align = Start/Center/End·Top/Center/Bottom）+ `.margin`（vp×0.6）做约束求解；兄弟锚定时拓扑迭代解析；双边规则（left+right）拉伸宽度；用 `useLayoutEffect`+`ResizeObserver` 在容器尺寸变化（设备/折叠切换）时重排。关键坑：① 子节点 `.margin` 必须只被引擎消费（`noMargin` 剥离 CSS margin，否则双重施加）；② wrapper 用 `display:flex` 消除 inline-block 行框半行距；③ 自然尺寸量 firstElementChild.getBoundingClientRect 而非 wrapper.offsetHeight（避行高膨胀）。实测锚点 offset=8.2csspx（=1 border+7.2 margin）、兄弟间距=4.8csspx（=8vp×0.6），与 vp→0.6 换算精确一致。

**下一迭代目标**（v1 已达标，以下是打磨 / Phase 推进）：
- Stack 被叠盖子节点的穿选 / 层级大纲树
- Phase 1：Flex + Pura X Max + 设备档案编辑窗口
- Phase 2+：容器 List/Grid/Scroll、表单、Tabs、Video/蒙版/弹窗/Progress

**已知待办（非 v1 阻塞）**：
- Stack 子节点绝对叠放，被后绘子节点盖住的早期子节点难以点中（编辑器需补"层级/大纲树"或穿选）；暂可用点击可见边角绕过。
- 设备规格为估算值，待用华为开发者官网数据校准 `devices.json`。
- RelativeContainer 引擎暂不处理"双锚点拉伸宽度"场景下子节点 width:100% 自适应填充（sample 无此用例，后续按需补）。

## 8. 全量化迭代（2026-07-21，Phase 1-4 全量落地）

v1 之后一次性推进到北极星全景，全部完成。测试 39/39 绿（parser 10 + renderer 3 + store 26）、typecheck 零错误、build 通过。

### 解析器全面增强（`parser/tokenizer.ts`、`parser/parser.ts`、`ir/serialize.ts`）
- **IR 约定不变形状**：`if(cond){...}` → `{type:'If', ctorArgs:[raw 含括号条件], children}`；`else/else if` → `{type:'Else'}` 兄弟节点；`ForEach(items,(item)=>{...},keyGen?)` → `{type:'ForEach', ctorArgs:[数据源, raw 参数, keyGen?], children:模板体}`；`Unknown`（unsupported:true）占位节点原文保留。
- **表达式容错**：字符串拼接/三元/二元/一元/模板字符串（tokenizer 新增 backtick）/数组字面量/`$r(...)` 资源调用/箭头函数（修掉了 captureBalanced 对 ForEach 回调的误截断）统一捕获为 `{t:'raw'}` 原样回吐，不求值不丢失；raw 重建带智能空格（函数调用/泛型/成员点不加空格）。
- **@State**：泛型类型 `Array<string>`、任意初始化表达式；@Builder/普通方法整段跳过（编辑超范围，ADR-008）。
- **错误恢复**：children 级 try/catch → `recoverUnknown`（吞原文、识别新组件起点、吞残留修饰符链），保证不崩不丢。
- 序列化器对 If/Else/ForEach/Unknown 按 ArkTS 原语法特判输出；往返幂等有测试锁定。

### 渲染器扩展（`renderer/` 拆分为 shared/containers/forms/feedback/flow 多文件，SUPPORTED 25 种）
- 新增 Flex/Scroll/List/ListItem/Grid/GridItem/Tabs/TabContent（预览可真实切换标签）/TextInput/Toggle/Slider/Checkbox/Radio（表单预览交互只动本地 state，不改 IR）/Progress(Linear+Circular SVG)/Video 占位。
- If：条件为 false 字面量或对应 @State 布尔初值 false 时折叠为占位徽标，否则渲染 children+「if」角标；Else 由 visibleChildren 配对渲染。
- ForEach：数据源可静态求值时（@State 数组字面量/内联数组，无 eval 小解析）逐项渲染模板并做 `'item'`/`'G'+i` 级变量替换；实例 wrapper `display:contents` 使 gap/grid 直接生效且编辑落回模板；不可求值时 ×3 + 角标。
- styleOf 补 fontWeight/textAlign/maxLines/layoutWeight/opacity/border/Button.type/stateEffect/Stack alignContent 九宫格。

### 编辑器 UX（App.tsx 重写 + editor/ 新增 OutlineTree/PropertyPanel/DeviceEditor）
- **大纲树**：递归 IR 树（类型+摘要），点击选中与画布双向联动（scrollIntoView），可拖拽移出到画布——Stack 叠放节点穿选问题解决。
- **撤销/重做**：past/future IR 快照栈（cap 50），Ctrl+Z/Y/Shift+Z + 顶栏按钮 + Delete 删节点（输入框聚焦时不拦截）；setCode 清栈；不持久化。
- **属性面板**：按组件类型专属编辑项（枚举下拉/数值/颜色/布尔），绑定状态变量的字段只读展示；底部「全部修饰符」区可删任意修饰符、可按 name+raw 参数新增——任何属性都可改。
- **设备档案编辑窗口**：编辑 px/dpi（折叠屏分双态），vp 自动重算，写 localStorage 覆盖层（`arkts-device-overrides`）即时生效，可恢复默认。
- **Palette 22 项**（布局/容器/基础/表单四组，含 ListItem/GridItem/TabContent），dnd 加 CHILD_CONSTRAINTS（List→ListItem、Grid→GridItem、Tabs→TabContent）。

### 设备校准（devices.json，官网数据，2026-07-21 校准）
- Mate 80 Pro Max：1320×2848px / 6.9" / dpi 455 → 464×1001vp
- Mate X7：unfolded 2416×2210 / 8.0" / 409 → 945×865vp；folded 1080×2444 / 6.49" / 412 → 419×949vp
- Pura X Max（新增，flip）：unfolded 2584×1828 / 7.7" / 411 → 1006×712vp；folded 1264×1848 / 5.4" / 415 → 487×712vp
- 来源均为华为官网规格页（URL 存于 devices.json 各设备 `source` 字段）；devices.ts 加 localStorage 覆盖层（getDeviceProfile/saveDeviceOverride/resetDeviceOverrides）。

### 遗留限制（本轮明确不做）
- 多 struct / 自定义 @Component / @Builder 编辑（占位保留）；onClick/onChange 事件逻辑模拟；表达式求值（除 ForEach 简单替换）。
- 8 位 hex（带 alpha 如蒙版色）属性面板取低 24 位显示、写回不透明 6 位。
- ~~连续拖动（尺寸/颜色）每次 pointermove 压一条撤销历史，粒度较细未合并。~~（已于 2026-07-21 保真轮修复：pushHistory + history:false 手势合并）
- RelativeContainer「双锚点拉伸 + width:100%」自适应未处理（同 v1 遗留）。
- Radio 同组互斥仅初值正确，点击后各实例本地 state 独立。

## 9. 保真与浅色主题迭代（2026-07-21）

针对「预览与导出代码对不上」的专项修复，测试 51/51 绿（新增 fidelity 11 项 + 手势合并 1 项）。

### 颜色保真
- **8 位 hex 通道修复**：ArkTS 为 AARRGGBB，原实现直接拼成 CSS #RRGGBBAA 导致 alpha/红通道错位（如 0x80FF0000 被渲染成 #80FF0000）。现正确重排为 #FF000080。
- **Color 枚举映射**：Color.Red/White/Transparent 等 12 个 HarmonyOS 色值此前不渲染（回落默认色），现完整映射。
- **序列化补齐修复**：8 位 ARGB 高位为 0 时（如 0x0AFFFFFF）原 padStart(6) 会输出 7 位导致回读被误读为 RGB，现按值域补 6/8 位。
- 属性面板颜色控件升级为「取色器 + hex 文本」双编辑，支持 0xRRGGBB / 0xAARRGGBB / Color.* 输入（Enter/失焦提交），alpha 不再被静默丢弃。

### 位置保真
- **默认对齐修复**：Column 交叉轴默认 HorizontalAlign.Center、Row 默认 VerticalAlign.Center（原为 CSS stretch，与 ArkUI 不符）；显式 alignItems 仍可覆盖。
- **定位类通用属性落地渲染**：position（绝对定位）、offset（translate 偏移）、zIndex、alignSelf、visibility（Hidden/None）、aspectRatio、constraintSize、size、flexGrow/flexShrink/flexBasis、enabled（禁用调暗）。
- **基准字号对齐**：画布 phone-screen 基准设为 16fp = 9.6 CSS px（原为浏览器默认 16px，未设 fontSize 的文本/按钮偏大）；文字默认色 #182431。
- **Button 默认外观**：对齐 ArkUI 默认（Capsule 胶囊 + 主题蓝 #0A59F7 底 + 白字），原浏览器灰底。

### 通用属性面板
属性面板「通用」区扩为两组：布局（width/height/padding/margin/layoutWeight/flexGrow/flexShrink/alignSelf/position/offset/zIndex/aspectRatio/visibility/enabled）+ 外观（backgroundColor/opacity/borderRadius/borderWidth/borderColor/id）；position/offset 为 {x,y} 双数值编辑。

### 浅色主题
App.css / index.css / renderer.css 整体浅化：页面 #f0f2f5、面板白底、正文深灰（对比度≥4.5）、color-scheme 锁定 light；预览内组件对齐 HarmonyOS 浅色主题（白底、强调色 #0A59F7）；选中/落点/把手保留品牌蓝 #3a6df0；机身框保留深色边框模拟真机。

### 其它优化
- 拖拽改尺寸的撤销历史按手势合并（store.pushHistory + mutateNode history:false），一次拖动 = 一步 Ctrl+Z。
- Progress 圆环描边统一主题蓝。

## 10. 编译安全与交互迭代（2026-07-21）

针对 DevEco 实际编译报错（`Scroll can have only one child component`）与易用性反馈的专项，测试 60/60 绿。

### 编译安全（对齐 hvigor 结构约束）
- **独子容器**：Scroll/TabContent 只能有一个子组件。`dnd.ts` 新增 `canAcceptMore` 落点拦截（有子时 inside/before/after 均不放行）；Scroll 默认值改为内置一个 Column（后续拖入自然进入 Column，结构上不可能产生非法代码）。
- **IR 校验器**（`ir/validate.ts`）：实时检查 Scroll/TabContent 独子、List/Grid/Tabs 子类型、ListItem/GridItem/TabContent 父容器归属，顶栏显示「⚠ N 处编译风险」悬停明细（导入的存量代码也能被提示）。

### 拖拽自由度
- **Stack 内自由定位**：拖入/拖动到 Stack 中部时按指针坐标写入子节点 `.position({x,y})`（vp），同 Stack 内拖动=纯改位置不重排，跨容器落入 Stack 自动补 position（history:false 并入上一步撤销）。

### 易用性
- **属性感叹号说明**：属性名旁 `!` 小圆标，悬停显示中文说明（`TIPS` 表覆盖全部通用属性与专属属性；NumField/EnumField 按 label、其它控件按修饰符名自动查表）。
- **一键复制/导出**：顶栏「复制代码」（clipboard API + 不可用降级为选中文本）与「导出 .ets」（Blob 下载，文件名取 structName）。
- **代码窗加高**：code-pane 改为 flex:1 占满右栏剩余高度（原先高度由内容撑开、只能看到几行）。
- **撤销合并补充**：跨容器落入 Stack 的 position 补写走 history:false，一次拖动仍是一步撤销。

## 11. 拖放全通道与自由操控迭代（2026-07-21）

按「最大限度用拖拽操控组件的大小和位置」方向的一次交互扩能，测试 60/60 绿、build 通过。

### 大纲树成为拖放落点（双向全通）
- dnd 的落点判定抽为 `computeDrop`（画布/大纲树共用：bands 三态、子类型约束、独子约束、Stack 坐标）：面板组件可拖进大纲树任意位置，树内行也可拖拽重排/换父（复用 beginMaybeMove），行上 before/after 插入线 + inside 高亮（`.outline-row.drop-*`）。
- 画布与大纲树共用同一 dropTarget，两处指示联动。

### 位置/尺寸自由操控（不破坏布局流、不影响手感）
- **Alt + 拖拽任意组件** = 自由偏移：实时改写 `.offset({x,y})`（vp，1 位小数），不改结构、不影响兄弟组件；手势开始 pushHistory 一次 + move 期间 history:false，整个手势一步撤销。
- **右下角斜拉把手**：width 与 height 都有数值时出现 `handle-se`，一次拖同时改两个维度（resize 支持 dim:'both'，单次 mutate 写两个修饰符）。
- 已有能力不变：Stack 内自由 position 定位、E/S 单边把手、三态落点。

### 设备档案可新增设备
- DeviceEditor 新增「新增设备」模式：型号名（重名校验）+ 直板/折叠选择 + 屏幕参数组（px/dpi，vp 自动重算），保存经 saveDeviceOverride（custom 标记）后立即切换为当前设备；删除走「恢复默认」。

### 细节
- 属性感叹号 tooltip 收窄（230px→160px，图标 13→11px，字号 10.5px）。

## 12. 右键菜单与图标修复（2026-07-21）

- **感叹号图标 bug 修复**：根因是 `.prop-row span { width: 92px }` 命中了标签内的 prop-tip 图标（span 选择器把它撑成 92px 宽灰条）。标签限宽改为 `.prop-row > span:first-child`（仅首列标签），图标恢复 11px 并与属性名同一行。
- **节点右键菜单**（`editor/ContextMenu.tsx`，画布组件与大纲树行均可右键唤起，右键即选中）：选中父组件 / 同级上移下移 / 创建副本（深拷贝）/ 包裹进 Column·Row·Stack / 复制节点代码（serializeNode 单节点序列化入剪贴板）/ 删除。菜单防出屏、Esc/点外/失焦关闭。
- store 新增 `duplicateNode` / `moveSibling` / `wrapNode` 动作（均入撤销历史），`serializeNode` 从 serialize.ts 导出；测试 61/61 绿。

## 13. 外科手术式编辑：真实工程文件全保留（2026-07-21，架构修订）

**动因**：用户导入真实页面（含 import/interface/方法/@Builder/`this.buildHeader()` 调用）报「解析失败」，且旧架构序列化只输出 @State + build()，会**删除** build 以外的全部代码。

**ADR-005 修订**：有损规范化的范围收窄为「仅 build() 内的 UI 结构」；文件其余部分一律原文保留、原位置、原格式。

### 实现
- **IRFile 新形态**：`preamble`（struct 前原文：import/interface/注释）+ `structDecorators` + `members`（state 结构化 | raw 原文块 | build 标记位，保持源码顺序）+ `postamble`（struct 后原文）+ `rootExtrasPre/Post`（build 内根组件前后的注释/表达式）。
- **成员原文保留**：方法/@Builder/字段经 `captureMemberRaw` 整段源码切片保留（装饰器带参、async/private 修饰符、返回类型、函数体配平）；@State/@StorageLink 等装饰器状态仍结构化（decorator 原文保留）。
- **build 内新增节点**：`Expr`（`this.xxx()` 表达式语句，渲染为 ƒ 徽标）、`Comment`（注释行，不渲染仅占位下标）；未知构造仍走 Unknown 占位。
- **raw 重建改为原始空白保留**：tokenizer 记录每个 token 的 pos/end，rawSlice 用 token 间原始间隙拼接——`Array<string>`/`&&` 紧排、`a < b` 松排完全照源码（修掉旧空格启发式把 `&&` 拆成 `& &` 的 bug）。
- **字符串颜色直通**：`'#4a5568'`/`'rgba(...)'` 直接进 CSS（此前仅支持 0x 数字色）。
- **校验器适配**：Comment/Expr 不参与独子/子类型计数。
- 回归锚点：`parser/fixtures/real_page.ets`（按用户真实页面浓缩），`preserve.test.ts` 8 项断言（原文保留/顺序/往返幂等/只改 UI 不动方法区）。测试 69/69 绿。

### 边界
- @Builder 方法体整体原文保留，**暂不支持在画布中编辑 @Builder 内部 UI**（后续可作为独立编辑目标接入）。
- build 体内暂只支持单根组件（ArkUI 规范即如此）。

## 14. @Builder 可视化 + 项目文档化（2026-07-21）

- **@Builder 内部 UI 可编辑**：`@Builder` 方法解析为 builder 成员（签名原文保留、方法体 UI 结构化）；build 内 `this.buildXxx()` 调用点解析为 `BuilderCall` 镜像节点，画布渲染为带 ƒ 标签的可视框，内部 UI 可正常选中/拖放/属性编辑；序列化定义处从镜像取 children（单一事实源）。带参调用不镜像、同名多调用点只镜像第一个（编辑歧义规避），均保留 Expr 原文。
- 适配：dnd CONTAINERS + SUPPORTED 收录 BuilderCall；属性面板按结构节点展示说明；validate 自然兼容。
- 测试 74/74 绿（新增 builder.test.ts 5 项：成员解析/镜像/编辑写回/幂等/定义兜底）。
- **文档化**：新增 `ARCHITECTURE.md`——项目目标、UI/非 UI 分离模型、保真规则、编辑能力清单、测试策略、新真实文件处理标准流程、已知边界、目录速查。

## 15. 画布降噪（2026-07-21）

针对「真实页面被 ⚠️ 占位框/ƒ 徽标/折叠占位淹没，失去页面应有样子」的反馈：

- **辅助标记开关**（顶栏 checkbox，默认关，localStorage 持久化）：关闭时画布即所得——折叠 If、Expr、if/else/ForEach 角标、BuilderCall 的 ƒ 标签与虚线框全部隐藏；开启时全显。经 RenderCtx.aids 全树传递，renderNode 支持 env.aids 覆盖（SSR 测试用）。
- **自定义组件占位降级为中性卡片**：未收录类型（VideoPickerCard/Select 等）从琥珀色 ⚠️ 警告框改为灰底小字中性卡（`.ir-custom`，含类型名，可点选/拖移）；琥珀细条仅保留给真正解析失败的 Unknown 片段（属告警非标记，始终可见）。
- 测试 75/75 绿（新增 aids 开/关对照断言）。



## 16. 易用性批次（2026-07-28）

- **模板套用可撤销**：`setCode(code, { keepHistory: true })` 把当前页压入历史栈，误点模板可 Ctrl+Z 撤回；导入/手改/重置仍清空两栈（代码源 = 新历史起点的设计不变）。
- **解析失败不闪白**：setCode 失败时保留最后一次成功的 IR，错误原因在代码窗顶部红色横幅展示（此前 ir 置 null、画布直接空白）。
- **画布缩放**：0.2–2 持久化；实现为 phone-frame 的 CSS transform，渲染内部仍以 1vp = 0.6px 为基准；dnd/resize 的指针换算统一走 `pxPerVp() = 0.6 × zoom`（屏幕 px ↔ vp），任何缩放下拖放/Alt 偏移/把手改尺寸精度不变。
- **节点剪贴簿**：Ctrl+C/X/V/D；粘贴遵循子类型/独子约束（选中容器可接收则入内，否则落到选中节点之后）。约束定义从 dnd 抽到 `ir/constraints.ts`（后又被 registry 吸收）。
- **侧栏搜索 / 代码窗防抖 400ms**（textarea 时代）。

## 17. Component Registry 架构重构 + 编辑器体验升级（2026-07-28）

针对「组件知识散落 7 处，加一个组件要改一堆文件」的根本问题：

- **Component Registry（`src/registry/`）**：每个组件一份 `ComponentSpec` 声明（分类/容器/子类型白名单/独子/默认节点工厂/专属属性 schema/大纲摘要），是唯一真相源。`ir/defaults.ts` 与 `ir/constraints.ts` 变为薄转接层（API 不变）；dnd 容器集、App 面板分组、OutlineTree 摘要全部从 registry 派生。
- **属性面板 schema 驱动**：`SpecificFields` 的手写 switch 改为按 `FieldSpec[]` 渲染（13 种字段 kind），新增组件的专属属性区只需在 spec 里声明；面板 518 → ~420 行且不再有 per-type 分支。
- **代码窗升级 CodeMirror 6**（@uiw/react-codemirror）：TS 高亮/行号/括号匹配；parser 报错文本中的「位置 N」映射为编辑器内 lint 标记（gutter 红点 + 波浪线）；保留 400ms 防抖与外部同步。
- **App.tsx 拆分为 panels/**：TopBar / SidePanel / ZoomBar / CodePane / HelpModal / TemplateThumb；App.tsx 只剩组装与快捷键（~110 行）。
- **交互抛光**：大纲树容器收合（▸/▾）、拖拽跟手标签（ghost）、Stack 对齐吸附（±3vp 吸附兄弟/容器边缘中线，绘制玫红参考线，Alt 偏移与 Stack 落点都生效）、模板即时缩图（renderer 直接渲染模板 IR 缩略预览，GrapesJS 式 block card）、快捷键说明弹窗（顶栏 ?）。
- **工具链**：补 ESLint 9 flat config（typescript-eslint + react-hooks），存量告警清零（DeviceEditor 改 render 期调整状态模式、CodePane 去掉 render 期写 ref）。
- 回归锚点：`registry/registry.test.ts` 8 项（SUPPORTED 全覆盖/面板分组顺序/palette 默认节点往返幂等/约束派生一致）。测试 89/89 绿，typecheck/build/eslint 全绿。
