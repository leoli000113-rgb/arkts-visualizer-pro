import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { color, styleOf, wouldCollapse } from './shared'
import { renderNode } from './Renderer'
import { serializeArg } from '../ir/serialize'
import { parse } from '../parser/parser'
import { serialize } from '../ir/serialize'
import { ArgVal, IRNode } from '../ir/types'
import { Path } from '../ir/mutate'
import { createElement } from 'react'

const node = (type: string, mods: IRNode['modifiers'] = [], children: IRNode[] = []): IRNode =>
  ({ type, ctorArgs: [], children, modifiers: mods })
const mod = (name: string, ...args: ArgVal[]) => ({ name, args })
const num = (v: number): ArgVal => ({ t: 'num', v })
const hex = (v: number): ArgVal => ({ t: 'hex', v })
const en = (v: string): ArgVal => ({ t: 'enum', v })

describe('颜色保真', () => {
  it('6 位 hex → 不透明 RGB', () => {
    expect(color(hex(0xFF5722))).toBe('#FF5722')
    expect(color(hex(0x000066))).toBe('#000066')
  })
  it('8 位 AARRGGBB → CSS #RRGGBBAA 通道重排', () => {
    expect(color(hex(0x66000000))).toBe('#00000066')
    expect(color(hex(0x80FF0000))).toBe('#FF000080')
  })
  it('Color 枚举', () => {
    expect(color(en('Color.Red'))).toBe('#FF0000')
    expect(color(en('Color.Transparent'))).toBe('#00000000')
  })
  it('序列化 hex 补齐：8 位 ARGB 高位 0 不丢、6 位 RGB 不变', () => {
    expect(serializeArg(hex(0x66000000))).toBe('0x66000000')
    expect(serializeArg(hex(0x0A0B0C))).toBe('0x0A0B0C')
    expect(serializeArg(hex(0xFF5722))).toBe('0xFF5722')
    // 高位为 0 的 8 位值（0x0AFFFFFF）：必须补到 8 位，否则被误读为 RGB
    expect(serializeArg(hex(0x0AFFFFFF))).toBe('0x0AFFFFFF')
  })
  it('颜色值 代码→渲染 端到端一致', () => {
    const src = `@Entry\n@Component\nstruct T {\n  build() {\n    Column() {\n      Text('a').fontColor(0x80FF0000)\n    }\n  }\n}\n`
    const ir = parse(src)
    expect(serialize(ir)).toContain('0x80FF0000')
    const html = renderToStaticMarkup(createElement(() => renderNode(ir.root, [], null, () => {}, null, false, { states: [] }) as any))
    expect(html).toContain('#FF000080')
  })
})

describe('通用属性 → CSS 映射', () => {
  it('position / offset / zIndex', () => {
    const s = styleOf(node('Text', [
      mod('position', { t: 'obj', v: { x: num(10), y: num(20) } }),
      mod('zIndex', num(5)),
    ]))
    expect(s.position).toBe('absolute')
    expect(s.left).toBe(6)   // 10vp × 0.6
    expect(s.top).toBe(12)   // 20vp × 0.6
    expect(s.zIndex).toBe(5)
    const s2 = styleOf(node('Text', [mod('offset', { t: 'obj', v: { x: num(4), y: num(8) } })]))
    expect(s2.transform).toBe('translate(2.4px, 4.8px)')
  })
  it('visibility / alignSelf / aspectRatio / constraintSize / enabled', () => {
    expect(styleOf(node('Text', [mod('visibility', en('Visibility.Hidden'))])).visibility).toBe('hidden')
    expect(styleOf(node('Text', [mod('visibility', en('Visibility.None'))])).display).toBe('none')
    expect(styleOf(node('Text', [mod('alignSelf', en('ItemAlign.End'))])).alignSelf).toBe('flex-end')
    expect(styleOf(node('Text', [mod('aspectRatio', num(1.5))])).aspectRatio).toBe('1.5')
    const cs = styleOf(node('Text', [mod('constraintSize', { t: 'obj', v: { minWidth: num(50), maxHeight: num(100) } })]))
    expect(cs.minWidth).toBe(30)
    expect(cs.maxHeight).toBe(60)
    expect(styleOf(node('Text', [mod('enabled', { t: 'bool', v: false })])).opacity).toBe(0.4)
  })
})

