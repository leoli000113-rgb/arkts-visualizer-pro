import { useEffect, useRef } from 'react'
import { useStore } from '../store/store'
import { getModifier, samePath, Path } from '../ir/mutate'
import { ArgVal, IRNode } from '../ir/types'
import { serializeArg } from '../ir/serialize'
import { beginMaybeMove } from './dnd'

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function argText(a: ArgVal | undefined): string {
  if (!a) return ''
  if (a.t === 'str' || a.t === 'raw' || a.t === 'enum') return a.v
  return serializeArg(a)
}

/** 节点摘要：Text/Button 显文本、If 显条件、ForEach 显数据源等，未知类型宽容处理 */
function summary(node: IRNode): string {
  const a0 = node.ctorArgs[0]
  switch (node.type) {
    case 'Text':
    case 'Button':
      return truncate(argText(a0), 12)
    case 'If':
      return a0 && a0.t === 'raw' ? truncate(a0.v, 16) : ''
    case 'ForEach':
      return a0 ? truncate(serializeArg(a0), 16) : ''
    case 'Image':
      return truncate(argText(a0), 12)
    case 'TextInput': {
      const o = a0 && a0.t === 'obj' ? a0.v : undefined
      return truncate(argText(o?.placeholder), 12)
    }
    case 'TabContent':
      return truncate(argText(getModifier(node, 'tabBar')?.args[0]), 12)
    default:
      return ''
  }
}

function TreeRow({ node, path, depth }: { node: IRNode; path: Path; depth: number }) {
  const selectedPath = useStore(s => s.selectedPath)
  const setSelected = useStore(s => s.setSelected)
  const dropTarget = useStore(s => s.dropTarget)
  const sel = !!selectedPath && samePath(selectedPath, path)
  const sum = summary(node)
  // 拖拽悬停指示：before/after 显示插入线，inside 高亮整行
  const dropPos = dropTarget && samePath(dropTarget.path, path) ? dropTarget.pos : null
  const cls = 'outline-row' + (sel ? ' sel' : '') + (dropPos ? ` drop-${dropPos}` : '')
  return (
    <div>
      <div
        className={cls}
        style={{ paddingLeft: 8 + depth * 14 }}
        data-tree-path={path.join('.')}
        onClick={(e) => { e.stopPropagation(); setSelected(path) }}
        onPointerDown={(e) => { if (path.length > 0) beginMaybeMove(path, e) }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setSelected(path)
          useStore.getState().openContextMenu(e.clientX, e.clientY, path)
        }}
        title={node.type + (sum ? ` · ${sum}` : '')}
      >
        <span className="outline-type">{node.unsupported ? '⚠ ' : ''}{node.type}</span>
        {sum && <span className="outline-summary">{sum}</span>}
      </div>
      {node.children.map((c, i) => (
        <TreeRow key={i} node={c} path={[...path, i]} depth={depth + 1} />
      ))}
    </div>
  )
}

/** 大纲树：递归展示 IR，点击选中（与画布双向联动），行可拖出到画布（复用 dnd 移动链路） */
export function OutlineTree() {
  const ir = useStore(s => s.ir)
  const selectedPath = useStore(s => s.selectedPath)
  const boxRef = useRef<HTMLDivElement>(null)

  // 画布侧选中时，大纲树滚动到对应行
  useEffect(() => {
    if (!selectedPath || !boxRef.current) return
    const el = boxRef.current.querySelector(`[data-tree-path="${selectedPath.join('.')}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])

  if (!ir) return <div className="outline-empty">解析失败或无内容</div>
  return (
    <div className="outline" ref={boxRef}>
      <TreeRow node={ir.root} path={[]} depth={0} />
    </div>
  )
}
