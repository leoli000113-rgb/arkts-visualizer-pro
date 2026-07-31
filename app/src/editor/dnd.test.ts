import { describe, it, expect, afterEach } from 'vitest'
import { computeDrop, startNewDrag, startMoveDrag, endDrag } from './dnd'
import { IRNode } from '../ir/types'

const str = (v: string) => ({ t: 'str' as const, v })
const text = (v: string): IRNode => ({ type: 'Text', ctorArgs: [str(v)], children: [], modifiers: [] })
const column = (children: IRNode[]): IRNode => ({ type: 'Column', ctorArgs: [], children, modifiers: [] })

const fakeBox = { top: 0, left: 0, width: 100, height: 40 } as DOMRect

/** Column( Scroll( Column( Text('a') ) ) )：Scroll 独子已满的典型结构 */
function scrollTree(inner: IRNode[] = [text('a')]): IRNode {
  return column([
    { type: 'Scroll', ctorArgs: [], children: [column(inner)], modifiers: [] },
  ])
}

describe('computeDrop 独子容器重定向', () => {
  afterEach(() => endDrag())

  it('拖 Text 到 Scroll 行中部 → 重定向进内层 Column 末尾，高亮跟随内层行', () => {
    startNewDrag('Text')
    const d = computeDrop(scrollTree(), [0], 0.5, fakeBox, 50, 20, false)
    expect(d).not.toBeNull()
    expect(d!.pos).toBe('inside')
    expect(d!.parent).toEqual([0, 0])
    expect(d!.path).toEqual([0, 0])
    expect(d!.index).toBe(1)
  })

  it('拖到 Scroll 行上/下沿 → 仍是 before/after 兄弟插入，不重定向', () => {
    startNewDrag('Text')
    const before = computeDrop(scrollTree(), [0], 0.1, fakeBox, 50, 2, false)
    expect(before).toMatchObject({ pos: 'before', parent: [], index: 0 })
    const after = computeDrop(scrollTree(), [0], 0.95, fakeBox, 50, 38, false)
    expect(after).toMatchObject({ pos: 'after', parent: [], index: 1 })
  })

  it('独子是叶子（非容器）→ 不重定向，独子已满 inside 拒绝', () => {
    const root = column([{ type: 'Scroll', ctorArgs: [], children: [text('x')], modifiers: [] }])
    startNewDrag('Text')
    expect(computeDrop(root, [0], 0.5, fakeBox, 50, 20, false)).toBeNull()
  })

  it('Scroll 为空 → 直接落入 Scroll 自身（不重定向）', () => {
    const root = column([{ type: 'Scroll', ctorArgs: [], children: [], modifiers: [] }])
    startNewDrag('Text')
    const d = computeDrop(root, [0], 0.5, fakeBox, 50, 20, false)
    expect(d).toMatchObject({ pos: 'inside', parent: [0], index: 0 })
  })

  it('约束仍生效：List 只收 ListItem，拖 Text 到 List 中部 → null', () => {
    const root = column([{ type: 'List', ctorArgs: [], children: [], modifiers: [] }])
    startNewDrag('Text')
    expect(computeDrop(root, [0], 0.5, fakeBox, 50, 20, false)).toBeNull()
  })

  it('拖 ListItem 到 List 中部 → 允许', () => {
    const root = column([{ type: 'List', ctorArgs: [], children: [], modifiers: [] }])
    startNewDrag('ListItem')
    expect(computeDrop(root, [0], 0.5, fakeBox, 50, 20, false)).toMatchObject({ pos: 'inside', parent: [0] })
  })

  it('搬运自家孩子进 Scroll（move）→ 同样重定向进内层 Column', () => {
    const root = column([text('move me'), column([text('x')])])
    // 把根下第 0 个 Text 搬到 Scroll…构造 Scroll 场景：
    const withScroll = column([scrollTree().children[0], text('move me')])
    startMoveDrag([1])
    const d = computeDrop(withScroll, [0], 0.5, fakeBox, 50, 20, false)
    expect(d).toMatchObject({ pos: 'inside', parent: [0, 0] })
    expect(root).toBeDefined()
  })
})
