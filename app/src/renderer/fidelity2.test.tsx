import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parse } from '../parser/parser'
import { renderNode } from './Renderer'
import { evalExpr, resolveNum, resolveStr, resolveBool, styleOf, parseArrayLiteral } from './shared'
import { extractStyles } from './styleTable'
import { extractComponents, buildersOf } from './components'
import { IRState, IRFile } from '../ir/types'

const states: IRState[] = [
  { name: 'count', type: 'number', init: { t: 'num', v: 0 }, decorator: '@State' },
  { name: 'title', type: 'string', init: { t: 'str', v: 'Hello' }, decorator: '@State' },
  { name: 'flag', type: 'boolean', init: { t: 'bool', v: false }, decorator: '@State' },
]

describe('evalExpr 表达式小求值', () => {
  const ev = (raw: string) => evalExpr(raw, states)
  it('字面量与加法', () => {
    expect(ev(`'a' + 'b'`)).toEqual({ t: 'str', v: 'ab' })
    expect(ev(`1 + 2`)).toEqual({ t: 'num', v: 3 })
    expect(ev(`'第' + 1 + '名'`)).toEqual({ t: 'str', v: '第1名' })
  })
  it('this.x 状态引用', () => {
    expect(ev('this.count')).toEqual({ t: 'num', v: 0 })
    expect(ev(`'Hello ' + this.title`)).toEqual({ t: 'str', v: 'Hello Hello' })
  })
  it('三元', () => {
    expect(ev(`this.count > 0 ? '有' : '无'`)).toEqual({ t: 'str', v: '无' })
    expect(ev(`(this.count === 0 ? 'zero' : 'other')`)).toEqual({ t: 'str', v: 'zero' })
    expect(ev(`this.flag ? 1 : 2`)).toEqual({ t: 'num', v: 2 })
  })
  it('比较与逻辑', () => {
    expect(ev('this.count === 0')).toEqual({ t: 'bool', v: true })
    expect(ev('this.count >= 1 || this.flag')).toEqual({ t: 'bool', v: false })
    expect(ev('!this.flag')).toEqual({ t: 'bool', v: true })
    expect(ev('this.count === 0 && !this.flag')).toEqual({ t: 'bool', v: true })
  })
  it('求不出回退 undefined（不猜）', () => {
    expect(ev('this.unknown + 1')).toBeUndefined()
    expect(ev(`$r('app.media.x')`)).toBeUndefined()
    expect(ev('this.list?.length')).toBeUndefined()
  })
  it('resolve* 接入', () => {
    expect(resolveNum({ t: 'raw', v: 'this.count + 40' }, states)).toBe(40)
    expect(resolveStr({ t: 'raw', v: `'标题: ' + this.title` }, states)).toBe('标题: Hello')
    expect(resolveBool({ t: 'raw', v: 'this.count > 0' }, states)).toBe(false)
  })
})

describe('ForEach 对象数组', () => {
  it('parseArrayLiteral 解析对象项', () => {
    const items = parseArrayLiteral(`[{ name: '甲', n: 1 }, { name: '乙', n: 2 }]`)
    expect(items).toHaveLength(2)
    expect((items![0] as Record<string, unknown>).name).toEqual({ t: 'str', v: '甲' })
  })
  it('item.member 替换渲染', () => {
    const src = `@Entry
@Component
struct T {
  @State list: object[] = [{ name: '甲' }, { name: '乙' }]
  build() {
    Column() {
      ForEach(this.list, (item) => {
        Text(item.name)
      })
    }
  }
}
`
    const ir = parse(src)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids: false })}</>,
    )
    expect(html).toContain('甲')
    expect(html).toContain('乙')
  })
  it('拼接：序号 + item.member', () => {
    const src = `@Entry
@Component
struct T {
  build() {
    Column() {
      ForEach([{ n: '功能' }, { n: '设置' }], (item) => {
        Text('菜单: ' + item.n)
      })
    }
  }
}
`
    const ir = parse(src)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids: false })}</>,
    )
    expect(html).toContain('菜单: 功能')
    expect(html).toContain('菜单: 设置')
  })
})

