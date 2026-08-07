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
- 技术栈：React 18 + Vite + TypeScript + Zustand + CodeMirror 6（+ vitest + ESLint）。无后端，localStorage 持久化。
- **Component Registry（`app/src/registry/`）是组件知识的唯一真相源**：每个组件一份 ComponentSpec（分类/容器/约束/默认节点/专属属性 schema/大纲摘要）。面板分组、dnd 容器集、子类型/独子约束、属性面板专属区、大纲树摘要全部从 registry 派生——新增一个组件只需在 `registry/specs.ts` 加一份声明（渲染器视图除外）。
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

- **单位**：1 vp = 0.6 CSS px（常数）；设备 vp 维度 = round(px × 160 / dpi)。设备档案来自华为官网校准（`devices.json` 带 source URL；主流机型 dpi 取物理 PPI 近似），应用内可编辑/新增（localStorage 覆盖层）；**vp 直填标定**：已知真机 vp 尺寸（px2vp 实测 / DevEco 预览器视口）时直接录入，内部按 1vp=3px（dpi 480）合成 px/dpi 存储，往返精确（`vpToPxDpi`）。**画布与真机比例一致的前提 = 设备档案 vp 尺寸与真机一致**——比例对不上时先校准设备档案。
- **颜色**：数值 ≤0xFFFFFF 为不透明 RGB；8 位为 **AARRGGBB（ArkTS）→ RRGGBBAA（CSS）** 通道重排；`Color.*` 枚举映射；`'#4a5568'`/`'rgba(...)'` 字符串直通；序列化按值域补 6/8 位（高位 0 不丢）。
- **默认对齐**：Column 交叉轴默认 Center、Row 交叉轴默认 Center（不是 CSS 的 stretch）；基准字号 16fp = 9.6 CSS px；Button 默认胶囊 + 主题蓝 #0A59F7 白字。
- **定位/变换**：position/offset/zIndex/alignSelf/visibility/constraintSize + translate/rotate/scale（transform 合成）。**定位包含块真机语义**：非塌缩节点基线 `position: relative`（ArkUI `.position` 相对父组件）；无显式尺寸且全部子节点出流的塌缩容器保持 static，position 子节点上溯到有大小的祖先（百分比尺寸随之按大容器解析，与真机一致）；选中/落点/位置调整高亮只加 outline 绝不动 position——布局不随选中态变化。position/offset 支持百分比字符串（translate 百分比相对自身宽高）。负值参数（parser 记 raw 一元表达式）经求值感知通道照常生效。
- **Stack 尺寸**：CSS grid 同格层叠（`gridArea:1/1`），Stack 尺寸 = 最大子节点（ArkUI 语义，不再塌缩为 0）；基线 `alignSelf:stretch` 对齐 ArkUI「百分比按父级提供的约束解析」（Stack{Column(100%)} 真机满宽）；`.position()` 子节点相对 Stack 本层定位。
- **滚动容器默认占满交叉轴**：Scroll/List/Grid/Tabs 基线 `alignSelf:stretch`（ArkUI 滚动容器默认占满父组件交叉轴，不写 width 也满宽）；显式 width/alignSelf 自然覆盖。
- **TabContent 独子占满约束**：TabContent 大小 = Tabs 内容区（宽撑满、高 = Tabs − TabBar），其独子未显式设尺寸时充满整个区域（真机上 `Column.justifyContent(Center)` 才能垂直居中）——渲染为 grid 满格（`minmax(0,1fr)`），auto 尺寸子组件默认 stretch 撑满、显式宽高不受影响。Tabs 支持 `barPosition.Start/End`（页签栏顶/底）与 `vertical(true)`（竖排左/右）。
- **系统栏安全区**：画布默认显示手机状态栏（18px≈30vp，时间 + 信号/Wi-Fi/电池图标）与底部手势导航条（12px≈20vp），应用区 `.app-area` = 屏幕 − 系统栏（真机非沉浸布局，根 100% 高 = 应用区高）；顶栏「系统栏」开关（`systemBars` 持久化，默认开）。
- **表达式小求值**（`shared.evalExpr`，禁 eval）：字面量/`this.x`/三元/比较/&& || ??/!/加减乘除/拼接/成员访问（`.prop` `?.prop` `[i]`，含 `.length`），求不出一律回退原文。styleOf 与 resolveStr/Num/Bool 全部走求值感知版；`if` 条件折叠同样走求值器。
- **@Styles/@Extend 展开**：`@Styles name()` 与 `@Extend(Comp) name()`（struct 成员与全局 function 均支持）解析成样式表（`renderer/styleTable.ts`）；0 参样式调用在 styleOf 就地展开（@Extend 组件专属优先），本机后续修饰符自然覆盖。
- **同文件自定义组件渲染**：postamble 里的 `@Component struct` 逐个解析成组件 IR 表（`renderer/components.ts`）；未收录类型按名命中即渲染其 build()，调用点 obj 参数按名覆盖组件内字段/@State 初值（含 raw 成员字面量字段提取）。实例内部只读（pointer-events 穿透），递归深度限 3。
- **跨文件组件渲染**：`import { X } from '../components/X'` 由 `project.buildComponents` 解析进组件表（按 path+code 缓存解析结果，编辑当前页不重解整个工程）；同文件组件优先于跨文件同名。
- **媒体与资源**：导入工程目录或单独导入图片/视频后，`$r('app.media.x')`/`$rawfile`/相对路径引用经 `resolveMediaRef` 命中媒体表（文件名去扩展名为键）渲染真图/可播视频；`$r('app.color.x')`/`$r('app.string.x')` 走项目 `resources element` json（颜色项目表优先于内置语义色表）。
- **router 导航模拟**：交互预览模式下，点击的组件 `onClick` 含 `router.pushUrl/replaceUrl/back`（内联或 `this.method()` 间接调用——`extractMethodRoutes` 从成员原文提取方法路由表）即执行页面切换/回退；url 按路径后缀匹配项目文件（`routeTarget`）。
- **@Builder 带参调用**：调用点参数可静态求值时，按名替换进定义体做只读渲染（ForEach 内 `this.buildCard(item)` 经 substRawText 先替换再求值）；不可求值保持 Expr 徽标。无参调用点维持可编辑镜像。
- **ForEach 对象数组**：数据源支持对象字面量（尾逗号容忍），模板内 `item.name` 成员访问、`'前缀' + item.n` 拼接、`(item, index)` 双参数替换。
- **修饰符覆盖**：shadow/linearGradient/border(obj)/textOverflow/letterSpacing/lineHeight/fontStyle/fontFamily/clip/blur/backdropBlur/backgroundImage(Size) 等常用修饰符均有映射。
- **编译安全**：独子容器（Scroll/TabContent）与 List/Grid/Tabs 子类型约束在**拖放落点时拦截**，另有 `ir/validate.ts` 实时校验并在顶栏报警（对齐 hvigor 报错文案）。

