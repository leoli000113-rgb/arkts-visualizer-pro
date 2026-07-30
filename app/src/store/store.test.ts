import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { createNode } from '../ir/defaults'
import { serialize } from '../ir/serialize'
import { parse } from '../parser/parser'
import { getNodeAtPath } from '../ir/mutate'
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

describe('store 剪贴板 / 模板历史 / 错误保留 / 缩放', () => {
  beforeEach(() => {
    useStore.getState().setCode(`@Entry\n@Component\nstruct T {\n  build() {\n    Column() {\n      Text('a')\n    }\n  }\n}\n`)
  })

  it('复制 → 粘贴：选中容器时放入其末尾', () => {
    useStore.getState().copyNode([0])
    useStore.getState().setSelected([])
    useStore.getState().pasteNode()
    expect(useStore.getState().code.match(/Text\('a'\)/g)?.length).toBe(2)
    // 粘贴后可撤销
    useStore.getState().undo()
    expect(useStore.getState().code.match(/Text\('a'\)/g)?.length).toBe(1)
  })

  it('剪切 → 粘贴到选中节点之后', () => {
    useStore.getState().cutNode([0])
    expect(useStore.getState().code).not.toContain(`Text('a')`)
    useStore.getState().pasteNode()
    expect(useStore.getState().code).toContain(`Text('a')`)
  })

  it('约束拦截：Text 不粘进 List，而是落到选中节点之后', () => {
    useStore.getState().setCode(`@Entry\n@Component\nstruct T {\n  build() {\n    Column() {\n      List() {\n        ListItem() {\n          Text('x')\n        }\n      }\n      Text('a')\n    }\n  }\n}\n`)
    useStore.getState().copyNode([1]) // Text('a')
    useStore.getState().setSelected([0]) // List
    useStore.getState().pasteNode()
    const st = useStore.getState()
    // List 内仍只有 ListItem（未违反子类型约束）
    expect(getNodeAtPath(st.ir!.root, [0])!.children.length).toBe(1)
    // 副本落在 List 之后（根 Column 的第 2 位）
    expect(getNodeAtPath(st.ir!.root, [1])!.type).toBe('Text')
    expect(st.code.match(/Text\('a'\)/g)?.length).toBe(2)
  })

  it('setCode keepHistory：模板套用可撤销', () => {
    const before = useStore.getState().code
    useStore.getState().setCode(`@Entry\n@Component\nstruct T2 {\n  build() {\n    Column() {\n      Text('b')\n    }\n  }\n}\n`, { keepHistory: true })
    expect(useStore.getState().code).toContain(`Text('b')`)
    useStore.getState().undo()
    expect(useStore.getState().code).toBe(before)
  })

  it('解析失败保留最后可用 IR，error 记录原因', () => {
    // build() 两个根组件 → 解析必抛错
    useStore.getState().setCode(`@Entry\n@Component\nstruct T {\n  build() {\n    Text('a')\n    Text('b')\n  }\n}\n`)
    const st = useStore.getState()
    expect(st.error).toBeTruthy()
    expect(st.ir).not.toBeNull() // 画布不闪白
  })

  it('zoom 限制在 0.2–2', () => {
    useStore.getState().setZoom(5)
    expect(useStore.getState().zoom).toBe(2)
    useStore.getState().setZoom(0.01)
    expect(useStore.getState().zoom).toBe(0.2)
    useStore.getState().setZoom(1)
    expect(useStore.getState().zoom).toBe(1)
  })
})
