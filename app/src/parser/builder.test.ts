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

function findBuilderCall(root: IRNode, name: string): IRNode | undefined {
  let found: IRNode | undefined
  walk(root, n => {
    if (n.type === 'BuilderCall' && n.ctorArgs[1] && (n.ctorArgs[1] as any).v === name) found = n
  })
  return found
}

describe('@Builder 结构化与调用点镜像', () => {
  it('@Builder 方法解析为 builder 成员，签名原文保留', () => {
    const ir = parse(realPage)
    const builders = ir.members.filter(m => m.kind === 'builder') as { kind: 'builder'; name: string; signature: string }[]
    const names = builders.map(b => b.name)
    expect(names).toEqual(['buildHeader', 'buildModelSelector', 'buildHistorySection'])
    expect(builders[0].signature).toBe('@Builder buildHeader()')
  })

  it('build 内 this.buildHeader() 调用点变为 BuilderCall 镜像', () => {
    const ir = parse(realPage)
    const mirror = findBuilderCall(ir.root, 'buildHeader')
    expect(mirror).toBeTruthy()
    expect(mirror!.children.length).toBe(1)
    expect(mirror!.children[0].type).toBe('Row')
    // buildModelSelector 未被调用 → 不产生镜像，定义仍保留
    expect(findBuilderCall(ir.root, 'buildModelSelector')).toBeUndefined()
    const s = serialize(ir)
    expect(s).toContain('@Builder buildModelSelector()')
  })

  it('编辑镜像内部 UI → 写回 @Builder 定义；调用点语句原样', () => {
    const ir = parse(realPage)
    const mirror = findBuilderCall(ir.root, 'buildHeader')!
    let title: IRNode | undefined
    walk(mirror, n => {
      const a = n.ctorArgs[0]
      if (n.type === 'Text' && a && a.t === 'str' && a.v === '🎬 视频智能解析') title = n
    })
    expect(title).toBeTruthy()
    const fs = title!.modifiers.find(m => m.name === 'fontSize')
    expect(fs?.args[0]).toEqual({ t: 'num', v: 22 })
    fs!.args = [{ t: 'num', v: 26 }]
    const s = serialize(ir)
    // 定义处应用了编辑
    const defStart = s.indexOf('@Builder buildHeader()')
    const defEnd = s.indexOf('@Builder buildModelSelector()')
    expect(defStart).toBeGreaterThan(-1)
    expect(s.slice(defStart, defEnd)).toContain('.fontSize(26)')
    // 调用点原样保留
    expect(s).toContain('this.buildHeader();')
  })

  it('往返幂等', () => {
    const s1 = serialize(parse(realPage))
    const s2 = serialize(parse(s1))
    expect(s2).toBe(s1)
  })

  it('未被调用的 @Builder 编辑自身 children 也可输出（定义兜底）', () => {
    const ir = parse(realPage)
    const b = ir.members.find(m => m.kind === 'builder' && m.name === 'buildModelSelector') as any
    b.children[0].children[0].ctorArgs = [{ t: 'str', v: '分析模型（改）:' }]
    const s = serialize(ir)
    expect(s).toContain('分析模型（改）:')
  })
})