describe('@Styles 展开', () => {
  it('struct 成员与全局 @Styles 均生效，本机修饰符可覆盖', () => {
    const src = `@Styles function globalStyle() {
  .width(100)
  .backgroundColor(0xFF0000)
}
@Entry
@Component
struct T {
  @Styles cardStyle() {
    .height(50)
  }
  build() {
    Column() {
      Text('x')
        .globalStyle()
        .cardStyle()
        .width(200)
    }
  }
}
`
    const ir = parse(src)
    const table = extractStyles(ir)
    expect(Object.keys(table.styles)).toContain('globalStyle')
    expect(Object.keys(table.styles)).toContain('cardStyle')
    const text = ir.root.children[0]
    const s = styleOf(text, false, [], table.styles)
    expect(s.width).toBe(120) // .width(200) 覆盖样式的 100 → 200vp×0.6
    expect(s.height).toBe(30) // cardStyle 50vp
    expect(s.backgroundColor).toBe('#FF0000')
  })
})

describe('同文件自定义组件渲染', () => {
  const src = `@Entry
@Component
struct Index {
  build() {
    Column() {
      MyCard({ title: '你好', count: 3 })
      MyCard()
    }
  }
}
@Component
struct MyCard {
  private title: string = '默认标题'
  count: number = 0
  build() {
    Column() {
      Text(this.title)
      Text('数量: ' + this.count)
    }
  }
}
`
  it('提取并渲染，参数按名覆盖', () => {
    const ir = parse(src)
    const comps = extractComponents(ir)
    expect(Object.keys(comps)).toContain('MyCard')
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, {
        states: ir.states, aids: false, components: comps,
      })}</>,
    )
    expect(html).toContain('你好')        // 参数覆盖
    expect(html).toContain('数量: 3')
    expect(html).toContain('默认标题')    // 无参调用用组件内初值
    expect(html).toContain('数量: 0')
    expect(html).not.toContain('ir-custom-name') // 不再是占位卡
  })
  it('未定义的组件仍是中性占位卡', () => {
    const ir = parse(`@Entry
@Component
struct T {
  build() {
    Column() {
      UnknownCard()
    }
  }
}
`)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, {
        states: ir.states, aids: false, components: {},
      })}</>,
    )
    expect(html).toContain('ir-custom')
    expect(html).toContain('UnknownCard')
  })
})

describe('修饰符覆盖包', () => {
  it('shadow / border(obj) / rotate / textOverflow / clip', () => {
    const s = styleOf({
      type: 'Column', ctorArgs: [], children: [],
      modifiers: [
        { name: 'shadow', args: [{ t: 'obj', v: { radius: { t: 'num', v: 20 }, color: { t: 'hex', v: 0x33000000 }, offsetX: { t: 'num', v: 2 }, offsetY: { t: 'num', v: 4 } } }] },
        { name: 'border', args: [{ t: 'obj', v: { width: { t: 'num', v: 1 }, color: { t: 'hex', v: 0xFF0000 }, radius: { t: 'num', v: 8 } } }] },
        { name: 'rotate', args: [{ t: 'obj', v: { angle: { t: 'num', v: 45 } } }] },
        { name: 'textOverflow', args: [{ t: 'enum', v: 'TextOverflow.Ellipsis' }] },
        { name: 'clip', args: [{ t: 'bool', v: true }] },
      ],
    })
    expect(s.boxShadow).toContain('12px')       // radius 20vp×0.6
    expect(s.borderWidth).toBe(0.6)
    expect(s.borderColor).toBe('#FF0000')
    expect(s.borderRadius).toBe(4.8)
    expect(s.transform).toBe('rotate(45deg)')
    expect(s.textOverflow).toBe('ellipsis')
    expect(s.whiteSpace).toBe('nowrap')
  })
  it('linearGradient', () => {
    const s = styleOf({
      type: 'Column', ctorArgs: [], children: [],
      modifiers: [{
        name: 'linearGradient',
        args: [{ t: 'obj', v: { angle: { t: 'num', v: 90 }, colors: { t: 'raw', v: `[[0xFF0000, 0.0], [0x0000FF, 1.0]]` } } }],
      }],
    })
    expect(s.backgroundImage).toBe('linear-gradient(90deg, #FF0000 0%, #0000FF 100%)')
  })
})

