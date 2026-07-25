import { describe, it, expect } from 'vitest'
import { validateIr } from './validate'
import { createNode } from './defaults'
import { acceptsChild, canAcceptMore } from '../editor/dnd'
import { IRNode } from './types'

const n = (type: string, children: IRNode[] = []): IRNode =>
  ({ type, ctorArgs: [], children, modifiers: [] })

describe('validateIr 结构约束校验', () => {
  it('Scroll 多个子组件 → 报错（对应 hvigor 编译错误）', () => {
    const p = validateIr(n('Column', [n('Scroll', [n('Column'), n('Text')])]))
    expect(p.length).toBe(1)
    expect(p[0]).toContain('Scroll')
  })
  it('TabContent 多个子组件 → 报错', () => {
    const p = validateIr(n('Tabs', [n('TabContent', [n('Text'), n('Button')])]))
    expect(p.some(x => x.includes('TabContent') && x.includes('只能有一个子组件'))).toBe(true)
  })
  it('List/Tabs/Grid 子类型约束', () => {
    expect(validateIr(n('List', [n('Text')])).some(x => x.includes('ListItem'))).toBe(true)
    expect(validateIr(n('Grid', [n('Text')])).some(x => x.includes('GridItem'))).toBe(true)
    expect(validateIr(n('Tabs', [n('Column')])).some(x => x.includes('TabContent'))).toBe(true)
  })
  it('ListItem/GridItem/TabContent 离开父容器 → 报错', () => {
    expect(validateIr(n('Column', [n('ListItem')])).some(x => x.includes('ListItem'))).toBe(true)
    expect(validateIr(n('Column', [n('GridItem')])).some(x => x.includes('GridItem'))).toBe(true)
    expect(validateIr(n('Column', [n('TabContent')])).some(x => x.includes('TabContent'))).toBe(true)
  })
  it('合法结构 → 无问题', () => {
    const root = n('Column', [
      n('Scroll', [n('Column', [n('Text')])]),
      n('List', [n('ListItem', [n('Text')])]),
      n('Tabs', [n('TabContent', [n('Column')])]),
      n('Grid', [n('GridItem')]),
    ])
    expect(validateIr(root)).toEqual([])
  })
})

describe('独子容器与默认值', () => {
  it('Scroll 默认值：恰好一个 Column 子节点（编译安全）', () => {
    const s = createNode('Scroll')
    expect(s.children.length).toBe(1)
    expect(s.children[0].type).toBe('Column')
    expect(validateIr(s)).toEqual([])
  })
  it('TabContent 默认值：恰好一个子节点', () => {
    const t = createNode('TabContent')
    expect(t.children.length).toBe(1)
    expect(validateIr(t)).toEqual([])
  })
  it('canAcceptMore：Scroll/TabContent 有子即拒，其它容器不限', () => {
    expect(canAcceptMore(n('Scroll', [n('Column')]))).toBe(false)
    expect(canAcceptMore(n('Scroll'))).toBe(true)
    expect(canAcceptMore(n('TabContent', [n('Column')]))).toBe(false)
    expect(canAcceptMore(n('Column', [n('Text'), n('Text')]))).toBe(true)
  })
  it('acceptsChild 保持既有约束', () => {
    expect(acceptsChild('List', 'ListItem')).toBe(true)
    expect(acceptsChild('List', 'Text')).toBe(false)
    expect(acceptsChild('Column', 'Text')).toBe(true)
  })
})
