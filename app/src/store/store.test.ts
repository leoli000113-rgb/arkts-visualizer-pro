import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { createNode } from '../ir/defaults'
import { serialize } from '../ir/serialize'
import { parse } from '../parser/parser'
import { IRFile } from '../ir/types'

const ALL_TYPES = [
  'Text', 'Button', 'Image', 'Column', 'Row', 'Stack', 'RelativeContainer',
  'Flex', 'Scroll', 'List', 'ListItem', 'Grid', 'GridItem', 'Tabs', 'TabContent',
  'TextInput', 'Toggle', 'Slider', 'Checkbox', 'Radio', 'Progress', 'Video',
]

function wrap(child: ReturnType<typeof createNode>): IRFile {
  return {
    structName: 'T', preamble: '', postamble: '', structDecorators: '@Entry\n@Component',
    members: [{ kind: 'build' }], states: [],
    root: { type: 'Column', ctorArgs: [], children: [child], modifiers: [] },
    rootExtrasPre: [], rootExtrasPost: [],
  }
}

describe('store 撤销/重做', () => {
  beforeEach(() => {
    useStore.getState().setCode(`@Entry\n@Component\nstruct T {\n  build() {\n    Column() {\n      Text('a')\n    }\n  }\n}\n`)
  })

  it('mutate 后可撤销、撤销后可重做', () => {
    const s = useStore.getState()
    const before = s.code
    s.mutateNode([0], n => ({ ...n, ctorArgs: [{ t: 'str', v: 'b' }] }))
    expect(useStore.getState().code).toContain(`Text('b')`)
    useStore.getState().undo()
    expect(useStore.getState().code).toBe(before)
    useStore.getState().redo()
    expect(useStore.getState().code).toContain(`Text('b')`)
  })

  it('insert/remove 可撤销', () => {
    const s = useStore.getState()
    s.insertChild([], createNode('Button'), 1)
    expect(useStore.getState().code).toContain('Button')
    useStore.getState().undo()
    expect(useStore.getState().code).not.toContain('Button')
    useStore.getState().redo()
    expect(useStore.getState().code).toContain('Button')
    useStore.getState().removeNode([1])
    expect(useStore.getState().code).not.toContain('Button')
    useStore.getState().undo()
    expect(useStore.getState().code).toContain('Button')
  })

  it('setCode 清空历史栈', () => {
    const s = useStore.getState()
    s.mutateNode([0], n => ({ ...n, ctorArgs: [{ t: 'str', v: 'b' }] }))
    useStore.getState().setCode(useStore.getState().code)
    expect(useStore.getState().past.length).toBe(0)
    expect(useStore.getState().future.length).toBe(0)
  })

  it('连续手势合并为一步撤销', () => {
    const s = useStore.getState()
    s.pushHistory()
    for (let i = 1; i <= 10; i++) {
      s.mutateNode([0], n => ({ ...n, ctorArgs: [{ t: 'str', v: 'v' + i }] }), { history: false })
    }
    expect(useStore.getState().code).toContain(`Text('v10')`)
    useStore.getState().undo()
    expect(useStore.getState().code).toContain(`Text('a')`)
  })

  it('右键菜单动作：创建副本 / 上移下移 / 容器包裹', () => {
    const s = useStore.getState()
    // 创建副本：Text 之后多一个深拷贝
    s.duplicateNode([0])
    expect(useStore.getState().code.match(/Text\('a'\)/g)?.length).toBe(2)
    // 下移：第一个 Text 移到第二个之后
    useStore.getState().moveSibling([0], 1)
    expect(useStore.getState().selectedPath).toEqual([1])
    // 容器包裹：Text 外层多套一个 Stack
    useStore.getState().wrapNode([1], 'Stack')
    expect(useStore.getState().code).toContain('Stack() {')
    expect(useStore.getState().code).toContain(`Text('a')`)
    // 撤销可逐步回退
    useStore.getState().undo()
    expect(useStore.getState().code).not.toContain('Stack() {')
  })

  it('历史栈上限 50 步', () => {
    const s = useStore.getState()
    for (let i = 0; i < 60; i++) s.mutateNode([0], n => ({ ...n, ctorArgs: [{ t: 'str', v: 'v' + i }] }))
    let count = 0
    while (useStore.getState().past.length > 0 && count < 100) { useStore.getState().undo(); count++ }
    expect(count).toBe(50)
  })
})

describe('全部组件默认值：序列化 → 解析 往返幂等', () => {
  for (const t of ALL_TYPES) {
    it(t, () => {
      const s1 = serialize(wrap(createNode(t)))
      const s2 = serialize(parse(s1))
      expect(s2).toBe(s1)
    })
  }
})
