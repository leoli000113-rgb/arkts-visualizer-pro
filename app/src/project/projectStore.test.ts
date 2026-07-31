import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store/store'

/**
 * 项目模式（多文件/跨页面导航）的 store 行为：
 * 整项目导入落起始页 / navigateTo-navigateBack 导航栈 / 跨文件组件表 / 切换写回 / 单文件退出项目模式。
 */

const PAGE_A = `@Entry\n@Component\nstruct Index {\n  build() {\n    Column() {\n      Text('A')\n    }\n  }\n}\n`
const PAGE_B = `import { Card } from '../components/Card';\n@Entry\n@Component\nstruct Detail {\n  build() {\n    Column() {\n      Card()\n      Text('B')\n    }\n  }\n}\n`
const COMP = `@Component\nstruct Card {\n  build() {\n    Text('card')\n  }\n}\n`

const FILES = {
  'proj/entry/src/main/ets/pages/Index.ets': PAGE_A,
  'proj/entry/src/main/ets/pages/Detail.ets': PAGE_B,
  'proj/entry/src/main/ets/components/Card.ets': COMP,
}
const INDEX = 'proj/entry/src/main/ets/pages/Index.ets'
const DETAIL = 'proj/entry/src/main/ets/pages/Detail.ets'

beforeEach(() => {
  useStore.getState().resetToSample()
})

describe('项目模式：导入与导航', () => {
  it('importProject 落到 pages/Index 起始页', () => {
    useStore.getState().importProject(FILES, {}, {}, {})
    const s = useStore.getState()
    expect(s.currentFile).toBe(INDEX)
    expect(s.code).toBe(PAGE_A)
    expect(s.error).toBeNull()
    expect(s.ir?.structName).toBe('Index')
  })

  it('navigateTo / navigateBack 模拟 router 导航栈', () => {
    useStore.getState().importProject(FILES, {}, {}, {})
    useStore.getState().navigateTo('pages/Detail')
    expect(useStore.getState().currentFile).toBe(DETAIL)
    expect(useStore.getState().code).toBe(PAGE_B)
    expect(useStore.getState().navStack).toEqual([INDEX])
    useStore.getState().navigateBack()
    expect(useStore.getState().currentFile).toBe(INDEX)
    expect(useStore.getState().navStack).toEqual([])
    // 空栈回退是 no-op；未知 url 跳转也是 no-op
    useStore.getState().navigateBack()
    expect(useStore.getState().currentFile).toBe(INDEX)
    useStore.getState().navigateTo('pages/Nowhere')
    expect(useStore.getState().currentFile).toBe(INDEX)
  })

  it('跨文件组件表：import 的组件进入 components', () => {
    useStore.getState().importProject(FILES, {}, {}, {})
    useStore.getState().setCurrentFile(DETAIL)
    expect(useStore.getState().components.Card?.structName).toBe('Card')
    // 回到 Index（无 import），组件表收缩为仅同文件
    useStore.getState().setCurrentFile(INDEX)
    expect(useStore.getState().components.Card).toBeUndefined()
  })

  it('切换页面写回编辑内容（files 表以最新 code 为准）', () => {
    useStore.getState().importProject(FILES, {}, {}, {})
    const edited = PAGE_A.replace(`Text('A')`, `Text('A2')`)
    useStore.getState().setCode(edited)
    expect(useStore.getState().files[INDEX]).toBe(edited)
    useStore.getState().setCurrentFile(DETAIL)
    useStore.getState().setCurrentFile(INDEX)
    expect(useStore.getState().code).toContain(`Text('A2')`)
  })

  it('loadSingleFile 退出项目模式', () => {
    useStore.getState().importProject(FILES, { cover: 'data:image/png;base64,AAA' }, { primary: '#111111' }, {})
    useStore.getState().loadSingleFile(PAGE_A)
    const s = useStore.getState()
    expect(s.currentFile).toBeNull()
    expect(Object.keys(s.files)).toHaveLength(0)
    expect(Object.keys(s.media)).toHaveLength(0)
    expect(s.code).toBe(PAGE_A)
  })

  it('媒体表增删', () => {
    useStore.getState().importMedia({ a: 'data:image/png;base64,AAA' })
    useStore.getState().importMedia({ b: 'data:video/mp4;base64,BBB' })
    expect(Object.keys(useStore.getState().media).sort()).toEqual(['a', 'b'])
    useStore.getState().removeMedia('a')
    expect(Object.keys(useStore.getState().media)).toEqual(['b'])
  })
})
