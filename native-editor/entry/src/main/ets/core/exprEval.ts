/**
 * 表达式求值器（纯逻辑，可单测）：把 IR 里的 raw 表达式在「状态作用域」中求值。
 * 支撑渲染器对 If 条件 / ForEach 数据源 / 模板字符串 / this.xxx 文本的真实求值。
 *
 * 支持子集（刻意小而稳，遇不支持直接抛错 → 上层回退占位）：
 * - 字面量：数字 / 字符串 / hex / true / false / null / undefined / 数组 [a, b]
 * - 变量：this.xxx（状态）、ForEach 条目变量、链式 .prop / [i]
 * - 运算：一元 - ! +；* / %；+ -；< <= > >=；== != === !==；&& || ??；三元 ?:
 * - 成员：.length（字符串/数组）；调用：String(x) / Number(x) / arr.toString()
 * - 模板字符串：`a ${expr} b`（含嵌套表达式）
 */

import { tokenize, Tok } from './tokenizer'
import { IRState } from './ir'

export type V = number | string | boolean | null | V[]

export function jsTruthy(v: V): boolean {
  if (v === null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== ''
  return true // 数组恒真（JS 语义）
}

export function vToStr(v: V): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return v.map(vToStr).join(',')
  return String(v)
}

class ExprParser {
  private toks: Tok[]
  private p: number = 0
  private vars: Map<string, V>

  constructor(src: string, vars: Map<string, V>) {
    this.toks = tokenize(src)
    this.vars = vars
  }

  private peek(): Tok {
    let i = this.p
    while (this.toks[i].kind === 'comment') i++
    return this.toks[i]
  }
  private next(): Tok {
    while (this.toks[this.p].kind === 'comment') this.p++
    return this.toks[this.p++]
  }
  private at(text: string): boolean { const t = this.peek(); return t.kind === 'punct' && t.text === text }
  private atId(text: string): boolean { const t = this.peek(); return t.kind === 'id' && t.text === text }
  /**
   * 多字符运算符判断：tokenizer 只合并 '=>'，== / === / && / || / <= 等都是相邻单字符 punct，
   * 这里逐字符向前看（跳过注释）。调用方需按从长到短顺序尝试（'===' 先于 '=='）。
   */
  private atOp(op: string): boolean {
    let i = this.p
    for (let k = 0; k < op.length; k++) {
      while (i < this.toks.length && this.toks[i].kind === 'comment') i++
      if (i >= this.toks.length) return false
      const t = this.toks[i]
      if (t.kind !== 'punct' || t.text !== op[k]) return false
      i++
    }
    return true
  }
  private eatOp(op: string): void {
    for (let k = 0; k < op.length; k++) this.next()
  }
  private eat(text: string): void {
    if (!this.at(text)) throw new Error(`求值: 期望 '${text}' 遇到 '${this.peek().text}'`)
    this.p++
  }

  parse(): V {
    const v = this.ternary()
    if (this.peek().kind !== 'eof') throw new Error(`求值: 表达式有剩余 '${this.peek().text}'`)
    return v
  }

  private ternary(): V {
    const c = this.or()
    if (!this.at('?')) return c
    this.next()
    const a = this.ternary()
    this.eat(':')
    const b = this.ternary()
    return jsTruthy(c) ? a : b
  }

  private or(): V {
    let l = this.and()
    while (this.atOp('||') || this.atOp('??')) {
      const op = this.atOp('||') ? '||' : '??'
      this.eatOp(op)
      const r = this.and()
      l = op === '||' ? (jsTruthy(l) ? l : r) : (l === null ? r : l)
    }
    return l
  }

  private and(): V {
    let l = this.equality()
    while (this.atOp('&&')) {
      this.eatOp('&&')
      const r = this.equality()
      l = jsTruthy(l) ? r : l
    }
    return l
  }

  private equality(): V {
    let l = this.relational()
    for (;;) {
      if (this.atOp('===')) { this.eatOp('==='); l = this.strictEq(l, this.relational()) }
      else if (this.atOp('!==')) { this.eatOp('!=='); l = !this.strictEq(l, this.relational()) }
      else if (this.atOp('==')) { this.eatOp('=='); l = this.looseEq(l, this.relational()) }
      else if (this.atOp('!=')) { this.eatOp('!='); l = !this.looseEq(l, this.relational()) }
      else return l
    }
  }

