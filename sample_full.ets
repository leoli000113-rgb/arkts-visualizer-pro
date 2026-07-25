// sample_full.ets  —— 北极星样本（目标全景，非 v1）
// 覆盖：布局[线性/层叠/相对/弹性] + 容器[列表/网格/滚动] + 基础[文本/按钮/图片/视频/蒙版]
//       + 表单[输入框/开关/滑块/复选框/单选框] + 导航[标签页] + 反馈[弹窗/进度条]
// 此文件定义"最终想做到什么"，v1 只取其中最小切片（见 DESIGN-DECISIONS.md 的分期）。

@Entry
@Component
struct Index {
  @State tab: number = 0
  @State dialogVisible: boolean = false
  @State switchOn: boolean = true
  @State sliderVal: number = 30
  @State checked: boolean = false
  @State radioIdx: number = 0
  @State inputText: string = ''
  @State list: Array<string> = ['列表项 1', '列表项 2', '列表项 3', '列表项 4', '列表项 5']

  build() {
    Stack({ alignContent: Alignment.Center }) {
      // —— 反馈：弹窗（蒙版层 + 对话框），用条件渲染实现 ——
      if (this.dialogVisible) {
        // 蒙版：半透明遮罩层（点遮罩关闭）
        Column()
          .width('100%').height('100%')
          .backgroundColor(0x00000066)
          .onClick(() => { this.dialogVisible = false })

        Column({ space: 16 }) {
          Text('提示').fontSize(20).fontWeight(FontWeight.Bold)
          Text('这是一个 AlertDialog 样式的弹窗反馈。').fontSize(14)
          Row({ space: 12 }) {
            Button('取消').onClick(() => { this.dialogVisible = false })
            Button('确定').type(ButtonType.Capsule).onClick(() => { this.dialogVisible = false })
          }
        }
        .padding(24).backgroundColor(0xFFFFFF).borderRadius(12)
      }

      // —— 导航：标签页 ——
      Tabs({ index: this.tab }) {

        // ===== Tab1 布局 =====
        TabContent() {
          Scroll() {
            Column({ space: 16 }) {
              Text('线性布局 Row/Column').fontSize(16).fontWeight(FontWeight.Bold)
              Row({ space: 8 }) {
                Text('A').padding(8).backgroundColor(0xFFCDD2)
                Text('B').padding(8).backgroundColor(0xC8E6C9)
                Text('C').padding(8).backgroundColor(0xBBDEFB)
              }.width('100%').justifyContent(FlexAlign.Center)

              Text('层叠布局 Stack').fontSize(16).fontWeight(FontWeight.Bold)
              Stack({ alignContent: Alignment.Center }) {
                Text('底层').width(120).height(120).backgroundColor(0x4CAF50).fontColor(0xFFFFFF)
                Text('上层').fontSize(22).fontColor(0xFFFFFF)
              }.width('100%').height(140)

              Text('相对布局 RelativeContainer').fontSize(16).fontWeight(FontWeight.Bold)
              RelativeContainer() {
                Text('锚点').id('anchor').fontSize(16).margin({ top: 8, left: 8 })
                  .alignRules({ top: { anchor: '__container__', align: VerticalAlign.Top }, left: { anchor: '__container__', align: HorizontalAlign.Start } })
                Text('右侧').id('r').fontSize(16).margin({ left: 8 })
                  .alignRules({ left: { anchor: 'anchor', align: HorizontalAlign.End }, top: { anchor: 'anchor', align: VerticalAlign.Top } })
                Text('下方').id('b').fontSize(16).margin({ top: 8, left: 8 })
                  .alignRules({ top: { anchor: 'anchor', align: VerticalAlign.Bottom }, left: { anchor: '__container__', align: HorizontalAlign.Start } })
              }.width('100%').height(160).backgroundColor(0xF5F5F5)

              Text('弹性布局 Flex').fontSize(16).fontWeight(FontWeight.Bold)
              Flex({ direction: FlexDirection.Row, justifyContent: FlexAlign.SpaceBetween, wrap: FlexWrap.Wrap }) {
                Text('1').width(60).height(40).backgroundColor(0xFFE0B2).textAlign(TextAlign.Center)
                Text('2').width(60).height(40).backgroundColor(0xB2DFDB).textAlign(TextAlign.Center)
                Text('3').width(60).height(40).backgroundColor(0xC5CAE9).textAlign(TextAlign.Center)
              }.width('100%')
            }.padding(12)
          }.layoutWeight(1)
        }.tabBar('布局')

        // ===== Tab2 容器 =====
        TabContent() {
          Column({ space: 12 }) {
            Text('列表 List').fontSize(16).fontWeight(FontWeight.Bold)
            List({ space: 8 }) {
              ForEach(this.list, (item: string) => {
                ListItem() {
                  Text(item).fontSize(14).padding(12).width('100%').backgroundColor(0xEFEBE9)
                }
              }, (item: string) => item)
            }.width('100%').height(160)

            Text('网格 Grid').fontSize(16).fontWeight(FontWeight.Bold)
            Grid() {
              ForEach([0, 1, 2, 3, 4, 5, 6, 7], (i: number) => {
                GridItem() {
                  Text('G' + i).fontSize(12).backgroundColor(0xD7CCC8).width('100%').height('100%').textAlign(TextAlign.Center)
                }
              }, (i: number) => i.toString())
            }.columnsTemplate('1fr 1fr 1fr 1fr').rowsGap(8).columnsGap(8)
              .width('100%').height(120)

            Text('滚动 Scroll').fontSize(16).fontWeight(FontWeight.Bold)
            Scroll() {
              Row({ space: 8 }) {
                ForEach([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], (i: number) => {
                  Text('项' + i).fontSize(12).padding(10).backgroundColor(0xC5CAE9)
                }, (i: number) => i.toString())
              }
            }.scrollable(ScrollDirection.Horizontal).width('100%').height(48)
          }.padding(12)
        }.tabBar('容器')

        // ===== Tab3 基础组件 =====
        TabContent() {
          Scroll() {
            Column({ space: 16 }) {
              Text('文本 Text').fontSize(20).fontWeight(FontWeight.Bold)
              Text('可换行的彩色文本示例').fontSize(14).fontColor(0x1976D2).maxLines(2)

              Text('按钮 Button').fontSize(20).fontWeight(FontWeight.Bold)
              Row({ space: 12 }) {
                Button('普通').type(ButtonType.Capsule)
                Button('主操作').type(ButtonType.Capsule).stateEffect(true)
                Button('强调').type(ButtonType.Normal).backgroundColor(0xFF5722)
              }

              Text('图片 Image').fontSize(20).fontWeight(FontWeight.Bold)
              Image('placeholder.png').width(120).height(80).objectFit(ImageFit.Contain).backgroundColor(0xEEEEEE)

              Text('视频 Video').fontSize(20).fontWeight(FontWeight.Bold)
              Video({ src: 'placeholder.mp4' }).width('100%').height(120).backgroundColor(0x000000)

              Text('蒙版 Mask（半透明遮罩层）').fontSize(20).fontWeight(FontWeight.Bold)
              Stack({ alignContent: Alignment.Center }) {
                Text('被蒙版遮住的内容').fontSize(16)
                Column().width('100%').height('100%').backgroundColor(0x00000088)
                Text('蒙版上的提示').fontSize(16).fontColor(0xFFFFFF)
              }.width('100%').height(120)
            }.padding(12)
          }.layoutWeight(1)
        }.tabBar('基础')

        // ===== Tab4 表单 =====
        TabContent() {
          Scroll() {
            Column({ space: 20 }) {
              Text('输入框 TextInput').fontSize(16).fontWeight(FontWeight.Bold)
              TextInput({ placeholder: '请输入文本', text: this.inputText })
                .onChange((v: string) => { this.inputText = v }).width('100%')

              Text('开关 Toggle').fontSize(16).fontWeight(FontWeight.Bold)
              Row() {
                Text('开关状态：' + (this.switchOn ? '开' : '关'))
                Toggle({ type: ToggleType.Switch, isOn: this.switchOn })
                  .onChange((on: boolean) => { this.switchOn = on })
              }.width('100%').justifyContent(FlexAlign.SpaceBetween)

              Text('滑块 Slider').fontSize(16).fontWeight(FontWeight.Bold)
              Slider({ value: this.sliderVal, min: 0, max: 100, step: 1 })
                .onChange((v: number) => { this.sliderVal = v }).width('100%')

              Text('复选框 Checkbox').fontSize(16).fontWeight(FontWeight.Bold)
              Row() {
                Checkbox({ name: 'agree', group: 'g1' })
                  .select(this.checked).onChange((s: boolean) => { this.checked = s })
                Text('我已阅读并同意')
              }

              Text('单选框 Radio').fontSize(16).fontWeight(FontWeight.Bold)
              Column({ space: 8 }) {
                Row() {
                  Radio({ value: '0', group: 'radioGroup' }).checked(this.radioIdx === 0)
                    .onChange((c: boolean) => { if (c) this.radioIdx = 0 })
                  Text('选项一')
                }
                Row() {
                  Radio({ value: '1', group: 'radioGroup' }).checked(this.radioIdx === 1)
                    .onChange((c: boolean) => { if (c) this.radioIdx = 1 })
                  Text('选项二')
                }
              }
            }.padding(12)
          }.layoutWeight(1)
        }.tabBar('表单')

        // ===== Tab5 反馈 =====
        TabContent() {
          Column({ space: 24 }) {
            Text('进度条 Progress').fontSize(16).fontWeight(FontWeight.Bold)
            Progress({ value: 45, total: 100, type: ProgressType.Linear }).width('100%')
            Progress({ value: 60, total: 100, type: ProgressType.Circular }).width(64).height(64)

            Text('弹窗 Dialog').fontSize(16).fontWeight(FontWeight.Bold)
            Button('点我弹窗').type(ButtonType.Capsule)
              .onClick(() => { this.dialogVisible = true })
          }.padding(24).width('100%').height('100%').justifyContent(FlexAlign.Center)
        }.tabBar('反馈')
      }
      .barMode(BarMode.Fixed).width('100%').height('100%')
    }
    .width('100%').height('100%')
  }
}
