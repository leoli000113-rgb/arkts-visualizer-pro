import { describe, it, expect, afterEach } from 'vitest'
import { computeDrop, startNewDrag, startMoveDrag, endDrag, resolveDragStart } from './dnd'
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

describe('computeDrop 画布模式（窄边带 + 最近子位置 + 约束回退）', () => {
  afterEach(() => endDrag())

  // fakeBox 高 40，axisSize 传 40：边带 = clamp(40*0.1, 6, 12) = 6px（ratio 0.15）

  it('回归：拖到 Scroll 盒下部留白（命中 Scroll 本体）→ 进内层 Column，不再落到 Scroll 外', () => {
    startNewDrag('Text')
    const d = computeDrop(scrollTree(), [0], 0.8, fakeBox, 50, 32, true, 40)
    expect(d).not.toBeNull()
    expect(d!.pos).toBe('inside')
    expect(d!.parent).toEqual([0, 0]) // Scroll 的内层 Column
    expect(d!.index).toBe(1) // 无 DOM 环境 → 追加末尾
  })

  it('画布拖到 Scroll 顶沿窄带内 → before 兄弟插入（故意的边缘操作仍可用）', () => {
    startNewDrag('Text')
    const d = computeDrop(scrollTree(), [0], 0.05, fakeBox, 50, 2, true, 40)
    expect(d).toMatchObject({ pos: 'before', parent: [], index: 0 })
    const after = computeDrop(scrollTree(), [0], 0.95, fakeBox, 50, 38, true, 40)
    expect(after).toMatchObject({ pos: 'after', parent: [], index: 1 })
  })

  it('拖到 Scroll 内层 Column 上沿（before 被独子约束拒绝）→ 回退 inside 进 Column', () => {
    startNewDrag('Text')
    const d = computeDrop(scrollTree(), [0, 0], 0.05, fakeBox, 50, 2, true, 40)
    expect(d).not.toBeNull()
    expect(d!.pos).toBe('inside')
    expect(d!.parent).toEqual([0, 0])
  })

  it('根即 Scroll（独子已满）：拖到顶层 Column 上沿 → 回退 inside，不产生非法第二根子级', () => {
    const root: IRNode = { type: 'Scroll', ctorArgs: [], children: [column([text('a')])], modifiers: [] }
    startNewDrag('Text')
    const d = computeDrop(root, [0], 0.05, fakeBox, 50, 2, true, 40)
    expect(d).not.toBeNull()
    expect(d).toMatchObject({ pos: 'inside', parent: [0] })
  })

  it('画布约束仍生效：List 只收 ListItem，拖 Text 到 List 中部 → null', () => {
    const root = column([{ type: 'List', ctorArgs: [], children: [], modifiers: [] }])
    startNewDrag('Text')
    expect(computeDrop(root, [0], 0.5, fakeBox, 50, 20, true, 40)).toBeNull()
  })

  it('画布叶子节点保持 50% 前后分带（不受容器窄边带影响）', () => {
    const root = column([text('a'), text('b')])
    startNewDrag('Text')
    const before = computeDrop(root, [0], 0.4, fakeBox, 50, 16, true, 40)
    expect(before).toMatchObject({ pos: 'before', parent: [], index: 0 })
    const after = computeDrop(root, [0], 0.6, fakeBox, 50, 24, true, 40)
    expect(after).toMatchObject({ pos: 'after', parent: [], index: 1 })
  })
})

describe('resolveDragStart 位置调整模式的目标提升', () => {
  it('按下点落在 nudge 子树内（命中子组件）→ 提升到 nudge 节点 + 偏移模式', () => {
    // 大纲树选中 Grid=[1]，画布按在其孙组件 [1,0,2] 上
    expect(resolveDragStart([1, 0, 2], false, [1], false))
      .toEqual({ dragPath: [1], alt: true })
    // 正好按在 nudge 节点本身
    expect(resolveDragStart([1], false, [1], false))
      .toEqual({ dragPath: [1], alt: true })
  })
  it('按下点在 nudge 子树外 → 保持原目标，不进入偏移模式', () => {
    expect(resolveDragStart([0, 3], false, [1], false))
      .toEqual({ dragPath: [0, 3], alt: false })
    // nudge 是更深节点（按下点是祖先）→ 不提升
    expect(resolveDragStart([1], false, [1, 0], false))
      .toEqual({ dragPath: [1], alt: false })
  })
  it('大纲树发起的拖拽不受 nudge 影响；Alt 键始终强制偏移模式', () => {
    expect(resolveDragStart([1, 0], true, [1], false))
      .toEqual({ dragPath: [1, 0], alt: false })
    expect(resolveDragStart([0, 3], false, null, true))
      .toEqual({ dragPath: [0, 3], alt: true })
  })
})
