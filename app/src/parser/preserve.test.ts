import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from './parser'
import { serialize } from '../ir/serialize'
import { IRNode } from '../ir/types'

const realPage = readFileSync(new URL('./fixtures/real_page.ets', import.meta.url), 'utf-8')

function walk(n: IRNode, fn: (n: IRNode) => void) {
  fn(n)
  n.children.forEach(c => walk(c, fn))
}

describe('真实工程文件：外科手术式编辑', () => {
  it('含 import/interface/方法/@Builder 的文件可解析', () => {
    const ir = parse(realPage)
    expect(ir.structName).toBe('Index')
    expect(ir.root.type).toBe('Scroll')
  })

  it('preamble / 装饰器 / postamble 原文保留', () => {
    const ir = parse(realPage)
    expect(ir.preamble).toContain("import { router } from '@kit.ArkUI';")
    expect(ir.preamble).toContain('interface RouteParams')
    expect(ir.preamble).toContain('// 首页')
    expect(ir.structDecorators).toContain('@Entry')
    expect(ir.structDecorators).toContain('@Component')
  })

  it('成员原文保留：方法/@Builder/字段一个不丢、顺序不变', () => {
    const s = serialize(parse(realPage))
    for (const snippet of [
      'async aboutToAppear(): Promise<void>',
      '@Builder buildHeader()',
      '@Builder buildModelSelector()',
      '@Builder buildHistorySection()',
      'private getSelectedModelIndex(): number',
      'private pickVideo(): void',
      'private async startAnalysis(): Promise<void>',
      'private viewReport(id: string): void',
      'router.pushUrl({',
    ]) {
      expect(s, `缺少: ${snippet}`).toContain(snippet)
    }
    // build 保持在原位置：aboutToAppear 之前是状态，@Builder 在 build 之后
    expect(s.indexOf('build()')).toBeGreaterThan(s.indexOf('aboutToAppear'))
    expect(s.indexOf('@Builder buildHeader')).toBeGreaterThan(s.indexOf('build()'))
  })

  it('@State 与 @StorageLink 装饰器保留', () => {
    const s = serialize(parse(realPage))
    expect(s).toContain("@State selectedVideoUri: string = ''")
    expect(s).toContain("@StorageLink('isAnalyzing') isAnalyzing: boolean = false")
    expect(s).toContain('@State historyItems: HistoryItem[] = []')
  })

  it('build 内的 this.xxx() 调用与注释原样保留', () => {
    const s = serialize(parse(realPage))
    expect(s).toContain('this.buildHeader();')
    expect(s).toContain('this.buildHistorySection();')
    expect(s).toContain('// 开始分析按钮')
    expect(s).toContain('// 错误提示卡片（分析失败后显示）')
  })

  it('往返幂等：序列化 → 再解析 → 再序列化 完全一致', () => {
    const s1 = serialize(parse(realPage))
    const s2 = serialize(parse(s1))
    expect(s2).toBe(s1)
  })

  it('只改 UI、其它原样：改 build 里一个字号，方法区零改动', () => {
    const ir = parse(realPage)
    // 找到 build 内「分析失败」Text，改 fontSize 14 → 15
    let target: IRNode | undefined
    walk(ir.root, n => {
      const a = n.ctorArgs[0]
      if (n.type === 'Text' && a && a.t === 'str' && a.v === '分析失败') target = n
    })
    expect(target).toBeTruthy()
    const fs = target!.modifiers.find(m => m.name === 'fontSize')
    expect(fs?.args[0]).toEqual({ t: 'num', v: 14 })
    fs!.args = [{ t: 'num', v: 15 }]
    const s = serialize(ir)
    expect(s).toContain('.fontSize(15)')
    // 方法区原文一字未动
    expect(s).toContain('private async startAnalysis(): Promise<void> {\n    if (!this.isVideoSelected || this.isAnalyzing) {\n      return;\n    }\n    this.isAnalyzing = true;\n  }')
    // @Builder 内的 UI 也原样
    expect(s).toContain("Text('🎬 视频智能解析')")
  })

  it('条件编译与复合修饰符（linearGradient/$r/rgba 字符串色）保留', () => {
    const s = serialize(parse(realPage))
    expect(s).toContain('if (this.isVideoSelected && !this.isAnalyzing) {')
    expect(s).toContain('.linearGradient({')
    expect(s).toContain("colors: [['#667eea', 0], ['#764ba2', 1]]")
    expect(s).toContain("$r('app.color.error')")
    expect(s).toContain("'rgba(255,255,255,0.8)'")
  })
})