describe('evalExpr 增强（?. / ?? / .length / 成员访问 / 乘除）', () => {
  const st: IRState[] = [
    { name: 'user', type: 'object', init: { t: 'raw', v: `{ name: '小李', age: 18 }` }, decorator: '@State' },
    { name: 'list', type: 'object[]', init: { t: 'raw', v: `['a', 'b', 'c']` }, decorator: '@State' },
    { name: 'title', type: 'string', init: { t: 'str', v: '' }, decorator: '@State' },
    { name: 'w', type: 'number', init: { t: 'num', v: 100 }, decorator: '@State' },
  ]
  const ev = (raw: string) => evalExpr(raw, st)
  it('成员访问与 .length', () => {
    expect(ev('this.user.name')).toEqual({ t: 'str', v: '小李' })
    expect(ev('this.list.length')).toEqual({ t: 'num', v: 3 })
    expect(ev('this.list.length > 2')).toEqual({ t: 'bool', v: true })
    expect(ev('this.list[1]')).toEqual({ t: 'str', v: 'b' })
  })
  it('?? 与 ?.', () => {
    expect(ev(`this.title || '默认'`)).toEqual({ t: 'str', v: '默认' })
    expect(ev(`this.nothing ?? '回退'`)).toEqual({ t: 'str', v: '回退' })
    expect(ev(`this.user?.name`)).toEqual({ t: 'str', v: '小李' })
  })
  it('乘除与加减', () => {
    expect(ev('this.w / 2')).toEqual({ t: 'num', v: 50 })
    expect(ev('this.w - 30')).toEqual({ t: 'num', v: 70 })
    expect(ev('(this.w - 10) / 3')).toEqual({ t: 'num', v: 30 })
  })
})

describe('@Extend 组件专属样式', () => {
  it('只对声明的组件类型展开', () => {
    const src = `@Extend(Text) fancy() {
  .fontSize(22)
  .fontColor(0xFF0000)
}
@Entry
@Component
struct T {
  build() {
    Column() {
      Text('a')
        .fancy()
      Button('b')
        .fancy()
    }
  }
}
`
    const ir = parse(src)
    const table = extractStyles(ir)
    expect(table.extends.Text?.fancy).toBeDefined()
    const textS = styleOf(ir.root.children[0], false, [], table.styles, table.extends)
    expect(textS.fontSize).toBeCloseTo(13.2) // 22vp×0.6
    expect(textS.color).toBe('#FF0000')
    // Button 上同名调用不展开（@Extend 限定 Text）
    const btnS = styleOf(ir.root.children[1], false, [], table.styles, table.extends)
    expect(btnS.fontSize).toBeUndefined()
  })
})

describe('@Builder 带参调用渲染', () => {
  it('调用点参数按名替换，只读渲染', () => {
    const src = `@Entry
@Component
struct T {
  @State meals: object[] = [{ n: '早餐' }, { n: '午餐' }]
  @Builder
  mealRow(name: string) {
    Text(name)
      .fontSize(14)
  }
  build() {
    Column() {
      this.mealRow('定制')
      ForEach(this.meals, (item) => {
        this.mealRow(item.n)
      })
    }
  }
}
`
    const ir = parse(src)
    const comps = extractComponents(ir)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, {
        states: ir.states, aids: false, components: comps,
        builders: buildersOf(ir),
      })}</>,
    )
    expect(html).toContain('定制')
    expect(html).toContain('早餐')
    expect(html).toContain('午餐')
  })
})