describe('默认对齐与默认外观（与 ArkUI 一致）', () => {
  const render = (n: IRNode) =>
    renderToStaticMarkup(createElement(() => renderNode(n, [], null, () => {}, null, false, { states: [] }) as any))
  it('Column 交叉轴默认居中', () => {
    expect(render(node('Column'))).toContain('align-items:center')
  })
  it('Row 交叉轴默认居中', () => {
    expect(render(node('Row'))).toContain('align-items:center')
  })
  it('Button 默认主题蓝底白字胶囊', () => {
    const html = render(node('Button'))
    expect(html).toContain('#0A59F7')
    expect(html).toContain('border-radius:999px')
  })
  it('Column 显式 alignItems 覆盖默认', () => {
    const html = render(node('Column', [mod('alignItems', en('HorizontalAlign.Start'))]))
    expect(html).toContain('align-items:flex-start')
  })
})

describe('定位包含块（与真机一致）', () => {
  const render2 = (n: IRNode, sel: Path | null = null) =>
    renderToStaticMarkup(createElement(() => renderNode(n, [], sel, () => {}, null, false, { states: [] }) as any))
  /** 取指定 data-path 元素的内联 style 字符串（SSR 属性顺序：data-path 先于 style） */
  const styleAt = (html: string, path: string): string =>
    html.match(new RegExp(`data-path="${path}"[^>]*?style="([^"]*)"`))?.[1] ?? ''

  it('普通节点基线 position:relative（包含块不随选中变化）', () => {
    const html = render2(node('Column', [mod('width', { t: 'str', v: '100%' })]))
    expect(styleAt(html, '')).toContain('position:relative')
  })
  it('.position 节点被选中后仍 absolute（修复：选中曾覆盖为 relative 导致回流乱跳）', () => {
    const t = node('Text', [mod('position', { t: 'obj', v: { x: num(10), y: num(20) } })])
    const html = render2(node('Column', [mod('width', { t: 'str', v: '100%' })], [t]), [0])
    expect(styleAt(html, '0')).toContain('position:absolute')
    expect(styleAt(html, '0')).toContain('left:6px')
  })
  it('塌缩容器不建立包含块：无显式尺寸且子节点全部 position 时保持 static', () => {
    const scroll = node('Scroll', [
      mod('width', { t: 'str', v: '220%' }),
      mod('position', { t: 'obj', v: { x: num(6), y: num(3) } }),
    ], [node('Column')])
    const row = node('Row', [], [scroll])
    expect(wouldCollapse(row)).toBe(true)
    const html = render2(row)
    expect(styleAt(html, '')).not.toContain('position:relative') // Row 保持 static，子上溯定位
    expect(styleAt(html, '0')).toContain('position:absolute')
    // 有显式尺寸或存在在流子节点时不塌缩
    expect(wouldCollapse(node('Row', [mod('width', { t: 'str', v: '100%' })], [scroll]))).toBe(false)
    expect(wouldCollapse(node('Row', [], [scroll, node('Text')]))).toBe(false)
  })
  it('position/offset 支持百分比字符串', () => {
    const s = styleOf(node('Text', [mod('position', { t: 'obj', v: { x: { t: 'str', v: '50%' }, y: num(20) } })]))
    expect(s.left).toBe('50%')
    expect(s.top).toBe(12)
    const s2 = styleOf(node('Text', [mod('offset', { t: 'obj', v: { x: { t: 'str', v: '-50%' }, y: num(8) } })]))
    expect(s2.transform).toBe('translate(-50%, 4.8px)')
  })
  it('负值参数（parser 产 raw 一元表达式）照常求值', () => {
    const s = styleOf(node('Text', [mod('offset', { t: 'obj', v: { x: { t: 'raw', v: '-10' }, y: num(0) } })]))
    expect(s.transform).toBe('translate(-6px, 0px)')
    const s2 = styleOf(node('Text', [mod('position', { t: 'obj', v: { x: { t: 'raw', v: '-10' }, y: num(20) } })]))
    expect(s2.left).toBe(-6)
    const s3 = styleOf(node('Text', [mod('margin', { t: 'obj', v: { left: { t: 'raw', v: '-10' } } })]))
    expect(s3.margin).toBe('0px 0px 0px -6px')
  })
})

