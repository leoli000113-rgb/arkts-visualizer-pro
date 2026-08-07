/**
 * native-editor core/exprEval.ts 单测：表达式子集求值 / 作用域 / ForEach 参数
 */
import { describe, it, expect } from 'vitest'
import {
  buildScope, evalRaw, forEachParams, jsTruthy, tryEval, vToStr, V,
} from '../../../native-editor/entry/src/main/ets/core/exprEval'
import { parse } from '../../../native-editor/entry/src/main/ets/core/parser'

const scope = (entries: Record<string, V>): Map<string, V> => new Map(Object.entries(entries))

describe('exprEval', () => {
  it('字面量与算术', () => {
    expect(evalRaw('1 + 2 * 3', new Map())).toBe(7)
    expect(evalRaw('(1 + 2) * 3', new Map())).toBe(9)
    expect(evalRaw('-4 + 1', new Map())).toBe(-3)
    expect(evalRaw('7 % 3', new Map())).toBe(1)
    expect(evalRaw("'a' + 'b'", new Map())).toBe('ab')
    expect(evalRaw("'n=' + 5", new Map())).toBe('n=5')
    expect(evalRaw('0x10', new Map())).toBe(16)
  })

  it('比较/逻辑/三元', () => {
    expect(evalRaw('3 > 2', new Map())).toBe(true)
    expect(evalRaw('3 <= 2', new Map())).toBe(false)
    expect(evalRaw("1 == '1'", new Map())).toBe(true)
    expect(evalRaw("1 === '1'", new Map())).toBe(false)
    expect(evalRaw('true && false', new Map())).toBe(false)
    expect(evalRaw('null ?? 5', new Map())).toBe(5)
    expect(evalRaw("0 || 'x'", new Map())).toBe('x')
    expect(evalRaw("2 > 1 ? '大' : '小'", new Map())).toBe('大')
  })

  it('变量与成员', () => {
    const v = scope({ count: 0, list: [1, 2, 3], title: '你好' })
    expect(evalRaw('this.count', v)).toBe(0)
    expect(evalRaw('this.count > 0', v)).toBe(false)
    expect(evalRaw('this.list.length', v)).toBe(3)
    expect(evalRaw('this.list[1]', v)).toBe(2)
    expect(evalRaw('this.title.length', v)).toBe(2)
    expect(evalRaw('it + 1', scope({ it: 10 }))).toBe(11)
  })

  it('模板字符串', () => {
    const v = scope({ list: [1, 2, 3], n: 7 })
    expect(evalRaw('`计数: ${this.list.length}`', v)).toBe('计数: 3')
    expect(evalRaw('`a${this.n + 1}b`', v)).toBe('a8b')
  })

  it('全局函数与 toString', () => {
    expect(evalRaw('String(42)', new Map())).toBe('42')
    expect(evalRaw("Number('3.5')", new Map())).toBe(3.5)
    expect(evalRaw('[1, 2].toString()', new Map())).toBe('1,2')
  })

  it('数组字面量', () => {
    expect(evalRaw('[1, 2, 3]', new Map())).toEqual([1, 2, 3])
    expect(evalRaw("['a']", new Map())).toEqual(['a'])
    expect(evalRaw('[]', new Map())).toEqual([])
  })

  it('不支持/未定义 → tryEval 返回 undefined', () => {
    expect(tryEval('this.missing', new Map())).toBeUndefined()
    expect(tryEval('foo.bar', new Map())).toBeUndefined()
    expect(tryEval('$r("app.media.x")', new Map())).toBeUndefined()
    expect(tryEval('1 +', new Map())).toBeUndefined()
  })

  it('jsTruthy / vToStr 语义', () => {
    expect(jsTruthy(0)).toBe(false)
    expect(jsTruthy([])).toBe(true)
    expect(jsTruthy('')).toBe(false)
    expect(vToStr(null)).toBe('null')
    expect(vToStr([1, 2])).toBe('1,2')
  })

  it('buildScope 从 IRState 求值（含 raw 数组引用前序状态）', () => {
    const f = parse(`@Component
struct P {
  @State count: number = 3
  @State list: string[] = ['a', 'b']
  @State doubled: number = this.count * 2
  @State title: string = 'hi'
  build() { Column() {} }
}
`)
    const v = buildScope(f.states)
    expect(v.get('count')).toBe(3)
    expect(v.get('list')).toEqual(['a', 'b'])
    expect(v.get('doubled')).toBe(6)
    expect(v.get('title')).toBe('hi')
  })

  it('forEachParams', () => {
    expect(forEachParams('(item: string)')).toEqual(['item', null])
    expect(forEachParams('(item, index)')).toEqual(['item', 'index'])
    expect(forEachParams('(it: number, i: number)')).toEqual(['it', 'i'])
    expect(forEachParams('item')).toEqual(['item', null])
  })
})