## 5. 编辑能力清单

- 拖放：面板 → 画布/大纲树（before/inside/after 三态落点）；同父/跨容器搬运；Stack 内按坐标自由摆放（`.position`）；拖拽中有跟手标签（ghost）。**独子容器重定向**：落到已满的 Scroll/TabContent/Badge 中部自动深入其内层容器（`descendFullSingleChild`，高亮跟随最终目标）。**画布容器落点重设计**：before/after 收窄为 ~10px 像素边带（防大容器留白误判到容器外），inside 按指针位置就近插入（最近子节点之后，Stack 除外）；before/after 被约束拒绝时回退 inside。**大纲树边带 20%**：树内中部 60% 一律进容器，拖拽悬停收合容器 600ms 自动展开；**树面板空白区吸附最近行**（行间隙/末尾空白拖入不丢）+ 拖近树视口上下沿自动滚动。**「位置调整」子树提升**：nudge 模式下画布按下点命中的是最内层子组件，落点在 nudge 目标子树内即提升拖拽目标到 nudge 节点（`resolveDragStart`），微调父组件不再误拖子组件。**健壮性**：onMove 检测 `e.buttons === 0` 兜底错过的 pointerup（窗外松开不再卡死落点层），onMaybeMove/onMove/onUp 全 try/catch 收尾，右键按下不起拖拽；**DOM 查询限定 `.phone-screen` 范围**（模板缩略图同带 data-path，拖到面板上不再误解析）；**画布落点覆盖层 CSS 限定 `.phone-screen` 作用域**（大纲树行高亮同用 drop-inside 类名，裸类名 position:absolute+inset:0 会让树行变成覆盖整个面板的蓝色层——「拖入树蓝屏 + 不灵敏」的根因）；落点指示显示时帧强制 `position:relative`（塌缩容器也不例外，指示层不逃逸）。
- **粘贴模式**：复制/剪切即开启（提示条 + copy 光标），点击容器 = 放入内部末尾（独子下钻）、点击组件 = 放到其后，可连续多处；Esc/✕/点空白/代码变更/撤销重做退出（`pasteArmed/pasteAt`）。
- **「位置调整」模式（画布右键菜单）**：开启后拖拽该组件只改 `.offset` 不动结构（橙色虚线框 + 提示条；方向键 1vp/Shift 10vp 微调，连按合并一步撤销）；Esc/✕/菜单退出，结构变更自动退出。大纲树拖拽不受影响（保持结构化移动）。**Alt + 拖拽** = 等效快捷方式；右/下/右下三个把手改宽/高/同时改。
- **对齐吸附**：Alt 偏移与 Stack 落点时，±3vp 内自动吸附兄弟/容器的边缘与中线，并绘制玫红参考线。
- 大纲树（编辑中枢）：点击选中（双向联动）、容器 ▸/▾ 收合、树内拖放重排/换父；**行悬停操作：＋插入（容器进内部末尾、叶子到下方，弹约束过滤的插入选择器：基础组件 + 复合组件）/ ⧉副本 / ✕删除**。
- 右键菜单：选中父级/**调整位置（拖拽微调，含清除偏移量）**/上移下移/创建副本/包裹进容器/复制节点代码/删除。
- **大纲树固定条**：独立全高条，紧贴左停靠区右缘（[导航][大纲树][画布][属性/代码]），宽度把手拖拽持久化（`outlineWidth`，160–560，默认 260）——组件面板 → 大纲树的拖拽路径最短；首部「«」收合成 30px 窄条（点窄条展开，`outlineCollapsed` 持久化，默认展开）。**停靠式面板布局**：导航/属性/代码三面板可停靠左/右/底三边（首部右键菜单切换 + 重置布局，顶部停靠已下线）；面板主尺寸把手 + 区内缘把手调整区尺寸；`layoutDocks/panelSize/zoneSize` 持久化（v2 迁移规范化旧布局），0 = flex 均分。
- 属性面板：**专属区由 registry 的 FieldSpec schema 驱动** + 全量通用属性（布局+外观）+ 感叹号中文说明 + 「全部修饰符」兜底（可增删任意修饰符）。
- 撤销/重做（Ctrl+Z/Y，50 步；连续手势合并为一步）、Delete 删除。
- 节点剪贴簿：Ctrl+C 复制 / Ctrl+X 剪切 / Ctrl+V 粘贴（选中容器可接收则放入其内，否则落到选中节点之后；粘贴同样过子类型/独子约束）/ Ctrl+D 创建副本。
- 画布缩放：左上缩放条（−/百分比点按重置/+ /适应窗口，0.2–2）；**「适应」为常开模式（默认开，持久化）**——ResizeObserver 监听画布可用空间与设备视口自动重算缩放，手动 −/+ 即退出回手动模式。实现为 phone-frame 的 CSS transform，渲染内部仍以 1vp = 0.6px 为基准。**px↔vp 唯一换算口径 `pxPerVp() = 0.6 × effZoom`**（`editor/scale.ts`）：effZoom = 实际生效缩放（fitMode 时自适应值，否则 = zoom），由 App 计算后同步进 store——dnd 位移/Stack 落点/resize 把手全部走它，fit ≠ zoom 时不会再出现「画布拖一点、真机跑很远」。
- 侧栏搜索框：页面（文件名/媒体名）/ 组件（按组名/组件名）/ 组件库 / 模板（按名称/描述）四页签共用过滤。
- **项目模式（多页面）**：顶栏「导入项目」读取所选目录（webkitdirectory）——全部 `.ets/.ts`、图片/视频（单文件 ≤12MB 转 dataURL）、`resources element` 的 color/string json；侧栏「页面」页签列出全部文件（@Entry 标 ⌂）与媒体缩略图（可移除）。当前页 code 始终与 `files[currentFile]` 同步（setCode 写回 + 切换时写回），撤销历史随换页清空。
- **交互预览**：顶栏开关。开启后画布右上页面栏显示「◀ 返回（导航栈非空时）+ 当前页名 + 交互预览徽标」；点击命中 router 导航的组件执行跳转而非选中（`frameOf` 拦截）。Stack 折叠分支不再产出空绝放层（原会拦截整屏点击）。
- 模板：**等比缩图预览**——按当前设备视口渲染完整手机屏结构（`.phone-static` + `.app-area` + 系统栏，与画布同一份 StatusBar/NavBar 标记，见 `renderer/PhoneChrome.tsx`），再按卡片宽/高双向取小整体 scale（卡片固定 180px 高，长屏设备不会过长），缩放后视觉居中；缩略图与画布布局比例逐点一致（不能用 `.phone-screen` 类，dnd 按该类限定画布范围）。套用可撤销——`setCode(code, { keepHistory: true })` 把当前页压入历史栈；普通代码源变更（导入/手改/重置）仍清空两栈。
- 代码窗：**CodeMirror 6**（TS 高亮/行号/括号匹配），输入防抖 400ms 解析（失焦立即 flush）；**解析失败保留最后一次成功的 IR**——画布不闪白，错误在代码窗顶部红色横幅 + 编辑器内 lint 标记（gutter 红点，位置由 parser 报错文本提取）展示。
- 顶栏：复制代码、导出 .ets、设备切换/折叠态、设备档案编辑/新增、编译风险警示、快捷键说明弹窗（?）。

