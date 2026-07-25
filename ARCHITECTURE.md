# ArkTS UI Visualizer — 架构与经验文档

> 这份文档总结这个项目的设计目标、架构决策、以及踩过的坑和对应的工作流程。
> 给以后的维护者（包括未来的自己）：先读这份，再读 `DESIGN-DECISIONS.md`（决策流水）和测试。
> 最后更新：2026-07-21

---

## 1. 项目目标

一个纯前端网页工具，让 ArkTS（HarmonyOS 声明式 UI）代码可以：

1. **导入** → 解析 → 在手机视口里渲染出 UI 预览；
2. **可视化编辑** → 拖拽、点击改 UI → ArkTS 代码实时同步回写；
3. **导出** → 拿到的代码能在 DevEco 里直接编译通过。

**核心原则（用真实工程代码换来的教训）：UI 与非 UI 代码必须分离。**
真实 .ets 文件里大部分不是 UI：import、interface、方法、生命周期、服务调用……平台只做一件事——**结构化 build()/\@Builder 里的 UI，其余一切原文、原位置、原格式保留**。用户改的是 UI，其它功能一行不动。

## 2. 总架构：IR 是唯一真相源

```
.ets 文本 ──parse──▶ IRFile ──render──▶ React DOM（手机视口，1vp = 0.6 CSS px）
                        │
                        ▼
              编辑（拖拽/点击/属性面板/大纲树/右键菜单）
                        │
                        ▼
                  serialize ──▶ .ets 文本（代码窗/复制/导出）
```

- 代码文本和画布都是 IR 的"视图"；编辑只改 IR，代码窗是序列化结果。
- 技术栈：React 18 + Vite + TypeScript + Zustand（+ vitest）。无后端，localStorage 持久化。
- 工程在 `app/`；`start.bat` 一键启动。

## 3. UI / 非 UI 分离模型（最重要的设计）

`IRFile` 的形态就是"分离"的直接体现：

```
preamble          struct 之前的全部原文（import / interface / 注释）—— 原样
structDecorators  '@Entry\n@Component' 原文 —— 原样
members[]         按源码顺序排列，三种形态：
  ├─ state        @State/@StorageLink 等装饰器状态 → 结构化（预览求值用；装饰器原文保留）
  ├─ raw          方法、字段、私有属性 → 整段源码切片，一字不动
  ├─ builder      @Builder：签名原文保留 + 方法体 UI 结构化（可编辑！）
  └─ build        build() 标记位（保证 build 在文件中的原位置）
postamble         struct 之后的全部原文（如其它自定义组件 struct）—— 原样
root + rootExtras build() 体内：唯一根组件 + 前后的注释/表达式节点
```

build() 内部的节点类型（IRNode）：

| 节点 | 含义 | 渲染 |
|---|---|---|
| 普通组件 | Column/Text/...（25 种支持） | 完整预览 + 可编辑 |
| `If` / `Else` | 条件渲染（条件原文存 ctorArgs） | 按 @State 初值折叠或展开，带角标 |
| `ForEach` | 列表渲染（数据源/参数/keyGen） | 数据源可静态求值时逐项渲染模板 |
| `BuilderCall` | `this.buildXxx()` 调用点镜像 | 内部 UI 可编辑，写回定义；辅助标记开启时显示 ƒ 标签框 |
| `Expr` | 其它表达式语句（如 `this.foo()`） | 辅助标记开启时显示小 ƒ 徽标，关闭时隐藏 |
| 自定义组件（未收录类型） | `VideoPickerCard`/`Select` 等 | 中性占位卡片（灰底小字 + 类型名，可点选/拖移） |
| `Unknown` | 解析失败片段 | ⚠️ 细条告警（非辅助标记，始终可见），原文保留 |

**辅助标记开关（顶栏「辅助标记」，默认关，持久化）**：关闭时画布即所得——折叠的 If、Expr、if/else/ForEach 角标、BuilderCall 标签全部隐藏，页面呈现与真机一致；开启时全部标记可见，便于理解结构。被隐藏/折叠的节点始终可在大纲树中点选。
| `Comment` | 注释行 | 不渲染，仅占路径下标，原样回吐 |
| `Unknown` | 无法识别的构造 | ⚠️ 占位框，原文保留 |

**调用点镜像（单一事实源）**：@Builder 定义的成员 children 与 build 内 BuilderCall 节点的 children 共享引用；编辑只发生在镜像上；序列化定义时从镜像取 children。一个 builder 只镜像第一个调用点（多调用点编辑有歧义，其余保留 Expr）。

### 表达式一律不求值、不丢失

字符串拼接、三元、箭头函数、数组字面量、`$r()`、模板字符串 → `{t:'raw', v:原文}`。
raw 重建用 **token 间原始空白**拼接（tokenizer 记录 pos/end），源码怎么写就怎么输出——这是修掉 `&&` 被拆成 `& &`、`Array<string>` 变 `Array< string >` 的关键。

## 4. 保真规则（预览 = 真机语义）

