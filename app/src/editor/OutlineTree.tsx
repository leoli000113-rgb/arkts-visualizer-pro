import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { samePath, Path, getNodeAtPath } from '../ir/mutate'
import { IRNode } from '../ir/types'
import { nodeSummary, CONTAINER_TYPES, PALETTE_GROUPS, makeDefaultNode } from '../registry'
import { acceptsChild, canAcceptMore } from '../ir/constraints'
import { beginMaybeMove, descendFullSingleChild } from './dnd'
import { LIBRARY, LIBRARY_CATEGORIES } from '../library/components'

interface PickerState { x: number; y: number; parent: Path; index: number }

/**
 * 插入选择器（大纲树「＋」弹出）：按目标容器的子类型/独子约束过滤，
 * 列出可插入的基础组件（按注册表分组）与复合组件（按分类）。
 */
function InsertPicker({ picker, onClose }: { picker: PickerState; onClose: () => void }) {
  const ir = useStore(s => s.ir)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!ir) return null
  const container = getNodeAtPath(ir.root, picker.parent)
  if (!container) return null
  const more = canAcceptMore(container)
  const accept = (t: string) => more && acceptsChild(container.type, t)
  const groups = PALETTE_GROUPS
    .map(g => ({ label: g.label, items: g.items.filter(accept) }))
    .filter(g => g.items.length > 0)
  const libs = LIBRARY_CATEGORIES
    .map(cat => ({ label: cat, items: LIBRARY.filter(c => c.category === cat && accept(c.makeNode().type)) }))
    .filter(g => g.items.length > 0)

  const insert = (node: IRNode) => {
    useStore.getState().insertChild(picker.parent, node, picker.index)
    onClose()
  }
  // 防出屏：菜单宽 ~200，高约 360
  const x = Math.min(picker.x, window.innerWidth - 210)
  const y = Math.min(picker.y, window.innerHeight - 370)
  return (
    <div className="ctx-menu insert-picker" ref={ref} style={{ left: x, top: y }}>
      <div className="ctx-title">插入组件 → {container.type}</div>
      <div className="picker-scroll">
        {groups.length + libs.length === 0 && (
          <div className="picker-empty">该位置受容器约束，无可插入组件</div>
        )}
        {groups.map(g => (
          <div key={g.label}>
            <div className="picker-sec">{g.label}</div>
            {g.items.map(t => (
              <button key={t} className="ctx-item" onClick={() => insert(makeDefaultNode(t))}>{t}</button>
            ))}
          </div>
        ))}
        {libs.map(g => (
          <div key={g.label}>
            <div className="picker-sec">复合 · {g.label}</div>
            {g.items.map(c => (
              <button key={c.name} className="ctx-item" onClick={() => insert(c.makeNode())}>{c.icon} {c.name}</button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function TreeRow({ node, path, depth, collapsed, onToggle, onPick }: {
  node: IRNode
  path: Path
  depth: number
  collapsed: ReadonlySet<string>
  onToggle: (key: string) => void
  onPick: (node: IRNode, path: Path, e: React.MouseEvent) => void
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
  const isContainer = CONTAINER_TYPES.has(node.type)
  const act = (e: React.SyntheticEvent) => e.stopPropagation()
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
        <span className="outline-acts">
          <button
            className="outline-act"
            title={isContainer ? '在内部末尾插入组件' : '在下方插入组件'}
            onClick={(e) => { e.stopPropagation(); onPick(node, path, e) }}
            onPointerDown={act}
          >＋</button>
          {path.length > 0 && (
            <button
              className="outline-act" title="创建副本"
              onClick={(e) => { e.stopPropagation(); useStore.getState().duplicateNode(path) }}
              onPointerDown={act}
            >⧉</button>
          )}
          {path.length > 0 && (
            <button
              className="outline-act danger" title="删除（可 Ctrl+Z 撤销）"
              onClick={(e) => { e.stopPropagation(); useStore.getState().removeNode(path) }}
              onPointerDown={act}
            >✕</button>
          )}
        </span>
      </div>
      {!isCollapsed && node.children.map((c, i) => (
        <TreeRow key={i} node={c} path={[...path, i]} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} onPick={onPick} />
      ))}
    </div>
  )
}

/**
 * 大纲树：结构化编辑的主入口（画布以展示/微调为主）。
 * 行悬停出 ＋插入 / ⧉副本 / ✕删除；拖拽移动（独子容器自动深入内层）；
 * 点击选中与画布双向联动；容器可收合；右键更多操作。
 */
export function OutlineTree() {
  const ir = useStore(s => s.ir)
  const selectedPath = useStore(s => s.selectedPath)
  const boxRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [picker, setPicker] = useState<PickerState | null>(null)

  const onToggle = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // 「＋」：容器 → 插入其内部末尾（独子已满自动深入内层）；叶子 → 插入其后
  const onPick = (node: IRNode, path: Path, e: React.MouseEvent) => {
    e.stopPropagation()
    let parent: Path
    let index: number
    if (CONTAINER_TYPES.has(node.type)) {
      const d = descendFullSingleChild(node, path)
      parent = d.path
      index = d.node.children.length
    } else {
      parent = path.slice(0, -1)
      index = path.length ? path[path.length - 1] + 1 : 0
    }
    setPicker({ x: e.clientX, y: e.clientY, parent, index })
  }

  // 画布侧选中时，大纲树滚动到对应行
  useEffect(() => {
    if (!selectedPath || !boxRef.current) return
    const el = boxRef.current.querySelector(`[data-tree-path="${selectedPath.join('.')}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])

  if (!ir) return <div className="outline-empty">解析失败或无内容</div>
  return (
    <div className="outline-wrap">
      <div className="outline" ref={boxRef}>
        <TreeRow node={ir.root} path={[]} depth={0} collapsed={collapsed} onToggle={onToggle} onPick={onPick} />
      </div>
      <div className="outline-hint">悬停行：＋插入 · ⧉副本 · ✕删除 · 拖拽移动 · 右键更多</div>
      {picker && <InsertPicker picker={picker} onClose={() => setPicker(null)} />}
    </div>
  )
}