describe('Stack 与滚动容器的真机尺寸行为', () => {
  const render3 = (n: IRNode) =>
    renderToStaticMarkup(createElement(() => renderNode(n, [], null, () => {}, null, false, { states: [] }) as any))
  it('Stack 用 CSS grid 同格层叠：尺寸 = 最大子节点（不再塌缩为 0）', () => {
    const stack = node('Stack', [], [node('Column', [mod('height', num(150))])])
    const html = render3(stack)
    expect(html).toContain('display:grid')
    expect(html).toContain('grid-area')
    // 子节点不再包 absolute inset:0 层
    expect(html).not.toContain('inset:0')
  })
  it('Scroll/List/Grid/Tabs 默认交叉轴占满，显式 alignSelf 可覆盖', () => {
    expect(render3(node('Scroll'))).toContain('align-self:stretch')
    expect(render3(node('List'))).toContain('align-self:stretch')
    expect(render3(node('Grid'))).toContain('align-self:stretch')
    expect(render3(node('Tabs'))).toContain('align-self:stretch')
    const s = render3(node('Scroll', [mod('alignSelf', en('ItemAlign.Start'))]))
    expect(s).toContain('align-self:flex-start')
  })
})

describe('Tabs/TabContent 的真机尺寸行为', () => {
  const render4 = (n: IRNode) =>
    renderToStaticMarkup(createElement(() => renderNode(n, [], null, () => {}, null, false, { states: [] }) as any))
  const tabContent = (children: IRNode[], mods: IRNode['modifiers'] = []): IRNode =>
    ({ type: 'TabContent', ctorArgs: [], children, modifiers: mods })

  it('TabContent 用 grid 满格：子组件未显式设尺寸时占满整个内容区（真机占满约束）', () => {
    const tabs = node('Tabs', [], [tabContent([node('Column')])])
    const html = render4(tabs)
    // TabContent 帧：grid + 满格行列；grid stretch 让 auto 尺寸子组件撑满（显式宽高不受影响）
    expect(html).toContain('display:grid')
    expect(html).toContain('grid-template-rows:minmax(0, 1fr)')
    expect(html).toContain('grid-template-columns:minmax(0, 1fr)')
  })
  it('barPosition.End 页签栏渲染在内容之后（真机底部 tab）', () => {
    const tabs: IRNode = {
      type: 'Tabs',
      ctorArgs: [{ t: 'obj', v: { barPosition: en('BarPosition.End') } }],
      children: [tabContent([node('Text', [], [])], [mod('tabBar', { t: 'str', v: '首页' })])],
      modifiers: [],
    }
    const html = render4(tabs)
    const barIdx = html.indexOf('ir-tabs-bar')
    expect(barIdx).toBeGreaterThan(-1)
    expect(html).toContain('ir-tabs-bar end')
    // 内容（TabContent 帧）在页签栏之前
    expect(html.indexOf('display:grid')).toBeLessThan(barIdx)
  })
  it('落点指示显示时塌缩容器也建立包含块（防指示层逃逸成「蓝屏」）', () => {
    // wouldCollapse 容器：无显式尺寸且子节点全部 position → 平时保持 static
    const collapsed = node('Row', [], [
      node('Scroll', [
        mod('width', { t: 'str', v: '220%' }),
        mod('position', { t: 'obj', v: { x: num(6), y: num(3) } }),
      ], [node('Column')]),
    ])
    const html = renderToStaticMarkup(createElement(() =>
      renderNode(collapsed, [], null, () => {},
        { path: [], pos: 'inside', parent: [], index: 0 }, false, { states: [] }) as any))
    const rootStyle = html.match(/data-path="" style="([^"]*)"/)?.[1] ?? ''
    expect(rootStyle).toContain('position:relative')
    expect(html).toContain('drop-inside')
  })
})