- **单位**：1 vp = 0.6 CSS px（常数）；设备 vp 维度 = round(px × 160 / dpi)。设备档案来自华为官网校准（`devices.json` 带 source URL），应用内可编辑/新增（localStorage 覆盖层）。
- **颜色**：数值 ≤0xFFFFFF 为不透明 RGB；8 位为 **AARRGGBB（ArkTS）→ RRGGBBAA（CSS）** 通道重排；`Color.*` 枚举映射；`'#4a5568'`/`'rgba(...)'` 字符串直通；序列化按值域补 6/8 位（高位 0 不丢）。
- **默认对齐**：Column 交叉轴默认 Center、Row 交叉轴默认 Center（不是 CSS 的 stretch）；基准字号 16fp = 9.6 CSS px；Button 默认胶囊 + 主题蓝 #0A59F7 白字。
- **定位**：position（绝对）/offset（transform 平移）/zIndex/alignSelf/visibility/constraintSize 等都落地渲染。
- **编译安全**：独子容器（Scroll/TabContent）与 List/Grid/Tabs 子类型约束在**拖放落点时拦截**，另有 `ir/validate.ts` 实时校验并在顶栏报警（对齐 hvigor 报错文案）。

## 5. 编辑能力清单

- 拖放：面板 → 画布/大纲树（before/inside/after 三态落点）；同父/跨容器搬运；Stack 内按坐标自由摆放（`.position`）。
- **Alt + 拖拽** = 任意组件自由偏移（`.offset`，不改结构）；右/下/右下三个把手改宽/高/同时改。
- 大纲树：点击选中（双向联动）、树内拖放重排/换父。
- 右键菜单：选中父级/上移下移/创建副本/包裹进容器/复制节点代码/删除。
- 属性面板：按类型的专属编辑 + 全量通用属性（布局+外观）+ 感叹号中文说明 + 「全部修饰符」兜底（可增删任意修饰符）。
- 撤销/重做（Ctrl+Z/Y，50 步；连续手势合并为一步）、Delete 删除。
- 顶栏：复制代码、导出 .ets、设备切换/折叠态、设备档案编辑/新增、编译风险警示。

## 6. 测试策略（74 项，防退化锚点）

```
parser.test.ts      v1 子集 + sample_full 全景：往返幂等、If/ForEach/raw
preserve.test.ts    真实工程文件全保留（ fixtures/real_page.ets ）：
                    preamble/成员原文/顺序/往返幂等/「只改 UI 不动方法区」
builder.test.ts     @Builder 结构化、镜像、编辑写回定义、幂等
validate.test.ts    编译约束校验（Scroll 独子等，对齐 hvigor 报错）
store.test.ts       撤销重做/手势合并/右键菜单动作/22 种默认值往返
fidelity.test.tsx   颜色通道/序列化补齐/通用属性 CSS 映射/默认外观
renderer.test.tsx   SSR 冒烟：sample.ets 不回归、sample_full 全树关键内容
```

**处理新真实文件的标准流程**（本次实战沉淀）：

1. 用户给一份导入失败/丢失的真实 .ets；
2. 浓缩后存 `app/src/parser/fixtures/`（保留结构特征，去掉无关长方法体）；
3. 先写测试复现（解析失败 / 断言原文保留 / 往返幂等）；
4. 修解析器/序列化器，直到「改 UI 后非 UI 区一字不动」的断言通过；
5. 全量 `npm run typecheck && npx vitest run && npm run build` 三件套必须全绿。

## 7. 已知边界（诚实清单）

- @Builder 带参数调用（`this.buildCard(item)`）不镜像（参数绑定无法静态解析），保留 Expr 原文。
- 一个 builder 多次调用时只镜像第一个调用点。
- 表达式不求值（除 ForEach 简单替换/If 布尔初值）；事件（onClick/onChange）不模拟逻辑。
- 预览是语义级还原（vp 布局 0 误差），物理像素级以真机为准。
- 多 struct / 自定义组件在 postamble 原文保留，不在画布编辑。

## 8. 目录速查

```
app/src/
├─ parser/     tokenizer（pos/end/comment）+ parser（外科手术式）+ fixtures + 测试
├─ ir/         types（IRFile/IRNode/ArgVal）+ mutate + serialize + validate + defaults
├─ renderer/   shared（styleOf/color/frameOf）+ Renderer + containers/forms/feedback/flow
│              + RelativeContainer（约束求解引擎）+ resize
├─ editor/     dnd（落点/约束/Alt 偏移/Stack 定位）+ OutlineTree + PropertyPanel
│              + DeviceEditor + ContextMenu
├─ devices/    devices.json（官网校准）+ 覆盖层
└─ store/      Zustand store（IR/历史/持久化/设备版本）
```

## 9. 常用命令

```bash
cd app
npm run dev         # 开发（或双击项目根 start.bat）
npm run typecheck   # tsc --noEmit
npx vitest run      # 全部测试
npm run build       # 产物 dist/（纯静态，可任意托管）
```
