import React from 'react'
import { ArgVal, IRNode, IRState } from '../ir/types'
import {
  ViewProps, frameOf, ifCollapsed, findState, splitTop, parseArrayLiteral, ForEachItem,
} from './shared'

/**
 * 结构/流程组件组：If / Else / ForEach。
 * - If：条件折叠时渲染一行占位徽标，否则渲染 children + 「if」角标
 * - Else：由 shared.visibleChildren 配对决定是否渲染，渲染时加 「else」角标
 * - ForEach：数据源可求值时按条目渲染模板并做变量替换（原始值/对象数组 + item.member）；
 *   不可求值时模板 ×3 + 角标
 * 求值均为小心的小解析（splitTop/parseArrayLiteral 在 shared），禁 eval。
 */

/** ForEach 数据源求值：raw 数组字面量，或 enum this.xxx 且 @State init 为 raw 数组字面量 */
export function forEachItems(node: IRNode, states: IRState[]): ForEachItem[] | null {
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

/** 从 '(item: string)' / '(item, index)' 形态的参数原文提取循环变量名 */
export function forEachVars(node: IRNode): { item: string; index?: string } {
  const p = node.ctorArgs[1]
  if (p && p.t === 'raw') {
    const m = p.v.match(/\(\s*([A-Za-z_$][\w$]*)\s*(?::[^,)]+)?(?:,\s*([A-Za-z_$][\w$]*))?/)
    if (m) return { item: m[1], index: m[2] }
  }
  return { item: 'item' }
}

/** 对象数据项的字段值 */
function memberOf(item: ForEachItem, key: string): ArgVal | undefined {
  return typeof item === 'object' && item !== null ? item[key] : undefined
}

/** raw 形如 '前缀' + i（或 item.field 拼接、index 拼接、多段拼接）时做拼接替换，否则返回 null */
function evalConcat(raw: string, varName: string, item: ForEachItem, indexName: string | undefined, index: number | undefined): ArgVal | null {
  const parts = splitTop(raw, '+')
  if (parts.length < 2) return null
  let out = ''
  for (const p0 of parts) {
    const p = p0.trim()
    if (p === varName) {
      if (typeof item === 'object') return null
      out += String(item)
      continue
    }
    if (indexName && p === indexName && index !== undefined) {
      out += String(index)
      continue
    }
    const mm = p.match(new RegExp('^' + varName + '\\.(\\w+)$'))
    if (mm) {
      const f = memberOf(item, mm[1])
      if (!f) return null
      if (f.t === 'str') { out += f.v; continue }
      if (f.t === 'num') { out += String(f.v); continue }
      return null
    }
    const m = p.match(/^'([^']*)'$/) ?? p.match(/^"([^"]*)"$/)
    if (m) { out += m[1]; continue }
    return null
  }
  return { t: 'str', v: out }
}

/** 通用 raw 文本替换：item.field / 原始值 item / index 变量 → 字面量文本（供渲染期求值） */
function substRawText(raw: string, varName: string, item: ForEachItem, indexName: string | undefined, index: number | undefined): string {
  let out = raw
  if (indexName && index !== undefined) {
    out = out.replace(new RegExp('\\b' + indexName + '\\b', 'g'), String(index))
  }
  out = out.replace(new RegExp('\\b' + varName + '\\.(\\w+)', 'g'), (whole, k) => {
    const f = memberOf(item, k)
    if (!f) return whole
    if (f.t === 'str') return `'${f.v.replace(/'/g, "\\'")}'`
    if (f.t === 'num' || f.t === 'bool') return String(f.v)
    if (f.t === 'raw' || f.t === 'enum') return f.v
    return whole
  })
  if (typeof item !== 'object') {
    out = out.replace(new RegExp('\\b' + varName + '\\b', 'g'),
      typeof item === 'number' ? String(item) : `'${String(item).replace(/'/g, "\\'")}'`)
  }
  return out
}

function substArg(a: ArgVal, varName: string, item: ForEachItem, indexName: string | undefined, index: number | undefined): ArgVal {
  if (a.t === 'enum' && a.v === varName) {
    if (typeof item === 'number') return { t: 'num', v: item }
    if (typeof item === 'string') return { t: 'str', v: item }
    return a // 对象整体不可直接渲染，保留原样
  }
  if (indexName && index !== undefined && a.t === 'enum' && a.v === indexName) {
    return { t: 'num', v: index }
  }
  // 成员访问：item.foo 单独出现 → 字段值直接替换
  if (a.t === 'enum' || a.t === 'raw') {
    const mm = a.v.match(new RegExp('^' + varName + '\\.(\\w+)$'))
    if (mm) {
      const f = memberOf(item, mm[1])
      if (f) return f
    }
  }
  if (a.t === 'raw') {
    const concat = evalConcat(a.v, varName, item, indexName, index)
    if (concat) return concat
    const replaced = substRawText(a.v, varName, item, indexName, index)
    return replaced !== a.v ? { t: 'raw', v: replaced } : a
  }
  if (a.t === 'obj') {
    const v: Record<string, ArgVal> = {}
    for (const k of Object.keys(a.v)) v[k] = substArg(a.v[k], varName, item, indexName, index)
    return { t: 'obj', v }
  }
  return a
}

/** 深拷贝模板子树并替换 ctor 参数中的循环变量引用（修饰符不动；仅渲染期使用，不影响序列化） */
export function substTemplate(n: IRNode, varName: string, item: ForEachItem, indexName?: string, index?: number): IRNode {
  return {
    ...n,
    ctorArgs: n.ctorArgs.map(a => substArg(a, varName, item, indexName, index)),
    children: n.children.map(c => substTemplate(c, varName, item, indexName, index)),
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
  const { item: varName, index: indexName } = forEachVars(node)
  if (!items) {
    // 数据源不可求值：模板 ×3 + 角标（角标仅辅助标记开启时显示）
    return (
      <div {...f.common} style={{ position: 'relative', ...f.style }}>
        {ctx.aids && <span className="ir-badge">ForEach</span>}
        {[0, 1, 2].map(n => (
          <div key={n} style={{ display: 'contents' }}>
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
        <div key={n} style={{ display: 'contents' }}>
          {node.children.map((t, ti) => ctx.render(substTemplate(t, varName, item, indexName, n), [...path, ti]))}
        </div>
      ))}
    </>
  )
}
