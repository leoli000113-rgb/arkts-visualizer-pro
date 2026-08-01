import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store/store'
import { getNodeAtPath } from '../ir/mutate'

/**
 * 粘贴模式（复制/剪切后点击容器/组件即粘贴）的 store 行为：
 * 复制即开启 / 容器放入内部（独子下钻）/ 叶子放到其后 / 可连续多处 / 代码变更与撤销退出。
 */

const PAGE = `@Entry
@Component
struct T {
  build() {
    Column() {
      Scroll() {
        Column() {
          Text('a')
        }
      }
      Text('b')
    }
  }
}
`

beforeEach(() => {
  useStore.getState().loadSingleFile(PAGE)
})

describe('粘贴模式', () => {
  it('复制即开启粘贴模式，代码变更退出', () => {
    expect(useStore.getState().pasteArmed).toBe(false)
    useStore.getState().copyNode([1])
    expect(useStore.getState().pasteArmed).toBe(true)
    expect(useStore.getState().clipboard?.type).toBe('Text')
    useStore.getState().setCode(PAGE.replace(`Text('b')`, `Text('c')`))
    expect(useStore.getState().pasteArmed).toBe(false)
  })

  it('点击 Scroll 容器：自动下钻放入内层 Column 末尾', () => {
    useStore.getState().copyNode([1]) // Text('b')
    useStore.getState().pasteAt([0]) // Scroll
    const ir = useStore.getState().ir!
    // 内层 Column（路径 [0,0]）应多出一个 Text 子节点
    const inner = getNodeAtPath(ir.root, [0, 0])!
    expect(inner.children).toHaveLength(2)
    expect(inner.children[1].type).toBe('Text')
    // Scroll 独子约束未被破坏
    const scroll = getNodeAtPath(ir.root, [0])!
    expect(scroll.children).toHaveLength(1)
  })

  it('可连续点击多处粘贴（复制一次即可）', () => {
    useStore.getState().copyNode([1])
    useStore.getState().pasteAt([0])
    useStore.getState().pasteAt([0])
    const inner = getNodeAtPath(useStore.getState().ir!.root, [0, 0])!
    expect(inner.children).toHaveLength(3)
    // 粘贴后仍保持粘贴模式
    expect(useStore.getState().pasteArmed).toBe(true)
  })

  it('点击叶子组件：放到该节点之后', () => {
    useStore.getState().copyNode([0, 0, 0]) // Text('a')
    useStore.getState().pasteAt([1]) // Text('b') 之后
    const root = useStore.getState().ir!.root
    expect(root.children).toHaveLength(3)
    expect(root.children[2].type).toBe('Text')
    // 撤销退出粘贴模式
    useStore.getState().undo()
    expect(useStore.getState().pasteArmed).toBe(false)
  })

  it('剪切同样开启粘贴模式（粘贴后原位置已移除）', () => {
    useStore.getState().cutNode([1]) // Text('b') 剪掉
    expect(useStore.getState().pasteArmed).toBe(true)
    expect(useStore.getState().ir!.root.children).toHaveLength(1)
    useStore.getState().pasteAt([0]) // 放进 Scroll 内层
    const inner = getNodeAtPath(useStore.getState().ir!.root, [0, 0])!
    expect(inner.children).toHaveLength(2)
  })
})
