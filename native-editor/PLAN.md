# native-editor — ArkTS 原生可视化编辑器计划

## 目标

把 Web 版（`app/`，TypeScript/React 用 HTML/CSS 模拟 ArkUI）升级为 **ArkTS 原生实现**：

- 画布直接用 **真·ArkUI 组件**渲染（`typeNode` 动态建节点，API 12+），布局引擎就是手机上的那一个，从根上消除「画布 vs 真机」的格式/位置/大小偏差。
- 工程本身可编译出 **HAP**，装上手机后就是在真机上做可视化编辑。
- 与 Web 版共用同一份设计：组件树数据模型、ArkTS `build()` DSL 解析器、代码生成器（从 `app/src` 移植）。

## 关键决策

- **位置**：`native-editor/` 子工程，与 `app/`（Web 版）并存；Web 版保留为参考实现与快速预览。
- **动态渲染**：`typeNode.createNode(uiContext, 'Text')` + `NodeContainer/NodeController`，而不是把组件写死成 `@Builder` 分支——前者才能挂任意深的动态树并逐个设属性。
- **包名**：`com.leoli.arktseditor`（独立应用，不覆盖手机上任何已装应用）。
- **签名**：CLI 构建产**未签名** HAP；真机安装前在 DevEco Studio 里做一次自动签名（File → Project Structure → Signing Configs，30 秒），或用 `hdc install` 装模拟器不需要签名。
- **SDK**：modelVersion 26.0.0（与 NovelReader 相同，本机已装），stage 模型，deviceTypes: phone。

## 批次

| 批次 | 内容 | 状态 |
|---|---|---|
| 1 | 工程骨架 + 三栏编辑器外壳 | ✅ 构建出 HAP |
| 2 | 数据模型 + 解析器 + 代码生成器（`core/ir.ts` `core/tokenizer.ts` `core/parser.ts` `core/serialize.ts`） | ✅ 100 条等价测试（IR 深相等 + 序列化逐字节一致） |
| 3 | `typeNode` 动态渲染器（`render/DynamicRenderer.ets` + `render/EditorCanvas.ets`，20+ 组件、40+ 修饰符、List/Grid 自动包裹） | ✅ 编译通过 |
| 4 | 编辑交互：`core/mutate.ts` 编辑操作 + 画布点选/选中框 + 大纲树（`panels/OutlineTree.ets`）+ 属性面板（`panels/PropertyPanel.ets`）+ 移动模式拖拽 | ✅ 编译通过 |
| 5 | 代码往返 + 整项目导入导出 + If/ForEach 求值 | ✅ 完成（真机逐项验证） |
| 6 | 模板库移植（28 套，画廊载入为新页面）+ 撤销/重做（序列化快照）+ 文档 | ✅ 完成（真机逐项验证） |

**批次 6 补充**：模板画廊覆盖层 + 模板防漂移等价测试；撤销/重做快照栈（50 上限，拖拽 onActionStart 一份基线）；修复大纲树切页后行错乱（ForEach key 加数据版本号——List 按 path 复用旧行导致两棵树的行交错显示）。全部真机截图验证：模板画廊、标准首页加载、大纲树结构与模板源码一致、删除→撤销恢复。

## 验证现状

- **Web 侧 vitest**：`app/src/native/` 下 110 条测试（解析等价 100 + argConvert 5 + mutate 5）全绿；Web 版四件套（typecheck/lint/test/build）不受影响。
- **hvigor 构建**：`BUILD SUCCESSFUL`，产物 `entry/build/default/outputs/default/entry-default-unsigned.hap`。
- **真机运行**：✅ 已在连接设备（`6HQ0125C24000137`）安装并启动验证——三栏编辑器、typeNode 原生渲染、大纲树、属性面板、状态栏避让均正常。
  - 签名坑记录：DevEco 自动签名只写入了 `signingConfigs` 数组，但 `products.default` 缺 `"signingConfig": "default"` 引用 → 打出的包仍是未签名（`code:9568320 no signature file`）。已在 `build-profile.json5` 手动补上，CLI 直接产出 `entry-default-signed.hap`。
  - 日常迭代闭环（无需再开 DevEco）：改代码 → `assembleHap` → `hdc install -r entry-default-signed.hap` → `hdc shell aa start -a EntryAbility -b com.leoli.arktseditor`。
- **已知限制**：`$r()` 资源引用无法解析（属于原工程）；Tabs/Navigation 不在 typeNode 支持列表（占位）。
- **批次 5 补充**：
  - `core/exprEval.ts` 求值器：If 条件/ForEach 数据源/模板字符串/this.xxx 文本真实求值（JS 语义子集），真机确认 ForEach 展开、if(false) 隐藏。
  - 组件库点击添加（选中容器内追加/叶子后插入，`core/factory.ts` + `mutate.insertAuto`）；代码视图（等宽、可复制）+ 导出 `.ets`；导入 .ets 多文件 → 页面标签切换（picker 系统 UI 需手动验证）。
  - ArkUI 两个坑：①自定义组件 plain 参数仅创建时赋值一次，且 @Prop 深拷贝会让 mutate 改到副本——属性面板必须是主页面内联 @Builder 且内部新鲜求值；②@Builder 内不允许顶层局部变量声明。
  - 解析器修复（双端同步）：`captureExprRaw` 增加深度 0 换行守卫，修复 `@State x = this.a * 2` 类 raw 初值吞掉后续成员的问题；等价测试 328 全绿。

## 构建

```bash
cd native-editor
DEVECO_SDK_HOME="C:/Program Files/Huawei/DevEco Studio/sdk" \
  node "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" \
  --mode module -p product=default assembleHap --no-daemon
```

产物：`entry/build/default/outputs/default/entry-default-unsigned.hap`
