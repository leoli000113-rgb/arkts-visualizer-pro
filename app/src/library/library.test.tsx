import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LIBRARY } from './components'
import { serialize } from '../ir/serialize'
import { parse } from '../parser/parser'
import { renderNode } from '../renderer/Renderer'
import { IRFile, IRNode } from '../ir/types'

/** 包一层 build 结构：根 Column 内放被测节点 */
function wrap(child: IRNode): IRFile {
  return {
    structName: 'T', preamble: '', postamble: '', structDecorators: '@Entry\n@Component',
    members: [{ kind: 'build' }], states: [],
    root: { type: 'Column', ctorArgs: [], children: [child], modifiers: [] },
    rootExtrasPre: [], rootExtrasPost: [],
  }
}

describe('组件库复合组件全链路（拖入即 serialize → parse → 渲染）', () => {
  for (const c of LIBRARY) {
    it(`${c.category}/${c.name}：序列化→解析→SSR 渲染不抛错`, () => {
      const code = serialize(wrap(c.makeNode()))
      // 序列化产物必须能被自家 parser 解析（否则拖入后画布报错/卡死）
      const ir = parse(code)
      const html = renderToStaticMarkup(
        <>{renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids: false })}</>,
      )
      expect(html.length).toBeGreaterThan(0)
    })
  }

  it('复合组件只用已注册组件类型', () => {
    const check = (n: IRNode) => {
      const known = new Set([
        'Column', 'Row', 'Stack', 'Flex', 'Scroll', 'List', 'ListItem', 'Grid', 'GridItem',
        'Tabs', 'TabContent', 'Badge', 'RelativeContainer', 'Text', 'Button', 'Image', 'Video',
        'Divider', 'Blank', 'TextInput', 'Toggle', 'Slider', 'Checkbox', 'Radio', 'Select',
        'Progress', 'Rating', 'LoadingProgress',
      ])
      expect(known.has(n.type)).toBe(true)
      n.children.forEach(check)
    }
    for (const c of LIBRARY) check(c.makeNode())
  })
})