  private strictEq(a: V, b: V): boolean {
    if (Array.isArray(a) || Array.isArray(b)) return a === b
    return a === b
  }
  private looseEq(a: V, b: V): boolean {
    // ArkTS 不允许 ==，手动实现宽松相等：null 互等；类型不同先数值化再字符串化比较
    if (a === null || b === null) return a === null && b === null
    if (Array.isArray(a) || Array.isArray(b)) return false
    if (typeof a === typeof b) return a === b
    return this.toNum(a) === this.toNum(b) || vToStr(a) === vToStr(b)
  }

  private relational(): V {
    let l = this.additive()
    for (;;) {
      if (this.atOp('<=')) { this.eatOp('<='); l = this.cmp(l, this.additive()) <= 0 }
      else if (this.atOp('>=')) { this.eatOp('>='); l = this.cmp(l, this.additive()) >= 0 }
      else if (this.at('<')) { this.next(); l = this.cmp(l, this.additive()) < 0 }
      else if (this.at('>')) { this.next(); l = this.cmp(l, this.additive()) > 0 }
      else return l
    }
  }
  private cmp(a: V, b: V): number {
    const x = typeof a === 'string' && typeof b !== 'number' ? a : this.toNum(a)
    const y = typeof a === 'string' && typeof b !== 'number' ? b : this.toNum(b)
    if (typeof x === 'string' && typeof y === 'string') return x < y ? -1 : (x > y ? 1 : 0)
    return (x as number) - (y as number)
  }
  private toNum(v: V): number {
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return v ? 1 : 0
    if (v === null) return 0
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
    return 0
  }

  private additive(): V {
    let l = this.multiplicative()
    for (;;) {
      if (this.at('+')) {
        this.next()
        const r = this.multiplicative()
        l = (typeof l === 'string' || typeof r === 'string') ? vToStr(l) + vToStr(r) : this.toNum(l) + this.toNum(r)
      } else if (this.at('-')) {
        this.next()
        l = this.toNum(l) - this.toNum(this.multiplicative())
      } else return l
    }
  }

  private multiplicative(): V {
    let l = this.unary()
    for (;;) {
      if (this.at('*')) { this.next(); l = this.toNum(l) * this.toNum(this.unary()) }
      else if (this.at('/')) { this.next(); l = this.toNum(l) / this.toNum(this.unary()) }
      else if (this.at('%')) { this.next(); l = this.toNum(l) % this.toNum(this.unary()) }
      else return l
    }
  }

  private unary(): V {
    if (this.at('-')) { this.next(); return -this.toNum(this.unary()) }
    if (this.at('+')) { this.next(); return this.toNum(this.unary()) }
    if (this.at('!')) { this.next(); return !jsTruthy(this.unary()) }
    return this.postfix()
  }

  private postfix(): V {
    let v = this.primary()
    for (;;) {
      if (this.at('.')) {
        this.next()
        const t = this.next()
        if (t.kind !== 'id') throw new Error(`求值: 属性名非法 '${t.text}'`)
        if (this.at('(')) {
          // 方法调用：仅支持 toString()
          this.next(); this.eat(')')
          if (t.text === 'toString') { v = vToStr(v); continue }
          throw new Error(`求值: 不支持方法 .${t.text}()`)
        }
        if (t.text === 'length') {
          if (typeof v === 'string' || Array.isArray(v)) { v = v.length; continue }
          throw new Error('求值: .length 仅支持字符串/数组')
        }
        throw new Error(`求值: 不支持属性 .${t.text}`)
      }
      if (this.at('[')) {
        this.next()
        const idx = this.ternary()
        this.eat(']')
        if (Array.isArray(v) && typeof idx === 'number') { v = v[idx] ?? null; continue }
        if (typeof v === 'string' && typeof idx === 'number') { v = v[idx] ?? null; continue }
        throw new Error('求值: 下标仅支持数组/字符串')
      }
      return v
    }
  }

