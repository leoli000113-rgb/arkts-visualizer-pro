import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { samePath, Path } from '../ir/mutate'
import { IRNode } from '../ir/types'
import { nodeSummary } from '../registry'
import { beginMaybeMove } from './dnd'

function TreeRow({ node, path, depth, collapsed, onToggle }: {
  node: IRNode
  path: Path
  depth: number
  collapsed: ReadonlySet<string>
  onToggle: (key: string) => void
}) {
  const selectedPath = useStore(s => s.selectedPath)
  const setSelected = useStore(s => s.setSelected)
  const dropTarget = useStore(s => s.dropTarget)
  const sel = !!selectedPath && samePath(selectedPath, path)
  const sum = nodeSummary(node)
  // 拖拽悬停指示：before/after 显示插入线，inside 高亮整行
  const dropPos = dropTarget && samePath(dropTarget.path, path) ? dropTarget.pos : null
  const cls = 'outline-row' + (sel ? ' sel' : '') + (dropPos ? ` drop-${dropPos}` : '')
  const key = path.join('.')
  const hasKids = node.children.length > 0
  const isCollapsed = collapsed.has(key)
  return (
    <div>
      <div
        className={cls}
        style={{ paddingLeft: 8 + depth * 14 }}
        data-tree-path={key}
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
        <span
          className={'outline-caret' + (hasKids ? '' : ' leaf')}
          onClick={(e) => { e.stopPropagation(); if (hasKids) onToggle(key) }}
          onPointerDown={(e) => e.stopPropagation()}
        >{hasKids ? (isCollapsed ? '▸' : '▾') : ''}</span>
        <span className="outline-type">{node.unsupported ? '⚠ ' : ''}{node.type}</span>
        {sum && <span className="outline-summary">{sum}</span>}
      </div>
      {!isCollapsed && node.children.map((c, i) => (
        <TreeRow key={i} node={c} path={[...path, i]} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
      ))}
    </div>
  )
}

/** 大纲树：递归展示 IR，点击选中（与画布双向联动），容器可收合，行可拖出到画布（复用 dnd 移动链路） */
export function OutlineTree() {
  const ir = useStore(s => s.ir)
  const selectedPath = useStore(s => s.selectedPath)
  const boxRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  const onToggle = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // 画布侧选中时，大纲树滚动到对应行
  useEffect(() => {
    if (!selectedPath || !boxRef.current) return
    const el = boxRef.current.querySelector(`[data-tree-path="${selectedPath.join('.')}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])

  if (!ir) return <div className="outline-empty">解析失败或无内容</div>
  return (
    <div className="outline" ref={boxRef}>
      <TreeRow node={ir.root} path={[]} depth={0} collapsed={collapsed} onToggle={onToggle} />
    </div>
  )
}
