/**
 * native-editor core/mutate.ts 的单测：路径定位 / 修饰符编辑 / 位移 / 删除 / 复制
 */
import { describe, it, expect } from 'vitest'
import { parse } from '../../../native-editor/entry/src/main/ets/core/parser'
import { serialize } from '../../../native-editor/entry/src/main/ets/core/serialize'
import {
  deleteAtPath, duplicateAtPath, keyToPath, moveBy, nodeAtPath,
  readNumModifier, readStrModifier, readTextArg,
  setColorModifier, setLengthModifier, setNumModifier, setTextArg,
} from '../../../native-editor/entry/src/main/ets/core/mutate'

const SRC = `@Entry
@Component
struct P {
  build() {
    Column() {
      Text('hello')
        .fontSize(20)
      Row({ space: 8 }) {
        Button('确定')
        Text('内层')
      }
    }
    .width('100%')
  }
}
`

const tree = () => parse(SRC).root

describe('mutate', () => {
  it('keyToPath / nodeAtPath 定位', () => {
    const r = tree()
    expect(keyToPath('')).toEqual([])
    expect(keyToPath('1.0')).toEqual([1, 0])
    expect(nodeAtPath(r, [])?.type).toBe('Column')
    expect(nodeAtPath(r, [0])?.type).toBe('Text')
    expect(nodeAtPath(r, [1, 0])?.type).toBe('Button')
    expect(nodeAtPath(r, [9])).toBeNull()
  })

  it('setTextArg / readTextArg 并往返序列化', () => {
    const r = tree()
    const t = nodeAtPath(r, [0])
    expect(t).not.toBeNull()
    expect(readTextArg(t!)).toBe('hello')
    setTextArg(t!, '世界')
    const out = serialize({ ...parse(SRC), root: r })
    expect(out).toContain("Text('世界')")
  })

  it('数值/长度/颜色修饰符读写', () => {
    const r = tree()
    const t = nodeAtPath(r, [0])!
    expect(readNumModifier(t, 'fontSize')).toBe(20)
    setNumModifier(t, 'fontSize', 24)
    expect(readNumModifier(t, 'fontSize')).toBe(24)
    setLengthModifier(t, 'width', '50%')
    expect(readStrModifier(t, 'width')).toBe('50%')
    setLengthModifier(t, 'height', '120')
    expect(readNumModifier(t, 'height')).toBe(120)
    setLengthModifier(t, 'width', '')
    expect(readStrModifier(t, 'width')).toBeNull()
    setColorModifier(t, 'fontColor', '#ff0000')
    expect(readStrModifier(t, 'fontColor')).toBe('#ff0000')
    setColorModifier(t, 'fontColor', '红色')  // 非法输入忽略
    expect(readStrModifier(t, 'fontColor')).toBe('#ff0000')
  })

  it('moveBy 创建并累加 offset', () => {
    const r = tree()
    const t = nodeAtPath(r, [0])!
    moveBy(t, 10, -4)
    moveBy(t, 5, 4)
    const out = serialize({ ...parse(SRC), root: r })
    expect(out).toContain('.offset({ x: 15, y: 0 })')
  })

  it('deleteAtPath / duplicateAtPath', () => {
    const r = tree()
    expect(duplicateAtPath(r, [0])).toEqual([1])
    expect(nodeAtPath(r, [1])?.type).toBe('Text')
    expect(deleteAtPath(r, [1])).toBe(true)
    expect(nodeAtPath(r, [1])?.type).toBe('Row')
    expect(deleteAtPath(r, [])).toBe(false)   // 根不可删
    expect(duplicateAtPath(r, [])).toBeNull()  // 根不可复制
  })
})
