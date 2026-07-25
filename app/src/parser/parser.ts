import { tokenize, Tok } from './tokenizer'
import { ArgVal, IRFile, IRMember, IRNode, IRState } from '../ir/types'

/**
 * 自研递归下降解析器：.ets → IR（外科手术式编辑）
 *
 * 核心原则：**build() 结构化可编辑，其余一切原文保留**。
 * - struct 之前（import/interface/注释）→ preamble 原样保留
 * - struct 之后（其它 struct/自定义组件）→ postamble 原样保留
 * - 成员：@State 等装饰器状态 → 结构化；方法/@Builder/字段 → raw 原文（含注释与格式）
 * - build() 内：
 *   - `if (cond) { ... }`        → { type: 'If',   ctorArgs: [raw(cond 含括号)], children: if 体 }
 *   - `else { ... }` / else if   → { type: 'Else', children }（紧跟 If 的兄弟节点）
 *   - `ForEach(items, (it) => { ... }, keyGen?)`
 *                              → { type: 'ForEach', ctorArgs: [数据源, raw(参数), keyGen?], children: 模板体 }
 *   - `this.xxx(...)` 等表达式语句 → { type: 'Expr', ctorArgs: [raw(原文)] }
 *   - 注释行                    → { type: 'Comment', ctorArgs: [raw(原文)] }
 *   - 复杂表达式（拼接/三元/箭头/数组/$r()/模板串）→ { t: 'raw' } 原样保留
 *   - 无法识别的构造            → { type: 'Unknown', unsupported: true, ctorArgs: [raw] }
 */

// 表达式继续符：primary 之后遇到这些符号，说明是复合表达式，整体按 raw 保留
const TAIL_OPS = new Set(['+', '-', '*', '/', '%', '?', ':', '&&', '||', '??', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '='])
/** 结构性节点（不参与根组件判定） */
const NON_STRUCTURAL = new Set(['Comment', 'Expr'])

export class Parser {
  private toks: Tok[]
  private p = 0
  constructor(private src: string) { this.toks = tokenize(src) }

  private peek() { return this.toks[this.p] }
  private next() { return this.toks[this.p++] }
  private prevEnd() { return this.toks[this.p - 1].end }
  private at(text: string) { const t = this.peek(); return t.kind === 'punct' && t.text === text }
  private atId(text: string) { const t = this.peek(); return t.kind === 'id' && t.text === text }
  private eat(text: string) {
    if (!this.at(text)) throw new Error(`期望 '${text}'，但在位置 ${this.peek().pos} 遇到 '${this.peek().text}'`)
    this.p++
  }
  private expectId(text?: string): string {
    const t = this.peek()
    if (t.kind !== 'id' || (text && t.text !== text))
      throw new Error(`期望标识符 ${text || ''}，但在位置 ${t.pos} 遇到 '${t.text}'`)
    this.p++; return t.text
  }

  // ---------- raw 原文重建 ----------

