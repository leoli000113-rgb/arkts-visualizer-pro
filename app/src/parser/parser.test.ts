import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from './parser'
import { serialize } from '../ir/serialize'
import { IRNode } from '../ir/types'

const sampleV1 = readFileSync(new URL('../assets/sample.ets', import.meta.url), 'utf-8')
const sampleFull = readFileSync(new URL('../../../sample_full.ets', import.meta.url), 'utf-8')

function countNodes(n: IRNode): number {
  return 1 + n.children.reduce((s, c) => s + countNodes(c), 0)
}

function collectTypes(n: IRNode, into: Set<string>) {
  into.add(n.type)
  n.children.forEach(c => collectTypes(c, into))
}

function roundTripTwice(src: string) {
  const ir1 = parse(src)
  const s1 = serialize(ir1)
  const ir2 = parse(s1)
  const s2 = serialize(ir2)
  return { ir1, s1, ir2, s2 }
}

describe('sample.ets（v1 靶子）', () => {
  it('解析不报错', () => {
    const ir = parse(sampleV1)
    expect(ir.structName).toBeTruthy()
    expect(ir.root).toBeTruthy()
  })

  it('往返序列化幂等且不丢节点', () => {
    const { ir1, s1, ir2, s2 } = roundTripTwice(sampleV1)
    expect(s2).toBe(s1)
    expect(countNodes(ir2.root)).toBe(countNodes(ir1.root))
  })
})

describe('sample_full.ets（北极星全景）', () => {
  it('解析不报错，含全部关键结构', () => {
    const ir = parse(sampleFull)
    const types = new Set<string>()
    collectTypes(ir.root, types)
    for (const t of ['Stack', 'If', 'Tabs', 'TabContent', 'Scroll', 'Flex', 'List', 'ForEach', 'ListItem',
      'Grid', 'GridItem', 'Text', 'Button', 'Image', 'Video', 'TextInput', 'Toggle', 'Slider',
      'Checkbox', 'Radio', 'Progress', 'RelativeContainer']) {
      expect(types.has(t), `缺少节点类型 ${t}`).toBe(true)
    }
  })

  it('往返序列化幂等且不丢节点', () => {
    const { ir1, s1, ir2, s2 } = roundTripTwice(sampleFull)
    expect(s2).toBe(s1)
    expect(countNodes(ir2.root)).toBe(countNodes(ir1.root))
  })

  it('@State 泛型与数组字面量保留', () => {
    const ir = parse(sampleFull)
    const list = ir.states.find(s => s.name === 'list')
    expect(list).toBeTruthy()
    expect(list!.type).toBe('Array<string>')
    expect(list!.init.t).toBe('raw')
    expect((list!.init as any).v).toContain('列表项 1')
  })

  it('if 条件渲染 → If/Else 节点，条件原文保留', () => {
    const ir = parse(sampleFull)
    const ifNode = ir.root.children.find(c => c.type === 'If')
    expect(ifNode).toBeTruthy()
    expect(ifNode!.ctorArgs[0]).toEqual({ t: 'raw', v: '(this.dialogVisible)' })
    expect(ifNode!.children.length).toBeGreaterThan(0)
  })

  it('ForEach：数据源、参数、keyGen、模板体齐全', () => {
    const ir = parse(sampleFull)
    let fe: IRNode | undefined
    const walk = (n: IRNode) => { if (n.type === 'ForEach' && !fe) fe = n; n.children.forEach(walk) }
    walk(ir.root)
    expect(fe).toBeTruthy()
    expect(fe!.ctorArgs[0]).toEqual({ t: 'enum', v: 'this.list' })
    expect(fe!.ctorArgs[1]).toEqual({ t: 'raw', v: '(item: string)' })
    expect(fe!.ctorArgs[2].t).toBe('raw') // keyGen 箭头
    expect(fe!.children[0].type).toBe('ListItem')
  })

  it('字符串拼接 + 三元表达式按 raw 保留', () => {
    const ir = parse(sampleFull)
    let found: IRNode | undefined
    const walk = (n: IRNode) => {
      if (n.type === 'Text' && n.ctorArgs[0]?.t === 'raw' && (n.ctorArgs[0] as any).v.includes('开关状态')) found = n
      n.children.forEach(walk)
    }
    walk(ir.root)
    expect(found).toBeTruthy()
    expect((found!.ctorArgs[0] as any).v).toContain('?')
  })
})

describe('语句级用例', () => {
  const src = `@Entry
@Component
struct T {
  @State a: number = 1
  build() {
    Column() {
      Text(\`hello \${this.a}\`)
      Button('x').onClick(() => { this.a = 1 })
      Image($r('app.media.icon')).width(40)
      Text(-5 + 'px')
      Text('b' + this.a)
    }
  }
}
`
  it('模板字符串 / 箭头函数 / $r / 一元与拼接表达式均可解析且往返幂等', () => {
    const { ir1, s1, s2 } = roundTripTwice(src)
    expect(s2).toBe(s1)
    const types: string[] = []
    const walk = (n: IRNode) => { types.push(n.type); n.children.forEach(walk) }
    walk(ir1.root)
    expect(types).toContain('Image')
    expect(s1).toContain("$r('app.media.icon')")
    expect(s1).toContain('`hello ${this.a}`')
    expect(s1).toContain('() => { this.a = 1 }')
  })

  it('无法识别的构造 → Unknown 占位且不丢失原文', () => {
    const weird = `@Entry
@Component
struct T {
  build() {
    Column() {
      Text('ok')
      @@@not valid@@@
      Text('still here')
    }
  }
}
`
    const ir = parse(weird)
    const types: string[] = []
    const walk = (n: IRNode) => { types.push(n.type); n.children.forEach(walk) }
    walk(ir.root)
    expect(types.filter(t => t === 'Text').length).toBe(2)
    expect(types).toContain('Unknown')
    const s = serialize(ir)
    expect(s).toContain('解析失败')
  })
})
