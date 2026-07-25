import React from 'react'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { parse } from '../parser/parser'
import { renderNode, SUPPORTED } from './Renderer'

const sampleV1 = readFileSync(new URL('../assets/sample.ets', import.meta.url), 'utf-8')
const sampleFull = readFileSync(new URL('../../../sample_full.ets', import.meta.url), 'utf-8')

/** 全树 SSR 渲染（显式传入 @State 表与辅助标记，模拟 App 中 store 提供的上下文） */
function renderSrc(src: string, aids = true): string {
  const ir = parse(src)
  return renderToStaticMarkup(
    <>{renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids })}</>,
  )
}

describe('渲染器冒烟', () => {
  it('sample.ets（v1 靶子）渲染结构不回归', () => {
    const html = renderSrc(sampleV1)
    for (const t of ['左', '中', '右', '底层', '上层', '锚点', '相对锚点右侧', '相对锚点下方']) {
      expect(html).toContain(t)
    }
    // 根节点 data-path 为空串；无 ⚠️ 占位
    expect(html).toContain('data-path=""')
    expect(html).not.toContain('暂不支持编辑')
  })

  it('sample_full.ets 全树渲染不抛异常且含关键内容', () => {
    const html = renderSrc(sampleFull)
    // Tabs 标签栏
    expect(html).toContain('布局')
    expect(html).toContain('容器')
    expect(html).toContain('ir-tabs-tab')
    // ForEach：@State 数组数据源 + enum 变量替换
    expect(html).toContain('列表项 1')
    expect(html).toContain('列表项 5')
    // ForEach：raw 数组字面量 + '前缀' + i 拼接替换
    expect(html).toContain('G0')
    expect(html).toContain('G7')
    expect(html).toContain('项9')
    // Progress / Video / TextInput
    expect(html).toContain('ir-progress')
    expect(html).toContain('[Video: placeholder.mp4]')
    expect(html).toContain('请输入文本')
    // If 折叠占位徽标（dialogVisible 初值为 false，辅助标记开启时可见）
    expect(html).toContain('if (this.dialogVisible)')
    expect(html).toContain('当前不渲染')
    // 无 ⚠️ 占位（北极星组件全覆盖）
    expect(html).not.toContain('暂不支持编辑')
  })

  it('辅助标记关闭：页面即所得，无徽标噪音', () => {
    const src = `@Entry
@Component
struct T {
  @State show: boolean = false
  build() {
    Column() {
      Text('可见内容')
      this.doSomething();
      if (this.show) {
        Text('条件内容')
      }
      MyCustomCard({ title: 'x' })
    }
  }
}
`
    const html = renderSrc(src, false)
    expect(html).toContain('可见内容')
    // 折叠 If / Expr / builder 标签全部隐藏
    expect(html).not.toContain('当前不渲染')
    expect(html).not.toContain('doSomething')
    // 自定义组件渲染为中性占位卡片（含类型名，可点选）
    expect(html).toContain('ir-custom')
    expect(html).toContain('MyCustomCard')
    // 辅助标记开启：Expr 徽标与 If 折叠占位出现
    const htmlAids = renderSrc(src, true)
    expect(htmlAids).toContain('doSomething')
    expect(htmlAids).toContain('当前不渲染')
  })

  it('SUPPORTED 覆盖全部新组件类型与 If/Else/ForEach/BuilderCall', () => {
    for (const t of [
      'Column', 'Row', 'Stack', 'RelativeContainer', 'Text', 'Button', 'Image',
      'Flex', 'Scroll', 'List', 'ListItem', 'Grid', 'GridItem', 'Tabs', 'TabContent',
      'TextInput', 'Toggle', 'Slider', 'Checkbox', 'Radio',
      'Progress', 'Video', 'If', 'Else', 'ForEach', 'BuilderCall',
    ]) {
      expect(SUPPORTED.has(t), `SUPPORTED 缺少 ${t}`).toBe(true)
    }
  })
})