## 6. 测试策略（208 项，防退化锚点）

```
parser.test.ts      v1 子集 + sample_full 全景：往返幂等、If/ForEach/raw
preserve.test.ts    真实工程文件全保留（ fixtures/real_page.ets ）：
                    preamble/成员原文/顺序/往返幂等/「只改 UI 不动方法区」
builder.test.ts     @Builder 结构化、镜像、编辑写回定义、幂等
validate.test.ts    编译约束校验（Scroll 独子等，对齐 hvigor 报错）
store.test.ts       撤销重做/手势合并/右键菜单动作/剪贴簿/模板历史/22 种默认值往返
registry.test.ts    registry 完整性：SUPPORTED 全覆盖/面板分组/默认节点往返/约束派生
dnd.test.ts         落点计算：独子容器重定向（Scroll→内层 Column）/前后插入/约束拦截/
                    move 搬运重定向 + 画布模式（窄边带/最近子位置/约束回退/根独子保护）/
                    resolveDragStart 位置调整模式子树提升
scale.test.ts       pxPerVp 换算口径跟随 effZoom（含自适应 fit），拒绝非正值
devices.test.ts     vp 换算/vpToPxDpi 往返精确/内置档案一致性/新增机型与 360 基准
library.test.tsx    22 个复合组件全链路：makeNode → serialize → parse → SSR 渲染
                    不抛错 + 只用已注册组件类型（防「拖入即崩」回归）
project.test.tsx    import 提取/路径与路由解析/媒体与资源分类/跨文件组件表/
                    router 动作提取/resolveMediaRef/Image+字符串资源 SSR
projectStore.test.ts 整项目导入/导航栈/跨文件组件表/换页写回/单文件退出项目模式
fidelity.test.tsx   颜色通道/序列化补齐/通用属性 CSS 映射/默认外观/Stack 与滚动容器尺寸/
                    Tabs 占满约束与 barPosition/落点指示包含块
fidelity2.test.tsx  evalExpr 求值器/ForEach 对象数组与 index/@Styles/@Extend 展开/
                    自定义组件/@Builder 带参/修饰符包/新组件冒烟
renderer.test.tsx   SSR 冒烟：sample.ets 不回归、sample_full 全树关键内容
```

