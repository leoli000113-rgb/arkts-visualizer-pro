import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { linter, lintGutter, forceLinting, Diagnostic } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import { useStore } from '../store/store'
import { parse } from '../parser/parser'
import { getNodeAtPath } from '../ir/mutate'

/** 从 parser 报错文本提取字符位置（"…在位置 123 遇到…"），无位置信息返回 null */
function errorPos(err: string): number | null {
  const m = err.match(/位置 (\d+)/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * 代码窗（CodeMirror 6）：TS 语法高亮 / 行号 / 括号匹配 / 解析错误行内标记。
 * 输入防抖 400ms 再解析，失焦立即提交；外部代码变更（拖拽回写/模板/撤销/导入）自动同步。
 */
export function CodePane() {
  const code = useStore(s => s.code)
  const setCode = useStore(s => s.setCode)
  const error = useStore(s => s.error)
  const selectedPath = useStore(s => s.selectedPath)
  const [text, setText] = useState(code)
  const lastPushed = useRef(code)
  const timer = useRef<number | undefined>(undefined)
  const viewRef = useRef<EditorView | null>(null)

  // 外部代码变更 → 同步进编辑器
  useEffect(() => {
    if (code !== lastPushed.current) {
      lastPushed.current = code
      setText(code)
    }
  }, [code])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // 防抖解析完成后 error 变化时，强制重跑 lint（否则文档未变不重算诊断）
  useEffect(() => {
    if (viewRef.current) forceLinting(viewRef.current)
  }, [error])

  // 大纲树/画布选中节点 → 代码跳转到对应源码位置。
  // 注意：结构编辑后 store 的 ir 是被 mutate 的树（pos 与新 code 错位），
  // 故用当前 code 重新 parse 一份拿 fresh pos，保证偏移与编辑器内容一致。
  useEffect(() => {
    const view = viewRef.current
    if (!view || !selectedPath) return
    let fresh
    try { fresh = parse(code) } catch { return }
    const node = getNodeAtPath(fresh.root, selectedPath)
    if (!node || node.pos == null) return
    const len = view.state.doc.length
    const pos = Math.max(0, Math.min(node.pos, len))
    const line = view.state.doc.lineAt(pos)
    view.dispatch({
      selection: { anchor: line.from, head: Math.min(line.to, len) },
      scrollIntoView: true,
    })
  }, [selectedPath, code])

  const extensions = useMemo(() => [
    javascript({ typescript: true }),
    lintGutter(),
    linter((view): Diagnostic[] => {
      if (!error) return []
      const pos = errorPos(error)
      const len = view.state.doc.length
      const at = pos == null ? 0 : Math.max(0, Math.min(pos, len))
      return [{ from: at, to: Math.min(at + 1, len), severity: 'error', message: error }]
    }),
  ], [error])

  function commit(v: string) {
    lastPushed.current = v
    setCode(v)
  }
  function onChange(v: string) {
    setText(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (v !== lastPushed.current) commit(v)
    }, 400)
  }
  function onBlur() {
    window.clearTimeout(timer.current)
    if (text !== lastPushed.current) commit(text)
  }

  return (
    <div className="code-pane">
      {error && <div className="code-err">⚠ 解析失败：{error}</div>}
      <CodeMirror
        value={text}
        height="100%"
        className="code-editor"
        theme="light"
        extensions={extensions}
        onChange={onChange}
        onBlur={onBlur}
        onCreateEditor={(view) => { viewRef.current = view }}
        basicSetup={{
          autocompletion: false,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: false,
        }}
      />
    </div>
  )
}
