# 保真规则（预览 = 真机语义）

> 生成 `.ets` 时遵守这些规则，画布渲染才会和真机一致。来源：ARCHITECTURE.md §4。

## 单位

- **长度单位是 vp，不是 px。** `width(200)` = 200vp。
- 设计稿 px → vp：`vp = px × 160 / dpi`。dpi≈480 时近似 `vp = px / 3`。
- 百分比 `'100%'` = 占满父容器交叉轴（ArkUI 语义，按父级约束解析）。
- 字号 `fontSize(16)` 单位是 fp（基准 16fp ≈ 真机中号字）。

## 颜色

- 数值 ≤0xFFFFFF 视为不透明 RGB（6 位）。
- 8 位数值是 **AARRGGBB**（ArkUI 顺序），不是 RRGGBBAA。
  - 例：`0x80FF0000` = 半透明红（AA=80, RR=FF, GG=00, BB=00）。
- `Color.*` 枚举可直接用（`Color.Red`）。
- 字符串 `'#4a5568'` / `'rgba(...)'` 直通。
- 序列化按值域补 6/8 位（高位 0 不丢）。

## 默认对齐（和 CSS 不一样，最容易错）

- **Column 交叉轴默认 Center**（不是 CSS 的 stretch）。
- **Row 交叉轴默认 Center**（不是 stretch）。
- 想要子组件撑满交叉轴，显式写 `width('100%')` 或 `alignItems(...)`.
- 滚动容器（Scroll/List/Grid/Tabs）**默认占满父组件交叉轴**（不写 width 也满宽）。
- TabContent 的独子未显式设尺寸时充满整个内容区。

## 容器尺寸语义

- **Stack 尺寸 = 最大子节点**（不会塌缩为 0）。多层叠放用 Stack。
- Scroll/TabContent 是独子容器，落点会自动下钻到内层 Column。

## 定位

- `.position()` 相对父组件；`.offset()` 相对自身布局位置（绘制期位移）。
- 百分比 position/offset 相对父/自身宽高。
- 不需要绝对定位时，用 Column/Row + space + Blank 实现布局，避免堆 position。

## 表达式

- 字符串拼接、三元、`this.xxx`、`$r()`、模板字符串 → 原样保留（解析器不求值函数调用）。
- `if (条件)` / `ForEach(数据源, item => ...)` 会走 evalExpr 小求值：条件/数据源可静态求值时画布真实展开。

## 编译安全

- 独子容器（Scroll/TabContent/Badge）只放一个子节点；多余会被校验拦截。
- List 子节点必须是 ListItem；Grid 子节点必须是 GridItem；Tabs 子节点必须是 TabContent。
- Button 同时带 label 和子组件会崩——有子组件时不要传 label 构造参数。

## 一个最小可解析文件长这样

```ets
import { } from ''

@Entry
@Component
struct Index {
  build() {
    Column({ space: 12 }) {
      Text('标题')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
      Text('副标题')
        .fontColor(0x99000000)
        .fontSize(14)
      Button('开始')
        .type(ButtonType.Capsule)
        .backgroundColor(0xFF0A59F7)
        .fontColor(Color.White)
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor(0xFFFFFFFF)
  }
}
```
