// sample.ets
// v1 验收样本：覆盖 线性布局(Row/Column) + 层叠布局(Stack) + 相对布局(RelativeContainer)
// 该文件能被正确解析并渲染，即 v1 核心通过。

@Entry
@Component
struct Index {
  @State message: string = 'Hello ArkTS'
  @State count: number = 0

  build() {
    Column({ space: 12 }) {
      // —— 1. 线性布局（垂直 Column / 水平 Row 嵌套） ——
      Row() {
        Text('左')
          .fontSize(16)
        Text('中')
          .fontSize(16)
        Text('右')
          .fontSize(16)
      }
      .width('100%')
      .height(56)
      .justifyContent(FlexAlign.SpaceBetween)
      .alignItems(VerticalAlign.Center)
      .padding({ left: 16, right: 16 })
      .backgroundColor(0xFFE0B2)

      // —— 2. 层叠布局（Stack） ——
      Stack({ alignContent: Alignment.Center }) {
        Text('底层')
          .width(140)
          .height(140)
          .backgroundColor(0x4CAF50)
          .fontColor(0xFFFFFF)
        Text('上层')
          .fontSize(22)
          .fontColor(0xFFFFFF)
      }
      .width('100%')
      .height(160)

      // —— 3. 相对布局（RelativeContainer + alignRules） ——
      RelativeContainer() {
        Text('锚点')
          .id('anchor')
          .fontSize(18)
          .margin({ top: 12, left: 12 })
          .alignRules({
            top:   { anchor: '__container__', align: VerticalAlign.Top },
            left:  { anchor: '__container__', align: HorizontalAlign.Start }
          })

        Text('相对锚点右侧')
          .id('right')
          .fontSize(18)
          .margin({ top: 12, left: 8 })
          .alignRules({
            left: { anchor: 'anchor', align: HorizontalAlign.End },
            top:  { anchor: 'anchor', align: VerticalAlign.Top }
          })

        Text('相对锚点下方')
          .id('below')
          .fontSize(18)
          .margin({ top: 8, left: 12 })
          .alignRules({
            top:  { anchor: 'anchor', align: VerticalAlign.Bottom },
            left: { anchor: '__container__', align: HorizontalAlign.Start }
          })
      }
      .width('100%')
      .height(180)
      .backgroundColor(0xF5F5F5)
    }
    .width('100%')
    .height('100%')
    .padding(12)
  }
}
