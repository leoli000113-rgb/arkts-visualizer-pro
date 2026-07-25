import React from 'react'
import { ArgVal, IRNode, IRState } from '../ir/types'
import { ViewProps, frameOf, keyOf, ifCollapsed, findState } from './shared'

/**
 * 结构/流程组件组：If / Else / ForEach。
 * - If：条件折叠时渲染一行占位徽标，否则渲染 children + 「if」角标
 * - Else：由 shared.visibleChildren 配对决定是否渲染，渲染时加 「else」角标
 * - ForEach：数据源可求值时按条目渲染模板并做简单变量替换；不可求值时模板 ×3 + 角标
 * 求值均为小心的小解析（顶层逗号/加号拆分），禁 eval。
 */

// ---------- 顶层拆分与小解析 ----------

/** 按单字符分隔符做顶层拆分：忽略引号内与括号嵌套内的分隔符 */
export function splitTop(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ''
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      cur += ch
      if (ch === '\\' && i + 1 < s.length) { cur += s[++i]; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

/** 数组字面量原文 → 条目列表；含不可解析部分时返回 null（不强行求值） */
export function parseArrayLiteral(raw: string): (string | number)[] | null {
  const t = raw.trim()
  if (!t.startsWith('[') || !t.endsWith(']')) return null
  const inner = t.slice(1, -1).trim()
  if (!inner) return []
  const out: (string | number)[] = []
  for (const p0 of splitTop(inner, ',')) {
    const p = p0.trim()
    const m = p.match(/^'([^']*)'$/) ?? p.match(/^"([^"]*)"$/)
    if (m) { out.push(m[1]); continue }
    if (/^-?\d+(\.\d+)?$/.test(p)) { out.push(parseFloat(p)); continue }
    return null
  }
  return out
}

/** ForEach 数据源求值：raw 数组字面量，或 enum this.xxx 且 @State init 为 raw 数组字面量 */
export function forEachItems(node: IRNode, states: IRState[]): (string | number)[] | null {
  const src = node.ctorArgs[0]
  if (!src) return null
  if (src.t === 'raw') return parseArrayLiteral(src.v)
  if (src.t === 'enum') {
    const m = src.v.match(/^this\.(\w+)$/)
    if (!m) return null
    const st = findState(states, m[1])
    if (st && st.init.t === 'raw') return parseArrayLiteral(st.init.v)
  }
  return null
}

/** 从 '(item: string)' 形态的参数原文提取循环变量名 */
export function forEachVar(node: IRNode): string {
  const p = node.ctorArgs[1]
  if (p && p.t === 'raw') {
    const m = p.v.match(/\(\s*([A-Za-z_$][\w$]*)/)
    if (m) return m[1]
  }
  return 'item'
}

/** raw 形如 '前缀' + i（或 i + '后缀'、多段拼接）时做拼接替换，否则返回 null */
function evalConcat(raw: string, varName: string, item: string | number): ArgVal | null {
  const parts = splitTop(raw, '+')
  if (parts.length < 2) return null
  let out = ''
  for (const p0 of parts) {
    const p = p0.trim()
    if (p === varName) { out += String(item); continue }
    const m = p.match(/^'([^']*)'$/) ?? p.match(/^"([^"]*)"$/)
    if (m) { out += m[1]; continue }
    return null
  }
  return { t: 'str', v: out }
}

function substArg(a: ArgVal, varName: string, item: string | number): ArgVal {
  if (a.t === 'enum' && a.v === varName) {
    return typeof item === 'number' ? { t: 'num', v: item } : { t: 'str', v: item }
  }
  if (a.t === 'raw') return evalConcat(a.v, varName, item) ?? a
  if (a.t === 'obj') {
    const v: Record<string, ArgVal> = {}
    for (const k of Object.keys(a.v)) v[k] = substArg(a.v[k], varName, item)
    return { t: 'obj', v }
  }
  return a
}

/** 深拷贝模板子树并替换 ctor 参数中的循环变量引用（修饰符不动） */
export function substTemplate(n: IRNode, varName: string, item: string | number): IRNode {
  return {
    ...n,
    ctorArgs: n.ctorArgs.map(a => substArg(a, varName, item)),
    children: n.children.map(c => substTemplate(c, varName, item)),
  }
}

// ---------- 视图 ----------

export function IfView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const cond = node.ctorArgs[0]
  const condText = cond && cond.t === 'raw' ? cond.v : ''
  if (ifCollapsed(node, ctx.states)) {
    // 条件不成立：辅助标记关闭时完全隐藏（页面即所得），开启时显示折叠占位
    if (!ctx.aids) return null
    return (
      <div {...f.common} className="ir-if-collapsed" style={f.style}>
        if {condText} — 当前不渲染
        {f.indicator}
        {f.handles}
      </div>
    )
  }
  return (
    <div {...f.common} style={{ position: 'relative', ...f.style }}>
      {ctx.aids && <span className="ir-badge">if</span>}
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

export function ElseView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  return (
    <div {...f.common} style={{ position: 'relative', ...f.style }}>
      {ctx.aids && <span className="ir-badge">else</span>}
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

export function ForEachView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const items = forEachItems(node, ctx.states)
  const varName = forEachVar(node)
  // 模板路径：单模板的 ForEach 指到模板自身，让选中/编辑都落到模板上
  const templatePath = node.children.length === 1 ? [...path, 0] : path
  if (!items) {
    // 数据源不可求值：模板 ×3 + 角标（角标仅辅助标记开启时显示）
    return (
      <div {...f.common} style={{ position: 'relative', ...f.style }}>
        {ctx.aids && <span className="ir-badge">ForEach</span>}
        {[0, 1, 2].map(n => (
          <div key={n} data-path={keyOf(templatePath)} style={{ display: 'contents' }}>
            {node.children.map((t, ti) => ctx.render(t, [...path, ti]))}
          </div>
        ))}
        {f.indicator}
        {f.handles}
      </div>
    )
  }
  return (
    <>
      {items.map((item, n) => (
        <div key={n} data-path={keyOf(templatePath)} style={{ display: 'contents' }}>
          {node.children.map((t, ti) => ctx.render(substTemplate(t, varName, item), [...path, ti]))}
        </div>
      ))}
    </>
  )
}
