/**
 * native-editor 渲染属性转换层（render/argConvert.ts）的单测：纯逻辑，与 ArkUI 无关。
 */
import { describe, it, expect } from 'vitest'
import { arrayLiteralCount, boolOf, colorOf, enumOf, lengthOf, numOf, objVal, rawOf, strOf } from '../../../native-editor/entry/src/main/ets/render/argConvert'
import { ArgVal } from '../../../native-editor/entry/src/main/ets/core/ir'

const S = (v: string): ArgVal => ({ t: 'str', v })
const N = (v: number): ArgVal => ({ t: 'num', v })
const H = (v: number): ArgVal => ({ t: 'hex', v })
const B = (v: boolean): ArgVal => ({ t: 'bool', v })
const E = (v: string): ArgVal => ({ t: 'enum', v })
const R = (v: string): ArgVal => ({ t: 'raw', v })
const O = (v: Record<string, ArgVal>): ArgVal => ({ t: 'obj', v })

describe('argConvert', () => {
  it('strOf/numOf/boolOf/enumOf/rawOf 各归各位', () => {
    expect(strOf(S('x'))).toBe('x')
    expect(strOf(N(1))).toBeNull()
    expect(numOf(N(1.5))).toBe(1.5)
    expect(boolOf(B(true))).toBe(true)
    expect(enumOf(E('Color.Red'))).toBe('Color.Red')
    expect(rawOf(R('this.x'))).toBe('this.x')
    expect(strOf(undefined)).toBeNull()
  })

  it('lengthOf：数字与百分比/单位字符串可通过，表达式不可求值', () => {
    expect(lengthOf(N(194.2))).toBe(194.2)
    expect(lengthOf(S('100%'))).toBe('100%')
    expect(lengthOf(S('20fp'))).toBe('20fp')
    expect(lengthOf(R('this.w'))).toBeNull()
    expect(lengthOf(E('Color.Red'))).toBeNull()
  })

  it('colorOf：字符串与 hex 可通过，enum 交给 .ets 查表', () => {
    expect(colorOf(S('#f5f5f5'))).toBe('#f5f5f5')
    expect(colorOf(H(0xFF112233))).toBe(0xFF112233)
    expect(colorOf(E('Color.Gray'))).toBeNull()
    expect(colorOf(N(123))).toBeNull()
  })

  it('objVal 按键取值', () => {
    const o = O({ top: N(8), x: S('50%') })
    expect(objVal(o, 'top')).toEqual(N(8))
    expect(objVal(o, 'missing')).toBeUndefined()
    expect(objVal(S('x'), 'top')).toBeUndefined()
  })

  it('arrayLiteralCount：顶层逗号计数，忽略嵌套', () => {
    expect(arrayLiteralCount('[1, 2, 3]')).toBe(3)
    expect(arrayLiteralCount("['a', {x: 1, y: 2}, [3, 4]]")).toBe(3)
    expect(arrayLiteralCount('[]')).toBe(0)
    expect(arrayLiteralCount('this.list')).toBeNull()
    expect(arrayLiteralCount('[1, 2')).toBeNull()
  })
})
