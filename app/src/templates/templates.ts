export interface Template {
  name: string
  icon: string
  description: string
  code: string
}

export interface TemplateCategory {
  label: string
  icon: string
  templates: Template[]
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    label: '基础',
    icon: '📄',
    templates: [
      {
        name: '空白页',
        icon: '📄',
        description: '最小 Column 骨架',
        code: `@Entry
@Component
struct BlankPage {
  build() {
    Column() {
      Text('空白页')
        .fontSize(20)
        .margin({ top: 20, bottom: 20 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '空状态',
        icon: '📭',
        description: '无数据占位 + 刷新按钮',
        code: `@Entry
@Component
struct EmptyState {
  build() {
    Column() {
      Text('📭')
        .fontSize(64)
        .margin({ bottom: 16 })
      Text('暂无数据')
        .fontSize(18)
        .fontColor('#333')
      Text('下拉刷新或点击按钮重试')
        .fontSize(13)
        .fontColor('#999')
        .margin({ top: 8 })
      Button('刷新')
        .type(ButtonType.Capsule)
        .width(120)
        .height(40)
        .backgroundColor('#07c160')
        .fontColor('#fff')
        .margin({ top: 24 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#f5f5f5')
    .justifyContent(FlexAlign.Center)
  }
}`
      },
      {
        name: '加载骨架屏',
        icon: '🗿',
        description: '灰色占位块模拟加载中',
        code: `@Entry
@Component
struct SkeletonScreen {
  build() {
    Scroll() {
      Column() {
        Row() {
          Column() {
            Row() {
              Text('')
                .width(60).height(60)
                .backgroundColor('#e0e0e0')
                .borderRadius(30)
              Column() {
                Text('').width(140).height(16).backgroundColor('#e0e0e0').borderRadius(4)
                Text('').width(100).height(12).backgroundColor('#e0e0e0').borderRadius(4).margin({ top: 8 })
              }.margin({ left: 12 }).layoutWeight(1)
            }.alignItems(VerticalAlign.Center)
          }
          .width('100%')
          .padding(16)
          .backgroundColor('#fff')
        }
        Row() {
          Text('').width('100%').height(180).backgroundColor('#e0e0e0')
        }.padding(16)

        Row() {
          Row() {
            Text('').width(40).height(40).backgroundColor('#e0e0e0').borderRadius(8)
            Column() {
              Text('').width(120).height(14).backgroundColor('#e0e0e0').borderRadius(4)
              Text('').width(80).height(10).backgroundColor('#e0e0e0').borderRadius(4).margin({ top: 6 })
            }.layoutWeight(1).margin({ left: 10 })
          }.alignItems(VerticalAlign.Center)
          .width('100%').padding(14)
          .backgroundColor('#fff')
        }
        Row() {
          Row() {
            Text('').width(40).height(40).backgroundColor('#e0e0e0').borderRadius(8)
            Column() {
              Text('').width(120).height(14).backgroundColor('#e0e0e0').borderRadius(4)
              Text('').width(80).height(10).backgroundColor('#e0e0e0').borderRadius(4).margin({ top: 6 })
            }.layoutWeight(1).margin({ left: 10 })
          }.alignItems(VerticalAlign.Center)
          .width('100%').padding(14)
          .backgroundColor('#fff')
        }
        Row() {
          Row() {
            Text('').width(40).height(40).backgroundColor('#e0e0e0').borderRadius(8)
            Column() {
              Text('').width(120).height(14).backgroundColor('#e0e0e0').borderRadius(4)
              Text('').width(80).height(10).backgroundColor('#e0e0e0').borderRadius(4).margin({ top: 6 })
            }.layoutWeight(1).margin({ left: 10 })
          }.alignItems(VerticalAlign.Center)
          .width('100%').padding(14)
          .backgroundColor('#fff')
        }
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '错误页',
        icon: '⚠️',
        description: '加载失败 + 重试',
        code: `@Entry
@Component
struct ErrorPage {
  build() {
    Column() {
      Text('⚠️')
        .fontSize(56)
      Text('加载失败')
        .fontSize(18)
        .fontColor('#333')
        .margin({ top: 12 })
      Text('网络连接异常，请检查后重试')
        .fontSize(13)
        .fontColor('#999')
        .margin({ top: 8 })
      Row() {
        Button('重试')
          .type(ButtonType.Capsule)
          .width(100).height(38)
          .backgroundColor('#07c160')
          .fontColor('#fff')
      }.margin({ top: 24 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#f5f5f5')
    .justifyContent(FlexAlign.Center)
  }
}`
      },
    ]
  },
  {
    label: '首页',
    icon: '🏠',
    templates: [
      {
        name: '标准首页',
        icon: '🏠',
        description: '导航 + 轮播 + 宫格 + 列表',
        code: `@Entry
@Component
struct HomePage {
  build() {
    Column() {
      Row() {
        Text('首页')
          .fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Stack() {
        Column() {
          Text('🎯 轮播图')
            .fontSize(16).fontColor('#fff')
        }.width('100%').height(150)
        .backgroundColor('#4CAF50').justifyContent(FlexAlign.Center)
      }

      Grid() {
        GridItem() {
          Column() {
            Text('🔧').fontSize(32)
            Text('功能一').fontSize(12).margin({ top: 4 })
          }.width('100%').alignItems(HorizontalAlign.Center)
        }
        GridItem() {
          Column() {
            Text('📦').fontSize(32)
            Text('功能二').fontSize(12).margin({ top: 4 })
          }.width('100%').alignItems(HorizontalAlign.Center)
        }
        GridItem() {
          Column() {
            Text('📋').fontSize(32)
            Text('功能三').fontSize(12).margin({ top: 4 })
          }.width('100%').alignItems(HorizontalAlign.Center)
        }
        GridItem() {
          Column() {
            Text('⚙️').fontSize(32)
            Text('功能四').fontSize(12).margin({ top: 4 })
          }.width('100%').alignItems(HorizontalAlign.Center)
        }
      }.columnsTemplate('1fr 1fr 1fr 1fr')
      .rowsGap(12).columnsGap(8)
      .padding(12).backgroundColor('#fff')

      Column() {
        Text('推荐内容').fontSize(16).margin({ bottom: 8 })
        Row() {
          Text('列表项一').fontSize(14).layoutWeight(1)
          Text('说明').fontSize(12).fontColor('#999')
        }.width('100%').padding(15)
        .border({ width: { bottom: 1 }, color: '#eee' })
        Row() {
          Text('列表项二').fontSize(14).layoutWeight(1)
          Text('说明').fontSize(12).fontColor('#999')
        }.width('100%').padding(15)
        .border({ width: { bottom: 1 }, color: '#eee' })
      }.padding(12).backgroundColor('#fff').layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '仪表盘',
        icon: '📊',
        description: '统计卡片 + 进度条 + 动态',
        code: `@Entry
@Component
struct Dashboard {
  build() {
    Scroll() {
      Column() {
        Row() {
          Text('仪表盘')
            .fontSize(20).fontColor('#fff')
            .layoutWeight(1).textAlign(TextAlign.Center)
        }.width('100%').height(56).backgroundColor('#1a1a2e')

        Row() {
          Column() {
            Text('8,425').fontSize(24).fontColor('#07c160')
            Text('今日访问').fontSize(11).fontColor('#999').margin({ top: 4 })
          }.layoutWeight(1).alignItems(HorizontalAlign.Center).padding(12)

          Column() {
            Text('1,234').fontSize(24).fontColor('#ff9800')
            Text('新增用户').fontSize(11).fontColor('#999').margin({ top: 4 })
          }.layoutWeight(1).alignItems(HorizontalAlign.Center).padding(12)
        }.width('100%').backgroundColor('#fff')

        Row() {
          Column() {
            Text('567').fontSize(24).fontColor('#2196f3')
            Text('订单数').fontSize(11).fontColor('#999').margin({ top: 4 })
          }.layoutWeight(1).alignItems(HorizontalAlign.Center).padding(12)

          Column() {
            Text('89%').fontSize(24).fontColor('#e91e63')
            Text('完成率').fontSize(11).fontColor('#999').margin({ top: 4 })
          }.layoutWeight(1).alignItems(HorizontalAlign.Center).padding(12)
        }.width('100%').backgroundColor('#fff').border({ width: { top: 1 }, color: '#f0f0f0' })

        Column() {
          Text('任务进度').fontSize(15).margin({ bottom: 12 })
          Column() {
            Row() {
              Text('需求开发').fontSize(13).layoutWeight(1)
              Text('85%').fontSize(13).fontColor('#07c160')
            }
            Progress({ value: 85, total: 100 }).color('#07c160')
          }.margin({ bottom: 16 })
          Column() {
            Row() {
              Text('测试验收').fontSize(13).layoutWeight(1)
              Text('60%').fontSize(13).fontColor('#ff9800')
            }
            Progress({ value: 60, total: 100 }).color('#ff9800')
          }.margin({ bottom: 16 })
          Column() {
            Row() {
              Text('上线部署').fontSize(13).layoutWeight(1)
              Text('30%').fontSize(13).fontColor('#f44336')
            }
            Progress({ value: 30, total: 100 }).color('#f44336')
          }
        }.width('100%').padding(16).backgroundColor('#fff').margin({ top: 8 })

        Column() {
          Text('最近动态').fontSize(15).margin({ bottom: 8 })
          Row() {
            Text('✅').fontSize(16)
            Text('用户「张三」完成了实名认证')
              .fontSize(13).layoutWeight(1).margin({ left: 8 })
          }.width('100%').padding(8)
          Row() {
            Text('🔔').fontSize(16)
            Text('系统版本 v2.1 已发布')
              .fontSize(13).layoutWeight(1).margin({ left: 8 })
          }.width('100%').padding(8)
          Row() {
            Text('⚠️').fontSize(16)
            Text('服务器 CPU 使用率超过 80%')
              .fontSize(13).layoutWeight(1).margin({ left: 8 })
          }.width('100%').padding(8)
        }.width('100%').padding(16).backgroundColor('#fff').margin({ top: 8 })
      }
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '带Tab首页',
        icon: '📑',
        description: '标签页切换不同内容',
        code: `@Entry
@Component
struct TabHome {
  build() {
    Column() {
      Row() {
        Text('应用')
          .fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Tabs() {
        TabContent() {
          Column() {
            Text('推荐内容').fontSize(16)
            Text('这里展示推荐的内容列表').fontSize(13).fontColor('#999').margin({ top: 8 })
          }.width('100%').padding(16).justifyContent(FlexAlign.Center)
        }.tabBar('推荐')

        TabContent() {
          Column() {
            Text('热门排行').fontSize(16)
            Row() {
              Text('1').fontSize(18).fontColor('#ff4500').width(32)
              Text('热门内容一').fontSize(14).layoutWeight(1)
              Text('🔥').fontSize(16)
            }.width('100%').padding(12)
            Row() {
              Text('2').fontSize(18).fontColor('#ff8c00').width(32)
              Text('热门内容二').fontSize(14).layoutWeight(1)
            }.width('100%').padding(12)
            Row() {
              Text('3').fontSize(18).fontColor('#ffa500').width(32)
              Text('热门内容三').fontSize(14).layoutWeight(1)
            }.width('100%').padding(12)
          }.width('100%').padding(16)
        }.tabBar('热门')

        TabContent() {
          Column() {
            Text('最新发布').fontSize(16)
            Text('2024-01-15').fontSize(13).fontColor('#999').margin({ top: 8 })
            Text('这是一个最新发布的内容项').fontSize(14).margin({ top: 8 })
            Text('2024-01-14').fontSize(13).fontColor('#999').margin({ top: 12 })
            Text('这是另一个最新发布的内容项').fontSize(14).margin({ top: 8 })
          }.width('100%').padding(16)
        }.tabBar('最新')
      }.layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#fff')
  }
}`
      },
      {
        name: '分类导航',
        icon: '🗂️',
        description: '搜索 + 分类宫格 + 热门',
        code: `@Entry
@Component
struct CategoryNav {
  build() {
    Column() {
      Row() {
        Text('🔍').fontSize(16)
        TextInput({ placeholder: '搜索功能、服务' })
          .layoutWeight(1).height(36).margin({ left: 8 })
      }.width('100%').padding(12).backgroundColor('#fff')

      Column() {
        Text('常用功能').fontSize(15).margin({ bottom: 12 })
        Grid() {
          GridItem() {
            Column() {
              Text('💳').fontSize(32)
              Text('支付').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
          GridItem() {
            Column() {
              Text('🚗').fontSize(32)
              Text('出行').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
          GridItem() {
            Column() {
              Text('🍜').fontSize(32)
              Text('美食').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
          GridItem() {
            Column() {
              Text('🎬').fontSize(32)
              Text('电影').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
          GridItem() {
            Column() {
              Text('🏥').fontSize(32)
              Text('医疗').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
          GridItem() {
            Column() {
              Text('📚').fontSize(32)
              Text('教育').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
          GridItem() {
            Column() {
              Text('🎮').fontSize(32)
              Text('游戏').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
          GridItem() {
            Column() {
              Text('✈️').fontSize(32)
              Text('旅游').fontSize(12).margin({ top: 4 })
            }.width('100%').alignItems(HorizontalAlign.Center).padding(12)
          }
        }.columnsTemplate('1fr 1fr 1fr 1fr')
        .rowsGap(4).columnsGap(4)
      }.width('100%').padding(16).backgroundColor('#fff').margin({ top: 8 })

      Column() {
        Text('热门推荐').fontSize(15).margin({ bottom: 8 })
        Row() {
          Text('🔥').fontSize(16)
          Text('限时优惠：全场五折起')
            .fontSize(14).layoutWeight(1).margin({ left: 8 })
          Text('>').fontColor('#ccc')
        }.width('100%').padding(12)
        .border({ width: { bottom: 1 }, color: '#f5f5f5' })
        Row() {
          Text('🆕').fontSize(16)
          Text('新功能上线：智能推荐')
            .fontSize(14).layoutWeight(1).margin({ left: 8 })
          Text('>').fontColor('#ccc')
        }.width('100%').padding(12)
      }.width('100%').padding(16).backgroundColor('#fff').margin({ top: 8 }).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '极简首页',
        icon: '⬜',
        description: '大标题 + 单列内容',
        code: `@Entry
@Component
struct MinimalHome {
  build() {
    Column() {
      Text('你好，鸿蒙 👋')
        .fontSize(28).fontColor('#1a1a1a')
        .margin({ top: 24, left: 20 })
        .alignSelf(ItemAlign.Start)

      Text('今天也要元气满满哦')
        .fontSize(14).fontColor('#999')
        .margin({ left: 20, top: 4 })
        .alignSelf(ItemAlign.Start)

      Column() {
        Row() {
          Text('☀️').fontSize(24)
          Column() {
            Text('今日天气').fontSize(12).fontColor('#999')
            Text('晴 26°C').fontSize(18).fontColor('#333').margin({ top: 2 })
          }.margin({ left: 12 }).layoutWeight(1)
          Text('良').fontSize(24).fontColor('#07c160')
        }.width('100%').padding(16)
        .backgroundColor('#fff').borderRadius(12)
      }.padding(12)

      Column() {
        Text('待办事项').fontSize(16).fontColor('#333').margin({ bottom: 12 })
          .alignSelf(ItemAlign.Start)
        Row() {
          Text('☐').fontSize(18)
          Text('完成项目文档').fontSize(14).layoutWeight(1).margin({ left: 8 })
          Text('10:00').fontSize(12).fontColor('#999')
        }.width('100%').padding(8)
        Row() {
          Text('☐').fontSize(18)
          Text('回复客户邮件').fontSize(14).layoutWeight(1).margin({ left: 8 })
          Text('14:00').fontSize(12).fontColor('#999')
        }.width('100%').padding(8)
        Row() {
          Text('✅').fontSize(18)
          Text('晨会已结束').fontSize(14).layoutWeight(1).margin({ left: 8 })
            .fontColor('#ccc')
          Text('09:00').fontSize(12).fontColor('#ccc')
        }.width('100%').padding(8)
      }.width('100%').padding(16).backgroundColor('#fff')
      .borderRadius(12).margin({ top: 12 }).layoutWeight(1)
    }.width('100%').height('100%')
    .backgroundColor('#f5f5f5').alignItems(HorizontalAlign.Start)
  }
}`
      },
    ]
  },
  {
    label: '列表',
    icon: '📋',
    templates: [
      {
        name: '图文列表',
        icon: '📰',
        description: '缩略图 + 标题 + 摘要 + 箭头',
        code: `@Entry
@Component
struct ImageList {
  build() {
    Column() {
      Row() {
        Text('图文列表').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      List() {
        ListItem() {
          Row() {
            Text('🖼️').fontSize(36).width(56).textAlign(TextAlign.Center)
            Column() {
              Text('标题文字内容一').fontSize(15).width('100%')
              Text('这是列表项的描述摘要文字').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Text('>').fontSize(16).fontColor('#ccc')
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
        ListItem() {
          Row() {
            Text('📷').fontSize(36).width(56).textAlign(TextAlign.Center)
            Column() {
              Text('标题文字内容二').fontSize(15).width('100%')
              Text('这是列表项的描述摘要文字').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Text('>').fontSize(16).fontColor('#ccc')
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
        ListItem() {
          Row() {
            Text('🎵').fontSize(36).width(56).textAlign(TextAlign.Center)
            Column() {
              Text('标题文字内容三').fontSize(15).width('100%')
              Text('这是列表项的描述摘要文字').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Text('>').fontSize(16).fontColor('#ccc')
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
        ListItem() {
          Row() {
            Text('📄').fontSize(36).width(56).textAlign(TextAlign.Center)
            Column() {
              Text('标题文字内容四').fontSize(15).width('100%')
              Text('这是列表项的描述摘要文字').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Text('>').fontSize(16).fontColor('#ccc')
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
      }.layoutWeight(1).backgroundColor('#fff')
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '消息列表',
        icon: '💬',
        description: '头像 + 昵称 + 最后消息 + 未读',
        code: `@Entry
@Component
struct MessageList {
  build() {
    Column() {
      Row() {
        Text('消息').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      List() {
        ListItem() {
          Row() {
            Text('👨').fontSize(36).width(48).textAlign(TextAlign.Center)
            Column() {
              Text('张三').fontSize(15).width('100%')
              Text('你好，会议改到下午3点').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Column() {
              Text('14:32').fontSize(11).fontColor('#ccc')
              Text('3').fontSize(11).fontColor('#fff')
                .backgroundColor('#f44336').borderRadius(8)
                .width(18).height(18).textAlign(TextAlign.Center)
                .margin({ top: 4 })
            }.alignItems(HorizontalAlign.End)
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
        ListItem() {
          Row() {
            Text('👩').fontSize(36).width(48).textAlign(TextAlign.Center)
            Column() {
              Text('李四').fontSize(15).width('100%')
              Text('文件已发送，请查收').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Column() {
              Text('13:10').fontSize(11).fontColor('#ccc')
              Text('1').fontSize(11).fontColor('#fff')
                .backgroundColor('#f44336').borderRadius(8)
                .width(18).height(18).textAlign(TextAlign.Center)
                .margin({ top: 4 })
            }.alignItems(HorizontalAlign.End)
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
        ListItem() {
          Row() {
            Text('🤖').fontSize(36).width(48).textAlign(TextAlign.Center)
            Column() {
              Text('系统通知').fontSize(15).width('100%')
              Text('你的账号已通过实名认证').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Column() {
              Text('昨天').fontSize(11).fontColor('#ccc')
            }.alignItems(HorizontalAlign.End)
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
        ListItem() {
          Row() {
            Text('📢').fontSize(36).width(48).textAlign(TextAlign.Center)
            Column() {
              Text('群公告').fontSize(15).width('100%')
              Text('本周五下午部门团建活动').fontSize(12).fontColor('#999').margin({ top: 4 }).width('100%')
            }.layoutWeight(1).margin({ left: 8 })
            Column() {
              Text('周一').fontSize(11).fontColor('#ccc')
            }.alignItems(HorizontalAlign.End)
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }
      }.layoutWeight(1).backgroundColor('#fff')
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '卡片列表',
        icon: '🗂️',
        description: '独立卡片样式列表项',
        code: `@Entry
@Component
struct CardList {
  build() {
    Column() {
      Row() {
        Text('卡片列表').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Scroll() {
        Column() {
          Column() {
            Row() {
              Text('📦').fontSize(28)
              Column() {
                Text('商品名称一').fontSize(15)
                Text('¥ 99.00').fontSize(16).fontColor('#f44336').margin({ top: 2 })
              }.margin({ left: 10 }).layoutWeight(1)
              Text('已售128').fontSize(11).fontColor('#999')
            }.width('100%').alignItems(VerticalAlign.Center)
            Text('这是商品的详细描述信息，支持多行显示').fontSize(12).fontColor('#666').margin({ top: 8 })
          }.width('100%').padding(14).backgroundColor('#fff')
          .borderRadius(8).margin({ bottom: 8 })

          Column() {
            Row() {
              Text('🎁').fontSize(28)
              Column() {
                Text('商品名称二').fontSize(15)
                Text('¥ 156.00').fontSize(16).fontColor('#f44336').margin({ top: 2 })
              }.margin({ left: 10 }).layoutWeight(1)
              Text('已售89').fontSize(11).fontColor('#999')
            }.width('100%').alignItems(VerticalAlign.Center)
            Text('这是商品的详细描述信息，支持多行显示').fontSize(12).fontColor('#666').margin({ top: 8 })
          }.width('100%').padding(14).backgroundColor('#fff')
          .borderRadius(8).margin({ bottom: 8 })

          Column() {
            Row() {
              Text('🛍️').fontSize(28)
              Column() {
                Text('商品名称三').fontSize(15)
                Text('¥ 256.00').fontSize(16).fontColor('#f44336').margin({ top: 2 })
              }.margin({ left: 10 }).layoutWeight(1)
              Text('已售456').fontSize(11).fontColor('#999')
            }.width('100%').alignItems(VerticalAlign.Center)
            Text('这是商品的详细描述信息，支持多行显示').fontSize(12).fontColor('#666').margin({ top: 8 })
          }.width('100%').padding(14).backgroundColor('#fff')
          .borderRadius(8).margin({ bottom: 8 })
        }.padding(12)
      }.layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '设置列表',
        icon: '⚙️',
        description: '图标 + 标题 + 值/开关/箭头',
        code: `@Entry
@Component
struct SettingsList {
  build() {
    Column() {
      Row() {
        Text('设置').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Column() {
        Text('账号').fontSize(13).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
        Column() {
          Row() {
            Text('👤').fontSize(20).width(32)
            Text('个人资料').fontSize(14).layoutWeight(1)
            Text('>').fontSize(14).fontColor('#ccc')
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
          Row() {
            Text('🔒').fontSize(20).width(32)
            Text('账号安全').fontSize(14).layoutWeight(1)
            Text('>').fontSize(14).fontColor('#ccc')
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }.backgroundColor('#fff').borderRadius(8)
      }.width('100%').padding(12)

      Column() {
        Text('通知').fontSize(13).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
        Column() {
          Row() {
            Text('🔔').fontSize(20).width(32)
            Text('消息通知').fontSize(14).layoutWeight(1)
            Toggle({ type: ToggleType.Switch, isOn: true })
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
          Row() {
            Text('🔇').fontSize(20).width(32)
            Text('免打扰模式').fontSize(14).layoutWeight(1)
            Toggle({ type: ToggleType.Switch, isOn: false })
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }.backgroundColor('#fff').borderRadius(8)
      }.width('100%').padding(12)

      Column() {
        Text('其他').fontSize(13).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
        Column() {
          Row() {
            Text('🌙').fontSize(20).width(32)
            Text('深色模式').fontSize(14).layoutWeight(1)
            Text('跟随系统').fontSize(12).fontColor('#999')
            Text('>').fontSize(14).fontColor('#ccc').margin({ left: 4 })
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
          Row() {
            Text('🌐').fontSize(20).width(32)
            Text('语言').fontSize(14).layoutWeight(1)
            Text('简体中文').fontSize(12).fontColor('#999')
            Text('>').fontSize(14).fontColor('#ccc').margin({ left: 4 })
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
          Row() {
            Text('ℹ️').fontSize(20).width(32)
            Text('关于').fontSize(14).layoutWeight(1)
            Text('v1.0.0').fontSize(12).fontColor('#999')
            Text('>').fontSize(14).fontColor('#ccc').margin({ left: 4 })
          }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        }.backgroundColor('#fff').borderRadius(8)
      }.width('100%').padding(12).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
    ]
  },
  {
    label: '表单',
    icon: '📝',
    templates: [
      {
        name: '登录页',
        icon: '🔑',
        description: 'Logo + 输入 + 登录按钮',
        code: `@Entry
@Component
struct LoginPage {
  build() {
    Column() {
      Text('🔐').fontSize(48).margin({ top: 60, bottom: 8 })
      Text('欢迎登录').fontSize(24).fontColor('#333')
      Text('请输入您的账号信息').fontSize(13).fontColor('#999').margin({ top: 4 })

      Column() {
        TextInput({ placeholder: '手机号/邮箱' }).height(44).width('100%')
        TextInput({ placeholder: '密码' }).height(44).width('100%').margin({ top: 12 })
        Button('登录')
          .type(ButtonType.Capsule).width('100%').height(44)
          .backgroundColor('#07c160').fontColor('#fff').margin({ top: 20 })
        Row() {
          Text('忘记密码?').fontSize(12).fontColor('#07c160')
        }.width('100%').justifyContent(FlexAlign.Center).margin({ top: 16 })
      }.width('80%').margin({ top: 40 })
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
    .alignItems(HorizontalAlign.Center)
  }
}`
      },
      {
        name: '注册页',
        icon: '📋',
        description: '多字段 + 复选协议 + 注册',
        code: `@Entry
@Component
struct RegisterPage {
  build() {
    Column() {
      Row() {
        Text('注册').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Scroll() {
        Column() {
          Column() {
            Text('创建新账号').fontSize(22).fontColor('#333').margin({ top: 20, bottom: 4 })
              .alignSelf(ItemAlign.Start)
            Text('请填写以下信息完成注册').fontSize(13).fontColor('#999').margin({ bottom: 20 })
              .alignSelf(ItemAlign.Start)
          }.width('100%').padding({ left: 20, right: 20 })

          Column() {
            Text('用户名').fontSize(13).fontColor('#666').margin({ bottom: 6 }).alignSelf(ItemAlign.Start)
            TextInput({ placeholder: '请输入用户名' }).height(44).width('100%')
          }.width('100%').padding({ left: 20, right: 20, bottom: 16 })

          Column() {
            Text('手机号').fontSize(13).fontColor('#666').margin({ bottom: 6 }).alignSelf(ItemAlign.Start)
            TextInput({ placeholder: '请输入手机号' }).height(44).width('100%')
          }.width('100%').padding({ left: 20, right: 20, bottom: 16 })

          Column() {
            Text('验证码').fontSize(13).fontColor('#666').margin({ bottom: 6 }).alignSelf(ItemAlign.Start)
            Row() {
              TextInput({ placeholder: '请输入验证码' }).height(44).layoutWeight(1)
              Button('获取验证码')
                .height(44).fontSize(12)
                .backgroundColor('#fff').fontColor('#07c160')
                .border({ width: 1, color: '#07c160' })
                .margin({ left: 8 })
            }.width('100%')
          }.width('100%').padding({ left: 20, right: 20, bottom: 16 })

          Column() {
            Text('密码').fontSize(13).fontColor('#666').margin({ bottom: 6 }).alignSelf(ItemAlign.Start)
            TextInput({ placeholder: '请设置密码（6-20位）' }).height(44).width('100%')
          }.width('100%').padding({ left: 20, right: 20, bottom: 16 })

          Column() {
            Text('确认密码').fontSize(13).fontColor('#666').margin({ bottom: 6 }).alignSelf(ItemAlign.Start)
            TextInput({ placeholder: '请再次输入密码' }).height(44).width('100%')
          }.width('100%').padding({ left: 20, right: 20, bottom: 16 })

          Row() {
            Checkbox({ name: 'agree', group: 'reg' }).width(16).height(16)
            Text('我已阅读并同意').fontSize(12).fontColor('#666').margin({ left: 6 })
            Text('《用户协议》').fontSize(12).fontColor('#07c160')
          }.alignItems(VerticalAlign.Center).margin({ bottom: 20 })

          Button('注册')
            .type(ButtonType.Capsule).width('90%').height(44)
            .backgroundColor('#07c160').fontColor('#fff')

          Row() {
            Text('已有账号?').fontSize(13).fontColor('#666')
            Text('去登录').fontSize(13).fontColor('#07c160')
          }.margin({ top: 16, bottom: 20 })
        }
      }.layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '搜索页',
        icon: '🔍',
        description: '搜索栏 + 热搜 + 历史',
        code: `@Entry
@Component
struct SearchPage {
  build() {
    Column() {
      Row() {
        Text('<').fontSize(20).fontColor('#333')
        TextInput({ placeholder: '搜索关键词' })
          .layoutWeight(1).height(36).margin({ left: 8 })
        Text('搜索').fontSize(14).fontColor('#07c160')
      }.width('100%').padding(12).backgroundColor('#fff')

      Column() {
        Text('热搜榜').fontSize(15).fontColor('#333').margin({ bottom: 12 }).alignSelf(ItemAlign.Start)
        Row() {
          Text('1').fontSize(14).fontColor('#f44336').width(24)
          Text('鸿蒙系统').fontSize(14).layoutWeight(1)
          Text('🔥').fontSize(14)
        }.width('100%').padding(8)
        Row() {
          Text('2').fontSize(14).fontColor('#ff9800').width(24)
          Text('ArkTS 教程').fontSize(14).layoutWeight(1)
          Text('🔥').fontSize(14)
        }.width('100%').padding(8)
        Row() {
          Text('3').fontSize(14).fontColor('#ff9800').width(24)
          Text('声明式 UI').fontSize(14).layoutWeight(1)
        }.width('100%').padding(8)
        Row() {
          Text('4').fontSize(14).fontColor('#999').width(24)
          Text('DevEco Studio').fontSize(14).layoutWeight(1)
        }.width('100%').padding(8)
        Row() {
          Text('5').fontSize(14).fontColor('#999').width(24)
          Text('HarmonyOS 应用开发').fontSize(14).layoutWeight(1)
        }.width('100%').padding(8)
      }.width('100%').padding(16).backgroundColor('#fff').margin({ top: 8 })

      Column() {
        Row() {
          Text('搜索历史').fontSize(15).layoutWeight(1)
          Text('🗑️').fontSize(16)
        }.width('100%').margin({ bottom: 8 })
        Row() {
          Text('华为手机').fontSize(13).padding({ left: 12, right: 12, top: 6, bottom: 6 })
            .backgroundColor('#f0f0f0').borderRadius(16)
          Text('应用开发').fontSize(13).padding({ left: 12, right: 12, top: 6, bottom: 6 })
            .backgroundColor('#f0f0f0').borderRadius(16).margin({ left: 8 })
          Text('ArkUI').fontSize(13).padding({ left: 12, right: 12, top: 6, bottom: 6 })
            .backgroundColor('#f0f0f0').borderRadius(16).margin({ left: 8 })
        }.alignItems(VerticalAlign.Center)
        Row() {
          Text('TabContent').fontSize(13).padding({ left: 12, right: 12, top: 6, bottom: 6 })
            .backgroundColor('#f0f0f0').borderRadius(16).margin({ top: 8 })
          Text('ForEach').fontSize(13).padding({ left: 12, right: 12, top: 6, bottom: 6 })
            .backgroundColor('#f0f0f0').borderRadius(16).margin({ left: 8, top: 8 })
        }.alignItems(VerticalAlign.Center)
      }.width('100%').padding(16).backgroundColor('#fff').margin({ top: 8 }).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '反馈表单',
        icon: '💌',
        description: '类型 + 内容 + 评分 + 提交',
        code: `@Entry
@Component
struct FeedbackForm {
  build() {
    Column() {
      Row() {
        Text('意见反馈').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Scroll() {
        Column() {
          Column() {
            Text('反馈类型').fontSize(14).fontColor('#333').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
            Row() {
              Text('功能建议').fontSize(13).padding({ left: 16, right: 16, top: 8, bottom: 8 })
                .backgroundColor('#07c160').fontColor('#fff').borderRadius(20)
              Text('问题反馈').fontSize(13).padding({ left: 16, right: 16, top: 8, bottom: 8 })
                .backgroundColor('#f0f0f0').fontColor('#666').borderRadius(20).margin({ left: 8 })
              Text('其他').fontSize(13).padding({ left: 16, right: 16, top: 8, bottom: 8 })
                .backgroundColor('#f0f0f0').fontColor('#666').borderRadius(20).margin({ left: 8 })
            }.alignItems(VerticalAlign.Center)
          }.width('100%').padding(20).backgroundColor('#fff')

          Column() {
            Text('问题描述').fontSize(14).fontColor('#333').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
            TextInput({ placeholder: '请详细描述您遇到的问题或建议...' })
              .height(120).width('100%')
          }.width('100%').padding(20).backgroundColor('#fff').margin({ top: 8 })

          Column() {
            Text('满意度评分').fontSize(14).fontColor('#333').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
            Row() {
              Slider({ value: 80, min: 0, max: 100, step: 10 })
                .layoutWeight(1)
              Text('80分').fontSize(14).fontColor('#07c160').margin({ left: 8 })
            }.alignItems(VerticalAlign.Center)
          }.width('100%').padding(20).backgroundColor('#fff').margin({ top: 8 })

          Column() {
            Text('联系方式').fontSize(14).fontColor('#333').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
            TextInput({ placeholder: '手机号或邮箱（选填）' })
              .height(44).width('100%')
          }.width('100%').padding(20).backgroundColor('#fff').margin({ top: 8 })

          Button('提交反馈')
            .type(ButtonType.Capsule).width('90%').height(44)
            .backgroundColor('#07c160').fontColor('#fff').margin({ top: 20, bottom: 20 })
        }
      }.layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
    ]
  },
  {
    label: '网格',
    icon: '🔲',
    templates: [
      {
        name: '九宫格',
        icon: '🔢',
        description: '3x3 应用快捷入口',
        code: `@Entry
@Component
struct AppGrid {
  build() {
    Column() {
      Row() {
        Text('全部应用').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Grid() {
        GridItem() {
          Column() {
            Text('💬').fontSize(36)
            Text('消息').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('📞').fontSize(36)
            Text('电话').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('📷').fontSize(36)
            Text('相机').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('🎵').fontSize(36)
            Text('音乐').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('🗺️').fontSize(36)
            Text('地图').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('⏰').fontSize(36)
            Text('时钟').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('📅').fontSize(36)
            Text('日历').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('🌤️').fontSize(36)
            Text('天气').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
        GridItem() {
          Column() {
            Text('⚙️').fontSize(36)
            Text('设置').fontSize(12).margin({ top: 6 })
          }.width('100%').alignItems(HorizontalAlign.Center).padding(16)
        }
      }.columnsTemplate('1fr 1fr 1fr')
      .rowsGap(8).columnsGap(8)
      .padding(12).backgroundColor('#fff')
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '图片画廊',
        icon: '🖼️',
        description: '2列图片瀑布流',
        code: `@Entry
@Component
struct PhotoGallery {
  build() {
    Column() {
      Row() {
        Text('图片画廊').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Grid() {
        GridItem() {
          Column() {
            Text('🌅').fontSize(48)
                .width('100%').height(120)
                .backgroundColor('#ff9800')
                .textAlign(TextAlign.Center)
            Text('日出').fontSize(12).fontColor('#666').margin({ top: 4 })
          }.width('100%')
        }
        GridItem() {
          Column() {
            Text('🌊').fontSize(48)
                .width('100%').height(160)
                .backgroundColor('#2196f3')
                .textAlign(TextAlign.Center)
            Text('海浪').fontSize(12).fontColor('#666').margin({ top: 4 })
          }.width('100%')
        }
        GridItem() {
          Column() {
            Text('🏔️').fontSize(48)
                .width('100%').height(140)
                .backgroundColor('#8d6e63')
                .textAlign(TextAlign.Center)
            Text('山脉').fontSize(12).fontColor('#666').margin({ top: 4 })
          }.width('100%')
        }
        GridItem() {
          Column() {
            Text('🌸').fontSize(48)
                .width('100%').height(100)
                .backgroundColor('#e91e63')
                .textAlign(TextAlign.Center)
            Text('花海').fontSize(12).fontColor('#666').margin({ top: 4 })
          }.width('100%')
        }
        GridItem() {
          Column() {
            Text('🌳').fontSize(48)
                .width('100%').height(130)
                .backgroundColor('#4caf50')
                .textAlign(TextAlign.Center)
            Text('森林').fontSize(12).fontColor('#666').margin({ top: 4 })
          }.width('100%')
        }
        GridItem() {
          Column() {
            Text('🌙️').fontSize(48)
                .width('100%').height(110)
                .backgroundColor('#3f51b5')
                .textAlign(TextAlign.Center)
            Text('月夜').fontSize(12).fontColor('#666').margin({ top: 4 })
          }.width('100%')
        }
      }.columnsTemplate('1fr 1fr')
      .rowsGap(8).columnsGap(8)
      .padding(12).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '商品网格',
        icon: '🛒',
        description: '2列商品卡片',
        code: `@Entry
@Component
struct ProductGrid {
  build() {
    Column() {
      Row() {
        Text('热卖商品').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#e83e3e')

      Grid() {
        GridItem() {
          Column() {
            Text('📦').fontSize(40)
              .width('100%').height(120)
              .backgroundColor('#f9f9f9')
              .textAlign(TextAlign.Center)
            Text('无线蓝牙耳机').fontSize(14).fontColor('#333').margin({ top: 6 }).width('100%')
            Row() {
              Text('¥199').fontSize(16).fontColor('#e83e3e')
              Text('¥299').fontSize(12).fontColor('#999').margin({ left: 4 })
                .decoration({ type: TextDecorationType.LineThrough })
            }.margin({ top: 4 })
          }.width('100%').padding(8).backgroundColor('#fff').borderRadius(8)
        }
        GridItem() {
          Column() {
            Text('⌚').fontSize(40)
              .width('100%').height(120)
              .backgroundColor('#f9f9f9')
              .textAlign(TextAlign.Center)
            Text('智能手表').fontSize(14).fontColor('#333').margin({ top: 6 }).width('100%')
            Row() {
              Text('¥459').fontSize(16).fontColor('#e83e3e')
              Text('¥599').fontSize(12).fontColor('#999').margin({ left: 4 })
                .decoration({ type: TextDecorationType.LineThrough })
            }.margin({ top: 4 })
          }.width('100%').padding(8).backgroundColor('#fff').borderRadius(8)
        }
        GridItem() {
          Column() {
            Text('🔌').fontSize(40)
              .width('100%').height(120)
              .backgroundColor('#f9f9f9')
              .textAlign(TextAlign.Center)
            Text('快充充电器').fontSize(14).fontColor('#333').margin({ top: 6 }).width('100%')
            Row() {
              Text('¥89').fontSize(16).fontColor('#e83e3e')
            }.margin({ top: 4 })
          }.width('100%').padding(8).backgroundColor('#fff').borderRadius(8)
        }
        GridItem() {
          Column() {
            Text('📱').fontSize(40)
              .width('100%').height(120)
              .backgroundColor('#f9f9f9')
              .textAlign(TextAlign.Center)
            Text('手机保护壳').fontSize(14).fontColor('#333').margin({ top: 6 }).width('100%')
            Row() {
              Text('¥39').fontSize(16).fontColor('#e83e3e')
            }.margin({ top: 4 })
          }.width('100%').padding(8).backgroundColor('#fff').borderRadius(8)
        }
      }.columnsTemplate('1fr 1fr')
      .rowsGap(8).columnsGap(8)
      .padding(8).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '功能网格',
        icon: '🎛️',
        description: '4列紧凑功能入口',
        code: `@Entry
@Component
struct FeatureGrid {
  build() {
    Column() {
      Row() {
        Text('功能中心').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#6200ee')

      Column() {
        Text('常用工具').fontSize(14).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
        Grid() {
          GridItem() {
            Column() {
              Text('📐').fontSize(28)
              Text('计算器').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('📋').fontSize(28)
              Text('备忘录').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('🔍').fontSize(28)
              Text('搜索').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('✂️').fontSize(28)
              Text('剪贴板').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
        }.columnsTemplate('1fr 1fr 1fr 1fr')
        .backgroundColor('#fff').borderRadius(8)
      }.width('100%').padding(12)

      Column() {
        Text('生活服务').fontSize(14).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
        Grid() {
          GridItem() {
            Column() {
              Text('🚕').fontSize(28)
              Text('打车').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('🍔').fontSize(28)
              Text('外卖').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('🏥').fontSize(28)
              Text('挂号').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('🎬').fontSize(28)
              Text('电影票').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
        }.columnsTemplate('1fr 1fr 1fr 1fr')
        .backgroundColor('#fff').borderRadius(8)
      }.width('100%').padding(12).margin({ top: 8 })

      Column() {
        Text('更多功能').fontSize(14).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
        Grid() {
          GridItem() {
            Column() {
              Text('📈').fontSize(28)
              Text('股票').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('💰').fontSize(28)
              Text('理财').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('✈️').fontSize(28)
              Text('机票').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
          GridItem() {
            Column() {
              Text('🏨').fontSize(28)
              Text('酒店').fontSize(11).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Center).padding(8)
          }
        }.columnsTemplate('1fr 1fr 1fr 1fr')
        .backgroundColor('#fff').borderRadius(8)
      }.width('100%').padding(12).margin({ top: 8 }).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
    ]
  },
  {
    label: '个人中心',
    icon: '👤',
    templates: [
      {
        name: '基础个人中心',
        icon: '👤',
        description: '头像 + 宫格 + 列表',
        code: `@Entry
@Component
struct ProfilePage {
  build() {
    Column() {
      Row() {
        Text('个人中心').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Row() {
        Column() {
          Text('👤').fontSize(40)
          Text('用户昵称').fontSize(16).fontColor('#333').margin({ top: 8 })
          Text('个性签名 · 这是个性描述').fontSize(12).fontColor('#999').margin({ top: 4 })
        }.alignItems(HorizontalAlign.Center)
      }.width('100%').padding(20).backgroundColor('#fff')

      Grid() {
        GridItem() {
          Column() {
            Text('📦').fontSize(28)
            Text('我的订单').fontSize(12).margin({ top: 4 })
          }.alignItems(HorizontalAlign.Center).padding(8)
        }
        GridItem() {
          Column() {
            Text('❤️').fontSize(28)
            Text('我的收藏').fontSize(12).margin({ top: 4 })
          }.alignItems(HorizontalAlign.Center).padding(8)
        }
        GridItem() {
          Column() {
            Text('🎫').fontSize(28)
            Text('优惠券').fontSize(12).margin({ top: 4 })
          }.alignItems(HorizontalAlign.Center).padding(8)
        }
        GridItem() {
          Column() {
            Text('⚙️').fontSize(28)
            Text('设置').fontSize(12).margin({ top: 4 })
          }.alignItems(HorizontalAlign.Center).padding(8)
        }
      }.columnsTemplate('1fr 1fr 1fr 1fr').padding(12).backgroundColor('#fff')

      Column() {
        Row() {
          Text('帮助中心').fontSize(14).layoutWeight(1)
          Text('>').fontSize(14).fontColor('#ccc')
        }.width('100%').padding(15).border({ width: { bottom: 1 }, color: '#eee' })
        Row() {
          Text('关于我们').fontSize(14).layoutWeight(1)
          Text('>').fontSize(14).fontColor('#ccc')
        }.width('100%').padding(15)
      }.backgroundColor('#fff').layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '详细个人中心',
        icon: '👑',
        description: '封面 + 统计 + 菜单',
        code: `@Entry
@Component
struct ProfileDetail {
  build() {
    Column() {
      Stack() {
        Column() {
          Text('')
        }.width('100%').height(120).backgroundColor('#6200ee')

        Column() {
          Text('👤').fontSize(48)
            .width(80).height(80)
            .backgroundColor('#fff').borderRadius(40)
            .textAlign(TextAlign.Center)
        }.margin({ top: 80 })
      }.width('100%').alignContent(Alignment.Bottom)

      Column() {
        Text('高端用户').fontSize(18).fontColor('#333')
        Text('ID: 88888888 · 黄金会员').fontSize(12).fontColor('#999').margin({ top: 4 })
      }.alignItems(HorizontalAlign.Center).padding(8)

      Row() {
        Column() {
          Text('128').fontSize(20).fontColor('#333')
          Text('文章').fontSize(11).fontColor('#999').margin({ top: 2 })
        }.layoutWeight(1).alignItems(HorizontalAlign.Center)
        Column() {
          Text('2.5万').fontSize(20).fontColor('#333')
          Text('粉丝').fontSize(11).fontColor('#999').margin({ top: 2 })
        }.layoutWeight(1).alignItems(HorizontalAlign.Center)
        Column() {
          Text('89').fontSize(20).fontColor('#333')
          Text('关注').fontSize(11).fontColor('#999').margin({ top: 2 })
        }.layoutWeight(1).alignItems(HorizontalAlign.Center)
      }.width('100%').padding(16).backgroundColor('#fff').margin({ top: 8 })

      Column() {
        Row() {
          Text('📝').fontSize(18).width(32)
          Text('我的发布').fontSize(14).layoutWeight(1)
          Text('128篇').fontSize(12).fontColor('#999')
          Text('>').fontColor('#ccc').margin({ left: 4 })
        }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        Row() {
          Text('❤️').fontSize(18).width(32)
          Text('我的收藏').fontSize(14).layoutWeight(1)
          Text('56个').fontSize(12).fontColor('#999')
          Text('>').fontColor('#ccc').margin({ left: 4 })
        }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        Row() {
          Text('💬').fontSize(18).width(32)
          Text('我的评论').fontSize(14).layoutWeight(1)
          Text('>').fontColor('#ccc')
        }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        Row() {
          Text('👁️').fontSize(18).width(32)
          Text('浏览历史').fontSize(14).layoutWeight(1)
          Text('>').fontColor('#ccc')
        }.width('100%').padding(12).alignItems(VerticalAlign.Center)
      }.backgroundColor('#fff').margin({ top: 8 })

      Column() {
        Row() {
          Text('⚙️').fontSize(18).width(32)
          Text('设置').fontSize(14).layoutWeight(1)
          Text('>').fontColor('#ccc')
        }.width('100%').padding(12).alignItems(VerticalAlign.Center)
        Row() {
          Text('🌙').fontSize(18).width(32)
          Text('深色模式').fontSize(14).layoutWeight(1)
          Toggle({ type: ToggleType.Switch, isOn: false })
        }.width('100%').padding(12).alignItems(VerticalAlign.Center)
      }.backgroundColor('#fff').margin({ top: 8 }).layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
      {
        name: '设置页',
        icon: '⚙️',
        description: '分组设置列表 + 开关',
        code: `@Entry
@Component
struct SettingsPage {
  build() {
    Column() {
      Row() {
        Text('设置').fontSize(20).fontColor('#fff')
          .layoutWeight(1).textAlign(TextAlign.Center)
      }.width('100%').height(56).backgroundColor('#07c160')

      Scroll() {
        Column() {
          Column() {
            Row() {
              Text('🔔').fontSize(20).width(28)
              Text('消息通知').fontSize(14).layoutWeight(1)
              Toggle({ type: ToggleType.Switch, isOn: true })
            }.padding(12).alignItems(VerticalAlign.Center)
            Row() {
              Text('🔇').fontSize(20).width(28)
              Text('勿扰模式').fontSize(14).layoutWeight(1)
              Toggle({ type: ToggleType.Switch, isOn: false })
            }.padding(12).alignItems(VerticalAlign.Center)
          }.backgroundColor('#fff').borderRadius(8).margin({ bottom: 12 })

          Column() {
            Text('通用').fontSize(12).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
            Row() {
              Text('🌐').fontSize(20).width(28)
              Text('语言').fontSize(14).layoutWeight(1)
              Text('简体中文').fontSize(12).fontColor('#999')
              Text('>').fontSize(14).fontColor('#ccc').margin({ left: 4 })
            }.padding(12).alignItems(VerticalAlign.Center)
            Row() {
              Text('🌙').fontSize(20).width(28)
              Text('深色模式').fontSize(14).layoutWeight(1)
              Text('跟随系统').fontSize(12).fontColor('#999')
              Text('>').fontSize(14).fontColor('#ccc').margin({ left: 4 })
            }.padding(12).alignItems(VerticalAlign.Center)
            Row() {
              Text('📱').fontSize(20).width(28)
              Text('字体大小').fontSize(14).layoutWeight(1)
              Text('标准').fontSize(12).fontColor('#999')
              Text('>').fontSize(14).fontColor('#ccc').margin({ left: 4 })
            }.padding(12).alignItems(VerticalAlign.Center)
          }.backgroundColor('#fff').borderRadius(8).margin({ bottom: 12 })

          Column() {
            Text('隐私与安全').fontSize(12).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
            Row() {
              Text('🔒').fontSize(20).width(28)
              Text('账号安全').fontSize(14).layoutWeight(1)
              Text('>').fontSize(14).fontColor('#ccc')
            }.padding(12).alignItems(VerticalAlign.Center)
            Row() {
              Text('🛡️').fontSize(20).width(28)
              Text('隐私设置').fontSize(14).layoutWeight(1)
              Text('>').fontSize(14).fontColor('#ccc')
            }.padding(12).alignItems(VerticalAlign.Center)
          }.backgroundColor('#fff').borderRadius(8).margin({ bottom: 12 })

          Column() {
            Text('关于').fontSize(12).fontColor('#999').margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
            Row() {
              Text('ℹ️').fontSize(20).width(28)
              Text('关于应用').fontSize(14).layoutWeight(1)
              Text('v1.2.0').fontSize(12).fontColor('#999')
              Text('>').fontSize(14).fontColor('#ccc').margin({ left: 4 })
            }.padding(12).alignItems(VerticalAlign.Center)
            Row() {
              Text('⭐').fontSize(20).width(28)
              Text('给我们评分').fontSize(14).layoutWeight(1)
              Text('>').fontSize(14).fontColor('#ccc')
            }.padding(12).alignItems(VerticalAlign.Center)
          }.backgroundColor('#fff').borderRadius(8)

          Row() {
            Text('退出登录').fontSize(14).fontColor('#f44336').layoutWeight(1).textAlign(TextAlign.Center)
          }.width('100%').padding(14).backgroundColor('#fff')
          .borderRadius(8).margin({ top: 12, bottom: 20 })
        }.padding(12)
      }.layoutWeight(1)
    }.width('100%').height('100%').backgroundColor('#f5f5f5')
  }
}`
      },
    ]
  },
  {
    label: '卡片',
    icon: '🗃️',
    templates: [
      {
        name: '商品卡片',
        icon: '🛍️',
        description: '图片 + 标题 + 价格 + 标签',
        code: `@Entry
@Component
struct ProductCard {
  build() {
    Column() {
      Column() {
        Text('📦').fontSize(48)
          .width('100%').height(140)
          .backgroundColor('#f5f5f5').textAlign(TextAlign.Center)
        Column() {
          Row() {
            Text('精选').fontSize(10).fontColor('#fff')
              .padding({ left: 6, right: 6, top: 2, bottom: 2 })
              .backgroundColor('#f44336').borderRadius(4)
            Text('新品').fontSize(10).fontColor('#fff')
              .padding({ left: 6, right: 6, top: 2, bottom: 2 })
              .backgroundColor('#ff9800').borderRadius(4).margin({ left: 4 })
          }.margin({ top: 8, bottom: 6 })
          Text('高品质无线蓝牙耳机 Pro Max').fontSize(15).fontColor('#333').width('100%')
          Row() {
            Text('¥199').fontSize(18).fontColor('#f44336')
            Text('¥299').fontSize(12).fontColor('#999').margin({ left: 6 })
              .decoration({ type: TextDecorationType.LineThrough })
            Text('已售128').fontSize(11).fontColor('#999').margin({ left: 8 })
          }.margin({ top: 6 }).alignItems(VerticalAlign.Center)
        }.padding(12).alignItems(HorizontalAlign.Start)
      }.backgroundColor('#fff').borderRadius(12).padding({ bottom: 12 })
    }.width('100%').height('100%').backgroundColor('#f5f5f5').padding(16)
  }
}`
      },
      {
        name: '文章卡片',
        icon: '📰',
        description: '封面 + 标题 + 摘要 + 作者',
        code: `@Entry
@Component
struct ArticleCard {
  build() {
    Column() {
      Column() {
        Text('📄').fontSize(48)
          .width('100%').height(160)
          .backgroundColor('#e8eaf6').textAlign(TextAlign.Center)
        Column() {
          Text('深入理解 ArkUI 声明式 UI 框架设计').fontSize(16).fontColor('#1a1a1a').width('100%')
          Text('本文从架构层面分析 HarmonyOS ArkUI 的声明式 UI 范式，探讨其组件模型、状态管理和渲染机制...').fontSize(12).fontColor('#666').margin({ top: 6 }).width('100%')
          Row() {
            Text('👨').fontSize(20)
            Text('技术专家').fontSize(12).fontColor('#666').margin({ left: 4 })
            Text('·').fontSize(12).fontColor('#ccc').margin({ left: 6 })
            Text('3天前').fontSize(12).fontColor('#999').margin({ left: 6 })
            Text('👁 2.3k').fontSize(12).fontColor('#999').margin({ left: 8 })
          }.margin({ top: 10 }).alignItems(VerticalAlign.Center)
        }.padding(12)
      }.backgroundColor('#fff').borderRadius(12)
    }.width('100%').height('100%').backgroundColor('#f5f5f5').padding(16)
  }
}`
      },
      {
        name: '用户卡片',
        icon: '🧑',
        description: '头像 + 信息 + 关注按钮',
        code: `@Entry
@Component
struct UserCard {
  build() {
    Column() {
      Column() {
        Row() {
          Text('🧑').fontSize(40)
            .width(64).height(64)
            .backgroundColor('#f0f0f0').borderRadius(32).textAlign(TextAlign.Center)
          Column() {
            Text('张小明').fontSize(16).fontColor('#333')
            Text('前端工程师 · 鸿蒙开发者').fontSize(12).fontColor('#999').margin({ top: 4 })
            Row() {
              Text('关注 128').fontSize(11).fontColor('#999')
              Text('粉丝 2.5万').fontSize(11).fontColor('#999').margin({ left: 8 })
            }.margin({ top: 4 })
          }.layoutWeight(1).margin({ left: 12 }).alignItems(HorizontalAlign.Start)
          Button('关注')
            .height(32).fontSize(13)
            .backgroundColor('#07c160').fontColor('#fff')
            .type(ButtonType.Capsule)
        }.width('100%').padding(16).alignItems(VerticalAlign.Center)
      }.backgroundColor('#fff').borderRadius(12)
    }.width('100%').height('100%').backgroundColor('#f5f5f5').padding(16).justifyContent(FlexAlign.Center)
  }
}`
      },
      {
        name: '数据卡片',
        icon: '📈',
        description: '大数字 + 趋势 + 子指标',
        code: `@Entry
@Component
struct StatCard {
  build() {
    Column() {
      Column() {
        Text('今日营收').fontSize(13).fontColor('#999')
        Row() {
          Text('¥').fontSize(16).fontColor('#333')
          Text('18,456').fontSize(32).fontColor('#333').margin({ left: 2 })
          Text('↑ 12.5%').fontSize(13).fontColor('#07c160').margin({ left: 8 })
        }.margin({ top: 4 }).alignItems(VerticalAlign.Bottom)

        Row() {
          Column() {
            Text('订单数').fontSize(11).fontColor('#999')
            Text('234').fontSize(16).fontColor('#333').margin({ top: 2 })
          }.layoutWeight(1)
          Column() {
            Text('客单价').fontSize(11).fontColor('#999')
            Text('¥78.9').fontSize(16).fontColor('#333').margin({ top: 2 })
          }.layoutWeight(1)
          Column() {
            Text('退款率').fontSize(11).fontColor('#999')
            Text('2.1%').fontSize(16).fontColor('#333').margin({ top: 2 })
          }.layoutWeight(1)
        }.width('100%').margin({ top: 16 })
      }.backgroundColor('#fff').borderRadius(12).padding(16)
    }.width('100%').height('100%').backgroundColor('#f5f5f5').padding(16).justifyContent(FlexAlign.Center)
  }
}`
      },
    ]
  },
]

// 保持向下兼容
export const TEMPLATES = TEMPLATE_CATEGORIES.flatMap(c => c.templates)