  private rawOf(t: Tok): string {
    if (t.kind === 'str') return `'${t.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    return t.text
  }

  /** 用 token 间的原始空白重建文本：源里怎么写就怎么输出（Array<string> 紧、&& 紧、a < b 松） */
  private rawSlice(a: number, b: number): string {
    if (a >= b) return ''
    let out = this.rawOf(this.toks[a])
    for (let i = a + 1; i < b; i++) {
      const gap = this.src.slice(this.toks[i - 1].end, this.toks[i].pos)
      out += gap.includes('\n') ? ' ' : gap
      out += this.rawOf(this.toks[i])
    }
    return out
  }

  /** 配平捕获 [open ... close]，返回含两侧括号的原文 */
  private captureBalanced(open: string, close: string): string {
    const start = this.p
    this.next()
    let depth = 1
    while (depth > 0 && this.peek().kind !== 'eof') {
      const t = this.next()
      if (t.kind === 'punct' && t.text === open) depth++
      else if (t.kind === 'punct' && t.text === close) depth--
    }
    return this.rawSlice(start, this.p)
  }

  /** 从 start 捕获到表达式结束（深度 0 的 , ) ] } 之前），返回重建文本 */
  private captureExprRaw(start: number): string {
    let depth = 0
    while (this.peek().kind !== 'eof') {
      const t = this.peek()
      if (t.kind === 'punct') {
        if (t.text === '(' || t.text === '[' || t.text === '{') depth++
        else if (t.text === ')' || t.text === ']' || t.text === '}') {
          if (depth === 0) break
          depth--
        } else if (t.text === ',' && depth === 0) break
      }
      this.next()
    }
    return this.rawSlice(start, this.p)
  }

  /** 语句捕获（this.xxx() 等）：吃到深度 0 的 ; 或跨行边界，返回精确源码切片 */
  private captureStatement(): string {
    const startPos = this.peek().pos
    let depth = 0
    while (this.peek().kind !== 'eof') {
      const t = this.peek()
      if (t.kind === 'punct') {
        if (depth === 0 && t.text === ';') { this.next(); break }
        if (depth === 0 && t.text === '}') break
        if (t.text === '(' || t.text === '[' || t.text === '{') depth++
        else if (t.text === ')' || t.text === ']' || t.text === '}') { if (depth === 0) break; depth-- }
      }
      this.next()
      if (depth === 0 && this.src.slice(this.prevEnd(), this.peek().pos).includes('\n')) break
    }
    return this.src.slice(startPos, this.prevEnd()).trim()
  }

  // ---------- 文件级 ----------

  parseFile(): IRFile {
    // 前言：跳过 import/interface 等，原文保留（含注释与格式）
    while (!this.at('@') && !this.atId('struct') && this.peek().kind !== 'eof') this.next()
    const preamble = this.src.slice(0, this.peek().pos)
    // struct 装饰器原文
    const decStart = this.peek().pos
    while (this.at('@')) { this.next(); this.expectId(); if (this.at('(')) this.captureBalanced('(', ')') }
    const structDecorators = this.src.slice(decStart, this.peek().pos).trim()
    this.expectId('struct')
    const structName = this.expectId()
    this.eat('{')
    const members: IRMember[] = []
    let buildItems: IRNode[] = []
    while (!this.at('}') && this.peek().kind !== 'eof') {
      if (this.atId('build') && this.toks[this.p + 1]?.text === '(') {
        this.next()
        this.eat('('); this.eat(')')
        this.eat('{')
        buildItems = this.parseChildren()
        this.eat('}')
        members.push({ kind: 'build' })
        continue
      }
      const memberStart = this.p
      const startPos = this.peek().pos
      // @Builder 方法：签名原文保留 + 方法体 UI 结构化（失败则回退 raw 原文块）
      if (this.at('@') && this.toks[this.p + 1]?.text === 'Builder') {
        const b = this.tryParseBuilder(startPos)
        if (b) { members.push(b); continue }
        this.p = memberStart
      }
      try {
        const st = this.tryParseState()
        if (st) { members.push({ kind: 'state', state: st }); continue }
      } catch { /* 非状态声明 → 走原文保留 */ }
      this.p = memberStart
      members.push({ kind: 'raw', text: this.captureMemberRaw(startPos) })
    }
    this.eat('}')
    const postamble = this.src.slice(this.prevEnd())
    // 根组件 = build 体内唯一非注释/表达式节点；其余保持相对位置输出
    const structural = buildItems.filter(i => !NON_STRUCTURAL.has(i.type))
    if (structural.length !== 1) throw new Error(`build() 必须有且仅有一个根组件，实际 ${structural.length} 个`)
    const root = structural[0]
    const ri = buildItems.indexOf(root)
    const rootExtrasPre = buildItems.slice(0, ri)
    const rootExtrasPost = buildItems.slice(ri + 1)
    // 调用点镜像：build 内的 this.<builder>() → BuilderCall 节点（children 与定义共享引用）
    const builderMap = new Map<string, IRNode[]>()
    for (const m of members) if (m.kind === 'builder') builderMap.set(m.name, m.children)
    const linkMirrors = (nodes: IRNode[]) => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.type === 'Expr') {
          const raw = n.ctorArgs[0]
          const m = raw && raw.t === 'raw' ? raw.v.match(/^\s*this\.(\w+)\s*\(\s*\)\s*;?\s*$/) : null
          // 每个 builder 只镜像第一个调用点（多调用点编辑会产生歧义，其余保留 Expr）
          if (m && builderMap.has(m[1])) {
            nodes[i] = {
              type: 'BuilderCall',
              ctorArgs: [n.ctorArgs[0], { t: 'raw', v: m[1] }],
              children: builderMap.get(m[1])!,
              modifiers: [],
            }
            builderMap.delete(m[1])
            continue
          }
        }
        linkMirrors(n.children)
      }
    }
    linkMirrors([root, ...rootExtrasPre, ...rootExtrasPost])
    return {
      structName, preamble, postamble, structDecorators, members,
      states: members.filter((m): m is { kind: 'state'; state: IRState } => m.kind === 'state').map(m => m.state),
      root,
      rootExtrasPre,
      rootExtrasPost,
    }
  }

  /** @Builder 方法：签名原文保留，方法体按 UI 结构化（非单根 UI 或解析失败返回 null → 走 raw） */
  private tryParseBuilder(startPos: number): IRMember | null {
    const start = this.p
    try {
      this.next() // '@'
      this.expectId('Builder')
      const name = this.expectId()
      this.captureBalanced('(', ')') // 参数表（可为空或带参）
      const signature = this.src.slice(startPos, this.prevEnd()).trim()
      this.eat('{')
      const children = this.parseChildren()
      this.eat('}')
      const structural = children.filter(c => !NON_STRUCTURAL.has(c.type))
      if (structural.length !== 1) { this.p = start; return null }
      return { kind: 'builder', name, signature, children }
    } catch {
      this.p = start
      return null
    }
  }

  /** 装饰器状态声明（@State/@Prop/@StorageLink 等）：name: type = init */
  private tryParseState(): IRState | null {
    const decStart = this.peek().pos
    let hasDecorator = false
    while (this.at('@')) {
      hasDecorator = true
      this.next()
      this.expectId()
      if (this.at('(')) this.captureBalanced('(', ')')
    }
    if (!hasDecorator) return null
    const decorator = this.src.slice(decStart, this.peek().pos).trim()
    const name = this.expectId()
    this.eat(':')
    let type = this.expectId()
    if (this.at('<')) type += this.captureBalanced('<', '>')
    while (this.at('[')) { this.next(); this.eat(']'); type += '[]' }
    this.eat('=')
    const init = this.parseArgVal()
    if (this.at(';')) this.next()
    return { name, type, init, decorator }
  }

  /** 非状态成员（方法/@Builder/字段）原文整段保留 */
  private captureMemberRaw(startPos: number): string {
    // 装饰器
    while (this.at('@')) { this.next(); this.expectId(); if (this.at('(')) this.captureBalanced('(', ')') }
    // 修饰符（private/public/static/async/readonly/protected）
    while (this.peek().kind === 'id' && this.toks[this.p + 1]?.kind === 'id') this.next()
    if (this.peek().kind === 'id' && this.toks[this.p + 1]?.text === '(') {
      // 方法：名(参数) 返回类型? { 函数体 }
      this.next()
      this.captureBalanced('(', ')')
      if (this.at(':')) { this.next(); this.skipTypeTokens() }
      if (this.at('{')) this.captureBalanced('{', '}')
    } else {
      // 字段/其它：吃到深度 0 的分号或跨行边界
      let depth = 0
      while (this.peek().kind !== 'eof') {
        const t = this.peek()
        if (t.kind === 'punct') {
          if (depth === 0 && t.text === ';') { this.next(); break }
          if (depth === 0 && t.text === '}') break
          if (t.text === '(' || t.text === '[' || t.text === '{') depth++
          else if (t.text === ')' || t.text === ']' || t.text === '}') { if (depth === 0) break; depth-- }
        }
        this.next()
        if (depth === 0 && this.src.slice(this.prevEnd(), this.peek().pos).includes('\n')) break
      }
    }
    return this.src.slice(startPos, this.prevEnd())
  }

  /** 跳过方法返回类型标注（含泛型/联合/数组/动态 import 类型），到 { 前为止 */
  private skipTypeTokens() {
    let depth = 0
    while (this.peek().kind !== 'eof') {
      const t = this.peek()
      if (t.kind === 'punct') {
        if (t.text === '<' || t.text === '[') depth++
        else if (t.text === '>' || t.text === ']') depth--
        else if (t.text === '{' && depth <= 0) break
      }
      this.next()
    }
  }

  // ---------- 组件级 ----------

  /** 解析 children 序列（build 体或组件花括号体），读到 '}' 前为止（不消费 '}'） */
  private parseChildren(): IRNode[] {
    const out: IRNode[] = []
    while (!this.at('}') && this.peek().kind !== 'eof') {
      if (this.peek().kind === 'comment') {
        const t = this.next()
        out.push({ type: 'Comment', ctorArgs: [{ t: 'raw', v: t.text }], children: [], modifiers: [] })
        continue
      }
      try {
        out.push(...this.parseChildNodes())
      } catch (e: any) {
        out.push(this.recoverUnknown(String(e?.message || e)))
      }
    }
    return out
  }

  private parseChildNodes(): IRNode[] {
    if (this.atId('if')) return this.parseIf()
    // this.xxx(...) 表达式语句（如 this.buildHeader()）→ Expr 原文节点
    if (this.atId('this') && this.toks[this.p + 1]?.text === '.') {
      return [{ type: 'Expr', ctorArgs: [{ t: 'raw', v: this.captureStatement() }], children: [], modifiers: [] }]
    }
    return [this.parseComponent()]
  }

  private parseIf(): IRNode[] {
    this.expectId('if')
    const cond = this.captureBalanced('(', ')')
    this.eat('{')
    const children = this.parseChildren()
    this.eat('}')
    const ifNode: IRNode = { type: 'If', ctorArgs: [{ t: 'raw', v: cond }], children, modifiers: [] }
    const nodes: IRNode[] = [ifNode]
    if (this.atId('else')) {
      this.next()
      let elseChildren: IRNode[]
      if (this.atId('if')) elseChildren = this.parseIf() // else if 链
      else {
        this.eat('{')
        elseChildren = this.parseChildren()
        this.eat('}')
      }
      nodes.push({ type: 'Else', ctorArgs: [], children: elseChildren, modifiers: [] })
    }
    return nodes
  }

  private parseComponent(): IRNode {
    const type = this.expectId()
    if (type === 'ForEach') return this.parseForEach()
    const node: IRNode = { type, ctorArgs: [], children: [], modifiers: [] }
    if (this.at('(')) node.ctorArgs = this.parseArgList()
    if (this.at('{')) {
      this.eat('{')
      node.children = this.parseChildren()
      this.eat('}')
    }
    this.parseModifierChain(node)
    return node
  }

  private parseForEach(): IRNode {
    this.eat('(')
    const items = this.parseArgVal()
    this.eat(',')
    // 条目生成箭头：(item: string) => { UI 模板 }
    const pstart = this.p
    let paramsRaw = '(item)'
    if (this.at('(')) {
      this.captureBalanced('(', ')')
      paramsRaw = this.rawSlice(pstart, this.p)
    }
    if (this.at('=>')) this.next()
    this.eat('{')
    const children = this.parseChildren()
    this.eat('}')
    const ctorArgs: ArgVal[] = [items, { t: 'raw', v: paramsRaw }]
    if (this.at(',')) {
      this.next()
      ctorArgs.push(this.parseArgVal()) // keyGenerator 箭头 → raw
    }
    this.eat(')')
    return { type: 'ForEach', ctorArgs, children, modifiers: [] }
  }

  private parseModifierChain(node: IRNode) {
    while (this.at('.')) {
      this.eat('.')
      const mname = this.expectId()
      const args = this.at('(') ? this.parseArgList() : []
      node.modifiers.push({ name: mname, args })
    }
  }

  // ---------- 参数值 ----------

  private parseArgList(): ArgVal[] {
    this.eat('(')
    const args: ArgVal[] = []
    if (!this.at(')')) {
      args.push(this.parseArgVal())
      while (this.at(',')) { this.next(); if (this.at(')')) break; args.push(this.parseArgVal()) }
    }
    this.eat(')')
    return args
  }

  private parseArgVal(): ArgVal {
    const start = this.p
    const t = this.peek()

    // 注释：跳过（表达式内注释不保留，成员/children 级注释才有节点）
    if (t.kind === 'comment') { this.next(); return this.parseArgVal() }
    // 模板字符串：整体 raw；若后接运算符则连同尾部一起 raw
    if (t.kind === 'tpl') {
      this.next()
      if (this.atTailOp()) return { t: 'raw', v: this.captureExprRaw(start) }
      return { t: 'raw', v: t.text }
    }
    // 数组字面量 / 括号表达式 / 箭头函数
    if (t.kind === 'punct') {
      if (t.text === '[') return { t: 'raw', v: this.captureBalanced('[', ']') }
      if (t.text === '(') {
        this.captureBalanced('(', ')')
        if (this.at('=>')) {
          // 箭头函数：参数 + => + 函数体（{} 块或表达式）
          this.next()
          if (this.at('{')) this.captureBalanced('{', '}')
          else this.captureExprRaw(this.p)
          return { t: 'raw', v: this.rawSlice(start, this.p) }
        }
        if (this.atTailOp()) return { t: 'raw', v: this.captureExprRaw(start) }
        return { t: 'raw', v: this.rawSlice(start, this.p) }
      }
      if (t.text === '{') return this.parseObj()
      // 一元表达式（-1 / !x 等）：整体 raw
      return { t: 'raw', v: this.captureExprRaw(start) }
    }
    if (t.kind === 'str') { this.next(); return this.finishPrimary(start, { t: 'str', v: t.text }) }
    if (t.kind === 'hex') { this.next(); return this.finishPrimary(start, { t: 'hex', v: parseInt(t.text.slice(2), 16) }) }
    if (t.kind === 'num') { this.next(); return this.finishPrimary(start, { t: 'num', v: parseFloat(t.text) }) }
    if (t.kind === 'id') {
      if (t.text === 'true' || t.text === 'false') { this.next(); return this.finishPrimary(start, { t: 'bool', v: t.text === 'true' }) }
      let path = this.expectId()
      while (this.at('.')) { this.next(); path += '.' + this.expectId() }
      // 函数调用（$r('app.media.x') / 任意 fn(...)）：连同调用与可能的尾部整体 raw
      if (this.at('(')) {
        this.captureBalanced('(', ')')
        if (this.at('=>')) { this.next(); if (this.at('{')) this.captureBalanced('{', '}'); else this.captureExprRaw(this.p) }
        if (this.atTailOp()) return { t: 'raw', v: this.captureExprRaw(start) }
        return { t: 'raw', v: this.rawSlice(start, this.p) }
      }
      if (this.atTailOp()) return { t: 'raw', v: this.captureExprRaw(start) }
      return { t: 'enum', v: path }
    }
    throw new Error(`无法解析参数，在位置 ${t.pos} 遇到 '${t.text}'`)
  }

  private atTailOp(): boolean {
    const t = this.peek()
    return t.kind === 'punct' && TAIL_OPS.has(t.text)
  }

  /** primary 之后若跟运算符，则把整段表达式改按 raw 保留 */
  private finishPrimary(start: number, prim: ArgVal): ArgVal {
    if (this.atTailOp()) return { t: 'raw', v: this.captureExprRaw(start) }
    return prim
  }

  private parseObj(): ArgVal {
    this.eat('{')
    const v: Record<string, ArgVal> = {}
    if (!this.at('}')) {
      while (true) {
        const keyTok = this.peek()
        const key = keyTok.kind === 'str' ? (this.next(), keyTok.text) : this.expectId()
        this.eat(':')
        v[key] = this.parseArgVal()
        if (this.at(',')) { this.next(); if (this.at('}')) break; continue }
        break
      }
    }
    this.eat('}')
    return { t: 'obj', v }
  }

  // ---------- 错误恢复 ----------

  /** 子节点解析失败：吞掉无法识别的原文，生成占位节点，保证不崩不丢（ADR-008） */
  private recoverUnknown(errMsg: string): IRNode {
    const start = this.p
    let depth = 0
    while (this.peek().kind !== 'eof') {
      const t = this.peek()
      if (t.kind === 'punct') {
        if (depth === 0) {
          // 到达上级边界（}, ), ]）：交由上级处理；若一个 token 都没吞则消费一个防死循环
          if (t.text === '}' || t.text === ')' || t.text === ']') {
            if (this.p === start) this.next()
            break
          }
          // 吞掉残留的修饰符链 .name(...)
          if (t.text === '.') {
            this.next()
            if (this.peek().kind === 'id') this.next()
            if (this.at('(')) this.captureBalanced('(', ')')
            continue
          }
        }
        if (t.text === '{' || t.text === '(' || t.text === '[') depth++
        else if (t.text === '}' || t.text === ')' || t.text === ']') depth--
        this.next()
        continue
      }
      // 疑似新组件开始（id 后接 ( 或 {）：交给上级重新解析
      if (t.kind === 'id' && depth === 0 && this.p > start) {
        const nxt = this.toks[this.p + 1]
        if (nxt && nxt.kind === 'punct' && (nxt.text === '(' || nxt.text === '{')) break
      }
      this.next()
    }
    if (this.p === start) this.next() // 防死循环
    return {
      type: 'Unknown', unsupported: true,
      ctorArgs: [{ t: 'raw', v: `/* 解析失败: ${errMsg} */ ${this.rawSlice(start, this.p)}` }],
      children: [], modifiers: [],
    }
  }
}

export function parse(src: string): IRFile {
  return new Parser(src).parseFile()
}
