import { ArgVal, IRFile, IRNode, IRState } from '../ir/types'
import { parse } from '../parser/parser'
import { evalExpr } from './shared'

/**
 * 同文件自定义组件提取：从 postamble 切出每个 `@Component struct Xxx { ... }`，
 * 用同一 parser 解析成组件 IR 表（单个组件解析失败静默跳过，不影响主文件）。
 * 跨文件 import 的组件不解析（已知边界）。
 */
export function extractComponents(ir: IRFile | null): Record<string, IRFile> {
  const out: Record<string, IRFile> = {}
  if (!ir?.postamble) return out
  const text = ir.postamble
  const re = /@Component[\s\S]*?struct\s+(\w+)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const bodyStart = m.index + m[0].length
    let depth = 1
    let i = bodyStart
    for (; i < text.length; i++) {
      const ch = text[i]
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) break }
    }
    if (depth !== 0) continue
    try {
      out[m[1]] = parse(text.slice(m.index, i + 1))
    } catch { /* 静默跳过 */ }
  }
  return out
}

/**
 * 组件参数表（IRState 形态）：@State 成员 + raw 成员里的字面量字段初始化
 * （`title: string = 'x'`）。方法/箭头函数字段自然跳过（无 '=' 或求值失败）。
 */
export function componentParams(comp: IRFile): IRState[] {
  const out: IRState[] = [...comp.states]
  const push = (name: string, init: ArgVal) => {
    if (!out.some(s => s.name === name)) out.push({ name, type: '', init, decorator: '' })
  }
  for (const m of comp.members) {
    if (m.kind !== 'raw') continue
    const re = /(?:^|\n)\s*(?:private\s+|public\s+|readonly\s+|static\s+)*([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*([^\n]+)/g
    let mm: RegExpExecArray | null
    while ((mm = re.exec(m.text))) {
      const vraw = mm[2].trim()
      if (vraw.startsWith('{')) continue
      const v = evalExpr(vraw, out)
      if (v) push(mm[1], v)
    }
  }
  return out
}

/** 实例渲染用的合并状态：组件参数表 + 调用点 obj 参数按名覆盖（未声明字段容错补入） */
export function instanceStates(comp: IRFile, ctor: Record<string, ArgVal> | undefined): IRState[] {
  const base = componentParams(comp)
  if (!ctor) return base
  const merged = base.map(st => (ctor[st.name] ? { ...st, init: ctor[st.name] } : st))
  for (const k of Object.keys(ctor)) {
    if (!merged.some(s => s.name === k)) merged.push({ name: k, type: '', init: ctor[k], decorator: '' })
  }
  return merged
}

export interface BuilderDef { params: string[]; children: IRNode[] }

/** @Builder 定义表：name → { 参数名列表, children }（带参调用点渲染期做只读替换） */
export function buildersOf(ir: IRFile | null): Record<string, BuilderDef> {
  const out: Record<string, BuilderDef> = {}
  if (!ir) return out
  for (const m of ir.members) {
    if (m.kind !== 'builder') continue
    const pm = m.signature.match(/\(([^)]*)\)/)
    const params = pm
      ? pm[1].split(',').map(p => {
          const mm = p.trim().match(/[A-Za-z_$][\w$]*/)
          return mm ? mm[0] : ''
        }).filter(Boolean)
      : []
    out[m.name] = { params, children: m.children }
  }
  return out
}
