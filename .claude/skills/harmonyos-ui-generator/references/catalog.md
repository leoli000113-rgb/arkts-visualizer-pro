# ArkUI 组件目录（裁剪自 registry/specs.ts）

> 这是 ArkTS Visualizer **已收录**的组件。生成代码时只用这些类型，确保画布能完整渲染且可编辑。
> 每条：类型 / 分类 / 是否容器 / 子类型约束 / 构造参数 / 常用修饰符 / 枚举值。

## 布局

| 类型 | 容器 | 构造参数 | 常用修饰符 |
|---|---|---|---|
| `Column` | ✓ | `{ space: number }` | justifyContent, alignItems(HorizontalAlign) |
| `Row` | ✓ | `{ space: number }` | justifyContent, alignItems(VerticalAlign) |
| `Stack` | ✓ | `{ alignContent: Alignment }` | width, height |
| `RelativeContainer` | ✓ | — | width, height |
| `Flex` | ✓ | `{ direction: FlexDirection, wrap: FlexWrap }` | width |
| `Blank` | ✗ | — | —（弹性占位） |

## 容器（带子类型约束）

| 类型 | 收子 | 构造参数 | 常用修饰符 |
|---|---|---|---|
| `Scroll` | 独子(下钻内层 Column) | — | width('100%'), height, scrollable |
| `List` | 仅 `ListItem` | `{ space: number }` | width('100%'), height |
| `Grid` | 仅 `GridItem` | — | columnsTemplate('1fr 1fr'), rowsGap, columnsGap, width('100%'), height |
| `Tabs` | 仅 `TabContent` | — | width('100%'), height, barPosition, vertical |
| `ListItem` | ✗(叶子) | — | — |
| `GridItem` | ✗(叶子) | — | — |
| `TabContent` | 独子 | — | tabBar(string) |
| `Badge` | 独子 | `{ count: number }` | — |

## 基础

| 类型 | 构造参数 | 常用修饰符 |
|---|---|---|
| `Text` | `string` | fontSize, fontColor, fontWeight, textAlign, maxLines |
| `Button` | `string` | type(ButtonType), stateEffect, backgroundColor |
| `Image` | `string`(src) | width, height, objectFit(ImageFit) |
| `Video` | `{ src: string }` | width('100%'), height |
| `Divider` | — | width('100%') |

## 表单

| 类型 | 构造参数 | 常用修饰符 |
|---|---|---|
| `TextInput` | `{ placeholder, text }` | width('100%') |
| `Toggle` | `{ type: ToggleType, isOn }` | — |
| `Slider` | `{ value, min, max, step }` | width('100%') |
| `Checkbox` | `{ name, group }` | — |
| `Radio` | `{ value, group }` | — |
| `Select` | `[{ value }]` 数组 | selected, value |
| `Progress` | `{ value, total, type: ProgressType }` | width('100%') |

## 反馈

| 类型 | 构造参数 | 修饰符 |
|---|---|---|
| `Rating` | `{ rating, indicator }` | — |
| `LoadingProgress` | — | color |

## 结构（不进面板，由源码解析产生）

- `If` / `Else`：条件渲染，条件原文存 ctorArgs[0]（走 evalExpr 求值折叠）。
- `ForEach`：列表渲染，ctorArgs = [数据源, itemAlias, keyGen]；数据源可静态求值时逐项展开模板。
- `BuilderCall`：`this.buildXxx()` 调用点镜像。

## 枚举速查

```
ButtonType: Capsule | Normal | Circle | ROUNDED_RECTANGLE
ImageFit: Contain | Cover | Auto | Fill | None | ScaleDown
FlexAlign(justifyContent): Start | Center | End | SpaceBetween | SpaceAround | SpaceEvenly
HorizontalAlign(Column.alignItems): Start | Center | End
VerticalAlign(Row.alignItems): Top | Center | Bottom
Alignment(Stack.alignContent): TopStart | Top | TopEnd | Start | Center | End | BottomStart | Bottom | BottomEnd
FontWeight: Lighter | Normal | Regular | Medium | Bold | Bolder
TextAlign: Start | Center | End | Left | Right
ProgressType: Linear | Circular | Eclipse | ScaleRing | Capsule
ScrollDirection: Vertical | Horizontal | Free | None
```

## 通用修饰符（所有组件可挂）

width / height（number=vp 或 '100%'）/ padding / margin / border / borderRadius / backgroundColor / opacity / visibility / position / offset / zIndex / translate / rotate / scale / shadow / linearGradient / aspectRatio / aspectRatio / constraintSize / alignSelf / clickable(onClick)
