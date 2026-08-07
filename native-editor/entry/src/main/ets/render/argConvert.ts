/**
 * ArgVal → ArkUI 属性值的纯逻辑转换（不依赖 ArkUI 类型，可被 web 侧 vitest 单测）
 * .ets 侧（DynamicRenderer）负责把转换结果喂给具体的属性 API。
 */

import { ArgVal } from '../core/ir'

export function strOf(a: ArgVal | undefined): string | null {
  return a !== undefined && a.t === 'str' ? a.v : null
}

export function numOf(a: ArgVal | undefined): number | null {
  return a !== undefined && a.t === 'num' ? a.v : null
}

export function boolOf(a: ArgVal | undefined): boolean | null {
  return a !== undefined && a.t === 'bool' ? a.v : null
}

export function enumOf(a: ArgVal | undefined): string | null {
  return a !== undefined && a.t === 'enum' ? a.v : null
}

export function rawOf(a: ArgVal | undefined): string | null {
  return a !== undefined && a.t === 'raw' ? a.v : null
}

/** Length 候选：数字(vp) / 百分比或带单位字符串；其余（表达式/$r）不可求值返回 null */
export function lengthOf(a: ArgVal | undefined): string | number | null {
  if (a === undefined) return null
  if (a.t === 'num') return a.v
  if (a.t === 'str') return a.v
  return null
}

/** 颜色候选：'#rrggbb' 字符串 / 0xAARRGGBB 数值；Color.X 枚举由 .ets 侧查表 */
export function colorOf(a: ArgVal | undefined): string | number | null {
  if (a === undefined) return null
  if (a.t === 'str') return a.v
  if (a.t === 'hex') return a.v
  return null
}

/** obj 参数的某个键（缺失返回 undefined，交由 lengthOf 等判空） */
export function objVal(a: ArgVal | undefined, key: string): ArgVal | undefined {
  if (a === undefined || a.t !== 'obj') return undefined
  return a.v[key]
}

/** 数组字面量 raw（'[1, 2, 3]'）的元素个数：顶层逗号数 + 1；非数组字面量返回 null */
export function arrayLiteralCount(raw: string): number | null {
  const t = raw.trim()
  if (!t.startsWith('[') || !t.endsWith(']')) return null
  const inner = t.slice(1, -1).trim()
  if (inner === '') return 0
  let depth = 0
  let count = 1
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (c === '[' || c === '{' || c === '(') depth++
    else if (c === ']' || c === '}' || c === ')') depth--
    else if (c === ',' && depth === 0) count++
  }
  return count
}
