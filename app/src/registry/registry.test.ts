import { describe, it, expect } from 'vitest'
import { SUPPORTED } from '../renderer/Renderer'
import { SPECS } from './specs'
import {
  getSpec, PALETTE_GROUPS, CONTAINER_TYPES, SINGLE_CHILD_TYPES,
  specAcceptsChild, specCanAcceptMore, isStructural, makeDefaultNode, nodeSummary,
} from './index'
import { serialize } from '../ir/serialize'
import { parse } from '../parser/parser'
import { IRFile } from '../ir/types'

function wrap(child: ReturnType<typeof makeDefaultNode>): IRFile {
  return {
    structName: 'T', preamble: '', postamble: '', structDecorators: '@Entry\n@Component',
    members: [{ kind: 'build' }], states: [],
    root: { type: 'Column', ctorArgs: [], children: [child], modifiers: [] },
    rootExtrasPre: [], rootExtrasPost: [],
  }
}

describe('registry 完整性', () => {
  it('每个 SUPPORTED 类型都有注册声明', () => {
    for (const t of SUPPORTED) {
      expect(getSpec(t), `缺少 ${t} 的 ComponentSpec`).toBeDefined()
    }
  })

  it('组件面板分组与既有顺序一致', () => {
    expect(PALETTE_GROUPS.map(g => g.label)).toEqual(['布局', '容器', '基础', '表单', '反馈'])
    expect(PALETTE_GROUPS[0].items).toEqual(['Column', 'Row', 'Stack', 'RelativeContainer', 'Flex', 'Blank'])
    expect(PALETTE_GROUPS[1].items).toEqual(['Scroll', 'List', 'Grid', 'Tabs', 'ListItem', 'GridItem', 'TabContent', 'Badge'])
    expect(PALETTE_GROUPS[2].items).toEqual(['Text', 'Button', 'Image', 'Video', 'Divider'])
    expect(PALETTE_GROUPS[3].items).toEqual(['TextInput', 'Toggle', 'Slider', 'Checkbox', 'Radio', 'Select', 'Progress'])
    expect(PALETTE_GROUPS[4].items).toEqual(['Rating', 'LoadingProgress'])
  })

  it('每个 palette 元件都有 makeDefault', () => {
    for (const s of SPECS) {
      if (s.palette) expect(s.makeDefault, `${s.type} 缺少 makeDefault`).toBeDefined()
    }
  })

  it('palette 元件默认节点：序列化 → 解析 往返幂等', () => {
    for (const s of SPECS) {
      if (!s.palette || !s.makeDefault) continue
      const s1 = serialize(wrap(s.makeDefault()))
      const s2 = serialize(parse(s1))
      expect(s2, `${s.type} 默认节点往返不幂等`).toBe(s1)
    }
  })

  it('约束派生与既有行为一致', () => {
    // 子类型白名单
    expect(specAcceptsChild('List', 'ListItem')).toBe(true)
    expect(specAcceptsChild('List', 'Text')).toBe(false)
    expect(specAcceptsChild('Grid', 'GridItem')).toBe(true)
    expect(specAcceptsChild('Tabs', 'TabContent')).toBe(true)
    expect(specAcceptsChild('Column', 'Text')).toBe(true)
    // 独子容器
    expect(SINGLE_CHILD_TYPES.has('Scroll')).toBe(true)
    expect(SINGLE_CHILD_TYPES.has('TabContent')).toBe(true)
    expect(specCanAcceptMore({ type: 'Scroll', ctorArgs: [], children: [], modifiers: [] })).toBe(true)
    expect(specCanAcceptMore({
      type: 'Scroll', ctorArgs: [], modifiers: [],
      children: [{ type: 'Column', ctorArgs: [], children: [], modifiers: [] }],
    })).toBe(false)
    // 容器集合（dnd 中部落点 inside 判定）
    for (const t of ['Column', 'Row', 'Stack', 'RelativeContainer', 'Flex', 'Scroll', 'List', 'Grid', 'Tabs', 'TabContent', 'If', 'ForEach', 'BuilderCall']) {
      expect(CONTAINER_TYPES.has(t), `${t} 应为容器`).toBe(true)
    }
    expect(CONTAINER_TYPES.has('Text')).toBe(false)
    expect(CONTAINER_TYPES.has('Else')).toBe(false)
  })

  it('结构节点标记', () => {
    for (const t of ['If', 'Else', 'ForEach', 'BuilderCall']) {
      expect(isStructural(t), `${t} 应为结构节点`).toBe(true)
    }
    expect(isStructural('Text')).toBe(false)
  })

  it('makeDefaultNode 未注册类型返回裸节点', () => {
    const n = makeDefaultNode('CustomThing')
    expect(n).toEqual({ type: 'CustomThing', ctorArgs: [], children: [], modifiers: [] })
  })

  it('nodeSummary 摘要', () => {
    expect(nodeSummary({
      type: 'Text', ctorArgs: [{ t: 'str', v: '你好世界' }], children: [], modifiers: [],
    })).toBe('你好世界')
    expect(nodeSummary({
      type: 'If', ctorArgs: [{ t: 'raw', v: 'this.count > 0' }], children: [], modifiers: [],
    })).toBe('this.count > 0')
    expect(nodeSummary({ type: 'Unknown', ctorArgs: [], children: [], modifiers: [] })).toBe('')
  })
})
