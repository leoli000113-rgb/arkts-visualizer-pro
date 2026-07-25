import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { color, styleOf } from './shared'
import { renderNode } from './Renderer'
import { serializeArg } from '../ir/serialize'
import { parse } from '../parser/parser'
import { serialize } from '../ir/serialize'
import { ArgVal, IRNode } from '../ir/types'
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