**处理新真实文件的标准流程**（本次实战沉淀）：

1. 用户给一份导入失败/丢失的真实 .ets；
2. 浓缩后存 `app/src/parser/fixtures/`（保留结构特征，去掉无关长方法体）；
3. 先写测试复现（解析失败 / 断言原文保留 / 往返幂等）；
4. 修解析器/序列化器，直到「改 UI 后非 UI 区一字不动」的断言通过；
5. 全量 `npm run typecheck && npx vitest run && npm run build` 三件套必须全绿。

## 7. 已知边界（诚实清单）

- @Builder 带参调用为**只读替换渲染**（编辑请走定义处或无参镜像）；一个 builder 多次调用时只镜像第一个无参调用点。
- 表达式走 evalExpr 小求值（三元/比较/逻辑/加减乘除/拼接/成员访问）；函数调用、复杂链式调用不求值——一律回退原文，不猜。事件（onClick/onChange）不模拟逻辑，**唯一例外是交互预览模式下的 router 导航**（pushUrl/replaceUrl/back，含 this.method 间接调用——方法体按配平花括号截取，属启发式）。
- 跨文件组件只解析 import 声明命中的文件（一层；其内部再 import 的组件不递归），实例内部只读不可编辑；组件定义本身在 postamble 原文保留，不在画布编辑。
- 媒体以 dataURL 内联进 localStorage（单文件 ≤12MB）；配额满时落盘静默失败（内存态仍在，刷新后重新导入即可）。`NavDestination`/`Navigation` 路由模式未支持（仅 router 接口）。
- 预览是语义级还原（vp 布局 0 误差），物理像素级以真机为准。

