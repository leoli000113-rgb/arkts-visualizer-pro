import { IRFile, Modifier } from '../ir/types'
import { parseModifierChainText } from '../parser/parser'

/** @Styles/@Extend 定义表 */
export interface StyleTables {
  /** @Styles name() → 修饰符链（任意组件可用） */
  styles: Record<string, Modifier[]>
  /** @Extend(CompType) name() → 组件类型 → 样式名 → 修饰符链 */
  extends: Record<string, Record<string, Modifier[]>>
}

/** 配对括号截取 { 之后的方法体；失败返回 null */
function takeBody(text: string, bodyStart: number): string | null {
  let depth = 1
  let i = bodyStart
  for (; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) break }
  }
  return depth === 0 ? text.slice(bodyStart, i) : null
}

/**
 * @Styles/@Extend 定义表提取：扫描 struct 成员 raw 与 preamble
 * （全局 `@Styles function name()` / `@Extend(Text) name()` 均支持）。
 * 解析失败的单个样式静默跳过。
 */
export function extractStyles(ir: IRFile | null): StyleTables {
  const out: StyleTables = { styles: {}, extends: {} }
  if (!ir) return out
  const sources: string[] = [ir.preamble]
  for (const m of ir.members) if (m.kind === 'raw') sources.push(m.text)
  for (const text of sources) {
    const reStyles = /@Styles\s+(?:function\s+)?(\w+)\s*\(\s*\)\s*\{/g
    let mm: RegExpExecArray | null
    while ((mm = reStyles.exec(text))) {
      const body = takeBody(text, mm.index + mm[0].length)
      if (body == null) continue
      const mods = parseModifierChainText(body)
      if (mods) out.styles[mm[1]] = mods
    }
    const reExtends = /@Extend\s*\(\s*(\w+)\s*\)\s*(?:function\s+)?(\w+)\s*\(\s*\)\s*\{/g
    while ((mm = reExtends.exec(text))) {
      const body = takeBody(text, mm.index + mm[0].length)
      if (body == null) continue
      const mods = parseModifierChainText(body)
      if (!mods) continue
      const compType = mm[1]
      if (!out.extends[compType]) out.extends[compType] = {}
      out.extends[compType][mm[2]] = mods
    }
  }
  return out
}