describe('ForEach index 变量', () => {
  it('(item, index) 双参数替换', () => {
    const src = `@Entry
@Component
struct T {
  build() {
    Column() {
      ForEach(['甲', '乙'], (item, i) => {
        Text('第' + i + '名: ' + item)
      })
    }
  }
}
`
    const ir = parse(src)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids: false })}</>,
    )
    expect(html).toContain('第0名: 甲')
    expect(html).toContain('第1名: 乙')
  })
})

describe('新组件 Divider/Blank/Badge/Rating', () => {
  it('注册表覆盖且默认节点往返幂等（registry 测试已含），渲染冒烟', () => {
    const src = `@Entry
@Component
struct T {
  build() {
    Column() {
      Text('标题')
      Divider()
      Blank()
      Badge({ count: 5 }) {
        Text('消息')
      }
      Rating({ rating: 4 })
    }
  }
}
`
    const ir = parse(src)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids: false })}</>,
    )
    expect(html).toContain('消息')
    expect(html).toContain('>5<') // Badge 角标
    expect(html).toContain('★')   // Rating
    expect(html).not.toContain('ir-custom')
  })
})

describe('MovieGenerate_2 保真：$r 资源色 / Select / LoadingProgress / .font / 渐变方向', () => {
  function envOf(ir: IRFile) {
    const table = extractStyles(ir)
    return {
      states: ir.states, aids: false,
      styles: table.styles, extends: table.extends,
      components: extractComponents(ir), builders: buildersOf(ir),
    }
  }
  const render = (ir: IRFile) =>
    renderToStaticMarkup(<>{renderNode(ir.root, [], null, () => {}, null, false, envOf(ir))}</>)

  it("$r('app.color.*') 解析为内置语义色", () => {
    const src = `@Entry
@Component
struct T {
  build() {
    Column() {
      Text('hi').fontColor($r('app.color.primary'))
    }
    .backgroundColor($r('app.color.surface'))
  }
}
`
    const ir = parse(src)
    const html = render(ir)
    expect(html).toContain('#667eea') // primary
    expect(html).toContain('#ffffff') // surface
  })

  it('Select 渲染当前值 + 下拉箭头', () => {
    const src = `@Entry
@Component
struct T {
  build() {
    Column() {
      Select([{ value: 'groq' }, { value: 'qwen' }]).selected(0).value('groq')
    }
  }
}
`
    const ir = parse(src)
    const html = render(ir)
    expect(html).toContain('groq')
    expect(html).toContain('▾')
    expect(html).not.toContain('ir-custom')
  })

  it('LoadingProgress 渲染旋转菊花', () => {
    const src = `@Entry
@Component
struct T {
  build() {
    Column() {
      LoadingProgress().color($r('app.color.primary'))
    }
  }
}
`
    const ir = parse(src)
    const html = render(ir)
    expect(html).toContain('ir-loading')
    expect(html).not.toContain('ir-custom')
  })

  it('.font({ size }) → fontSize', () => {
    const s = styleOf({
      type: 'Text', ctorArgs: [], children: [],
      modifiers: [{ name: 'font', args: [{ t: 'obj', v: { size: { t: 'num', v: 22 } } }] }],
    })
    expect(s.fontSize).toBeCloseTo(13.2) // 22vp×0.6
  })

  it('渐变头：direction + 字符串色（贴近 Index 头部）', () => {
    const src = `@Entry
@Component
struct T {
  build() {
    Column() {
      Text('🎬 视频智能解析')
        .fontSize(22)
        .fontColor(Color.White)
        .fontWeight(FontWeight.Bold)
    }
    .width('100%')
    .linearGradient({ direction: GradientDirection.Right, colors: [['#667eea', 0], ['#764ba2', 1]] })
    .borderRadius({ bottomLeft: 16, bottomRight: 16 })
  }
}
`
    const ir = parse(src)
    const html = render(ir)
    expect(html).toContain('视频智能解析')
    expect(html).toContain('linear-gradient(90deg')
    expect(html).toContain('#667eea')
    expect(html).toContain('#764ba2')
  })
})