## 7.5 原生 ArkTS 版（native-editor/）

Web 版之外，仓库还包含 **ArkTS 原生重写版**编辑器（`native-editor/`，HAP 直装手机）：画布预览用 `typeNode` 动态创建**真·ArkUI 组件**（而非 HTML/CSS 模拟），布局几何与真机天然 1:1——这是「画布 vs 手机一致性」的终极答案。与 Web 版共享同一份 IR/解析器/序列化器（`entry/src/main/ets/core/` 逐行移植），等价性由 `app/src/native/` 的 vitest 强制（IR 深相等 + 序列化逐字节一致）。详见 `native-editor/PLAN.md` 与 DESIGN-DECISIONS 第 30 条。

## 8. 目录速查

```
app/src/
├─ parser/     tokenizer（pos/end/comment）+ parser（外科手术式）+ fixtures + 测试
├─ ir/         types（IRFile/IRNode/ArgVal）+ mutate + serialize + validate
│              + defaults/constraints（薄转接层，实现见 registry）
├─ registry/   ★ 组件注册表：types（ComponentSpec/FieldSpec）+ specs（25+ 组件声明）
│              + index（getSpec/面板分组/约束派生/makeDefaultNode/nodeSummary）+ 测试
├─ project/    ★ 项目级逻辑：extractImports/resolveImport/routeTarget/pickStartFile
│              + parseCached（path+code 缓存）+ buildComponents（跨文件组件表）
│              + 媒体/资源分类（isMediaFile/mediaKeyOf/parseResourceJson）+ 测试
├─ renderer/   shared（styleOf/color/frameOf/evalExpr 求值器/router 动作提取）+ Renderer
│              + containers/forms/feedback/flow + RelativeContainer（约束求解引擎）
│              + styleTable（@Styles 提取）+ components（同文件组件提取）+ resize
├─ editor/     dnd（落点/独子重定向/画布窄边带与就近插入/位置调整模式/Alt 偏移/Stack 定位
│              /吸附参考线/ghost/兜底收尾）+ scale（px↔vp 唯一换算口径 = 0.6 × effZoom）
│              + OutlineTree（行内 ＋/⧉/✕ + 插入选择器）+ dnd/scale 测试
│              + PropertyPanel（schema 驱动）+ DeviceEditor + ContextMenu + ErrorBoundary
├─ panels/     TopBar + SidePanel（页面/组件/组件库/模板+搜索）+ ZoomBar + CodePane
│              （CodeMirror）+ HelpModal + TemplateThumb + dock（三边停靠 + 大纲树固定条）
├─ devices/    devices.json（官网校准）+ 覆盖层
└─ store/      Zustand store（IR/历史/持久化/设备版本/缩放/剪贴簿/样式表/组件表
│              + 项目文件表/媒体/资源/导航栈/交互预览/自适应模式/停靠布局）
```

## 9. 常用命令

```bash
cd app
npm run dev         # 开发（或双击项目根 start.bat）
npm run typecheck   # tsc --noEmit
npx vitest run      # 全部测试
npm run lint        # ESLint（flat config）
npm run build       # 产物 dist/（纯静态，可任意托管）
```
