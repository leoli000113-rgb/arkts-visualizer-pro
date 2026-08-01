import { useEffect, useRef } from 'react'
import { useStore } from '../store/store'
import { getNodeAtPath, getModifier, removeModifier, samePath } from '../ir/mutate'
import { serializeNode } from '../ir/serialize'

/**
 * 画布/大纲树的节点右键菜单：
 * 选中父级、同级上移/下移、创建副本、容器包裹、复制节点代码、删除。
 */
export function ContextMenu() {
  const menu = useStore(s => s.contextMenu)
  const ir = useStore(s => s.ir)
  const ref = useRef<HTMLDivElement>(null)

  // 点击菜单外 / Esc / 滚动时关闭
  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      useStore.getState().closeContextMenu()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useStore.getState().closeContextMenu() }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    function close() { useStore.getState().closeContextMenu() }
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  if (!menu || !ir) return null
  const node = getNodeAtPath(ir.root, menu.path)
  if (!node) return null

  const s = useStore.getState()
  const isRoot = menu.path.length === 0
  const idx = isRoot ? 0 : menu.path[menu.path.length - 1]
  const parent = isRoot ? null : getNodeAtPath(ir.root, menu.path.slice(0, -1))
  const siblingCount = parent ? parent.children.length : 1
  // 「位置调整」模式：开启后画布拖拽该节点只改 .offset（防误触移结构）；节点删除/结构变更自动退出
  const nudging = !!s.nudgePath && samePath(s.nudgePath, menu.path)
  const hasOffset = !!getModifier(node, 'offset')

  const run = (fn: () => void) => () => { fn(); s.closeContextMenu() }
  const copyCode = run(() => {
    const text = serializeNode(node, '')
    navigator.clipboard.writeText(text).catch(() => {})
  })

  // 防出屏：菜单宽 ~180，高约 380
  const x = Math.min(menu.x, window.innerWidth - 190)
  const y = Math.min(menu.y, window.innerHeight - 390)

  return (
    <div className="ctx-menu" ref={ref} style={{ left: x, top: y }}>
      <div className="ctx-title">{node.type}</div>
      <button className="ctx-item" disabled={isRoot}
        onClick={run(() => s.setSelected(menu.path.slice(0, -1)))}>选中父组件</button>
      <div className="ctx-sep" />
      {nudging ? (
        <button className="ctx-item" onClick={run(() => s.setNudge(null))}>退出位置调整</button>
      ) : (
        <button className="ctx-item" disabled={isRoot}
          onClick={run(() => { s.setSelected(menu.path); s.setNudge(menu.path) })}>调整位置（拖拽微调）</button>
      )}
      <button className="ctx-item" disabled={!hasOffset}
        onClick={run(() => s.mutateNode(menu.path, n => removeModifier(n, 'offset')))}>清除偏移量</button>
      <div className="ctx-sep" />
      <button className="ctx-item" disabled={isRoot || idx === 0}
        onClick={run(() => s.moveSibling(menu.path, -1))}>上移</button>
      <button className="ctx-item" disabled={isRoot || idx >= siblingCount - 1}
        onClick={run(() => s.moveSibling(menu.path, 1))}>下移</button>
      <div className="ctx-sep" />
      <button className="ctx-item" disabled={isRoot}
        onClick={run(() => s.duplicateNode(menu.path))}>创建副本</button>
      <div className="ctx-sub">
        <span>包裹进容器</span>
        <div className="ctx-sub-items">
          {['Column', 'Row', 'Stack'].map(t => (
            <button key={t} className="ctx-item" onClick={run(() => s.wrapNode(menu.path, t))}>{t}</button>
          ))}
        </div>
      </div>
      <div className="ctx-sep" />
      <button className="ctx-item" onClick={copyCode}>复制节点代码</button>
      <button className="ctx-item danger" disabled={isRoot}
        onClick={run(() => s.removeNode(menu.path))}>删除</button>
    </div>
  )
}
