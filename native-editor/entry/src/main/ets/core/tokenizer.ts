/**
 * 词法器 —— 从 Web 版 app/src/parser/tokenizer.ts 移植（逐行一致）
 */

export type TokKind = 'id' | 'num' | 'str' | 'tpl' | 'hex' | 'punct' | 'comment' | 'eof'

export interface Tok {
  kind: TokKind
  text: string
  pos: number
  end: number
}

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if (c === '/' && src[i + 1] === '/') {
      const start = i
      while (i < n && src[i] !== '\n') i++
      toks.push({ kind: 'comment', text: src.slice(start, i), pos: start, end: i })
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      toks.push({ kind: 'comment', text: src.slice(start, i), pos: start, end: i })
      continue
    }
    if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
      let j = i + 2
      while (j < n && /[0-9a-fA-F]/.test(src[j])) j++
      toks.push({ kind: 'hex', text: src.slice(i, j), pos: i, end: j }); i = j; continue
    }
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < n && /[0-9.]/.test(src[j])) j++
      toks.push({ kind: 'num', text: src.slice(i, j), pos: i, end: j }); i = j; continue
    }
    if (c === '"' || c === "'") {
      const quote = c; let j = i + 1; let s = ''
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2; continue }
        s += src[j]; j++
      }
      j++
      toks.push({ kind: 'str', text: s, pos: i, end: j }); i = j; continue
    }
    if (c === '`') {
      // 模板字符串：整体保留原文（含反引号与 ${...}），按 raw 处理不求值
      let j = i + 1
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\' && j + 1 < n) { j += 2; continue }
        j++
      }
      j++
      toks.push({ kind: 'tpl', text: src.slice(i, j), pos: i, end: j }); i = j; continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++
      toks.push({ kind: 'id', text: src.slice(i, j), pos: i, end: j }); i = j; continue
    }
    if (c === '=' && src[i + 1] === '>') { toks.push({ kind: 'punct', text: '=>', pos: i, end: i + 2 }); i += 2; continue }
    toks.push({ kind: 'punct', text: c, pos: i, end: i + 1 }); i++
  }
  toks.push({ kind: 'eof', text: '', pos: i, end: i })
  return toks
}