  private primary(): V {
    const t = this.next()
    if (t.kind === 'num') return parseFloat(t.text)
    if (t.kind === 'hex') return parseInt(t.text.slice(2), 16)
    if (t.kind === 'str') return t.text
    if (t.kind === 'tpl') return this.template(t.text)
    if (t.kind === 'punct') {
      if (t.text === '(') { const v = this.ternary(); this.eat(')'); return v }
      if (t.text === '[') {
        const arr: V[] = []
        if (!this.at(']')) {
          arr.push(this.ternary())
          while (this.at(',')) { this.next(); if (this.at(']')) break; arr.push(this.ternary()) }
        }
        this.eat(']')
        return arr
      }
      throw new Error(`求值: 意外符号 '${t.text}'`)
    }
    if (t.kind === 'id') {
      if (t.text === 'true') return true
      if (t.text === 'false') return false
      if (t.text === 'null' || t.text === 'undefined') return null
      // 全局函数
      if ((t.text === 'String' || t.text === 'Number') && this.at('(')) {
        this.next()
        const arg = this.ternary()
        this.eat(')')
        return t.text === 'String' ? vToStr(arg) : this.toNum(arg)
      }
      // 变量：this.xxx 或 ForEach 条目变量
      let name = t.text
      if (name === 'this') {
        this.eat('.')
        const nt = this.next()
        if (nt.kind !== 'id') throw new Error('求值: this. 后应为标识符')
        name = nt.text
      }
      const v = this.vars.get(name)
      if (v === undefined) throw new Error(`求值: 未定义变量 '${name}'`)
      return v
    }
    throw new Error(`求值: 无法处理 '${t.text}'`)
  }

  /** 模板字符串（含反引号的原文）：逐段扫描 ${...} 插值求值 */
  private template(raw: string): V {
    const inner = raw.slice(1, raw.length - 1)
    let out = ''
    let i = 0
    while (i < inner.length) {
      const c = inner[i]
      if (c === '\\' && i + 1 < inner.length) { out += inner[i + 1]; i += 2; continue }
      if (c === '$' && inner[i + 1] === '{') {
        let depth = 1
        let j = i + 2
        while (j < inner.length && depth > 0) {
          if (inner[j] === '{') depth++
          else if (inner[j] === '}') depth--
          j++
        }
        const expr = inner.slice(i + 2, j - 1)
        out += vToStr(new ExprParser(expr, this.vars).parse())
        i = j
        continue
      }
      out += c
      i++
    }
    return out
  }
}

/** 求值 raw 表达式；失败抛 Error（上层 catch 回退占位） */
export function evalRaw(raw: string, vars: Map<string, V>): V {
  return new ExprParser(raw, vars).parse()
}

/** 不抛错版本：失败返回 undefined */
export function tryEval(raw: string, vars: Map<string, V> | null): V | undefined {
  if (vars === null) return undefined
  try {
    return evalRaw(raw, vars)
  } catch (e) {
    return undefined
  }
}

/** 由 IRFile.states 构建求值作用域（按声明顺序，允许后者引用前者） */
export function buildScope(states: IRState[]): Map<string, V> {
  const vars = new Map<string, V>()
  for (const s of states) {
    const init = s.init
    if (init.t === 'str') vars.set(s.name, init.v)
    else if (init.t === 'num' || init.t === 'hex') vars.set(s.name, init.v)
    else if (init.t === 'bool') vars.set(s.name, init.v)
    else if (init.t === 'enum') vars.set(s.name, init.v)
    else if (init.t === 'raw') {
      const v = tryEval(init.v, vars)
      vars.set(s.name, v === undefined ? null : v)
    } else {
      vars.set(s.name, null) // obj 字面量暂不求值
    }
  }
  return vars
}

/** ForEach 条目参数名提取：'(item: T)' / '(item, index)' / 'item' → [条目名, 下标名?] */
export function forEachParams(paramsRaw: string): [string, string | null] {
  const inner = paramsRaw.trim().replace(/^\(/, '').replace(/\)$/, '')
  const parts = inner.split(',')
  const m1 = parts[0].match(/([A-Za-z_$][A-Za-z0-9_$]*)/)
  if (m1 === null) return ['item', null]
  if (parts.length >= 2) {
    const m2 = parts[1].match(/([A-Za-z_$][A-Za-z0-9_$]*)/)
    return [m1[1], m2 !== null ? m2[1] : null]
  }
  return [m1[1], null]
}
