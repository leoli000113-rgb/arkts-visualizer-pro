import { useEffect, useRef } from 'react'
import { useStore, DockSide, PanelId } from '../store/store'

export const PANEL_TITLES: Record<PanelId, string> = { nav: '面板', props: '属性', code: '代码' }
const PANEL_ORDER: PanelId[] = ['nav', 'props', 'code']

/** 指针轴向拖拽：onDelta 收到相对按下点的累计 px 增量；松手/取消自动解绑 */
export function startAxisDrag(e: React.PointerEvent, axis: 'x' | 'y', onDelta: (d: number) => void) {
  e.preventDefault()
  e.stopPropagation()
  const start = axis === 'x' ? e.clientX : e.clientY
  const move = (ev: PointerEvent) => {
    if (ev.buttons === 0) { up(); return } // 错过 pointerup 的兜底
    onDelta((axis === 'x' ? ev.clientX : ev.clientY) - start)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/**
 * 单个停靠面板：首部（右键选停靠边）+ 内容 + 主尺寸把手。
 * 左/右区内面板竖向堆叠（把手在底边，调高度）；上/下区内横向并排（把手在右边，调宽度）。
 */
export function DockBox({ id, side, children }: { id: PanelId; side: DockSide; children: React.ReactNode }) {
  const size = useStore(s => s.panelSize[id])
  const setPanelSize = useStore(s => s.setPanelSize)
  const boxRef = useRef<HTMLDivElement>(null)
  const vertical = side === 'left' || side === 'right'
  const style: React.CSSProperties = size > 0
    ? { flex: '0 0 auto', ...(vertical ? { height: size } : { width: size }) }
    : { flex: '1 1 0' }
  return (
    <div className="dock-box" style={style} ref={boxRef}>
      <div
        className="dock-head"
        onContextMenu={(e) => { e.preventDefault(); useStore.getState().openDockMenu(e.clientX, e.clientY, id) }}
        title="右键：选择停靠位置（左 / 右 / 底）"
      >
        <span>{PANEL_TITLES[id]}</span>
        <span className="dock-head-hint">⋮⋮</span>
      </div>
      <div className="dock-body">{children}</div>
      <div
        className={'dock-size ' + (vertical ? 'dock-size-b' : 'dock-size-r')}
        title="拖拽调整尺寸"
        onPointerDown={(e) => {
          const box = boxRef.current
          if (!box) return
          const startSize = vertical ? box.offsetHeight : box.offsetWidth
          startAxisDrag(e, vertical ? 'y' : 'x', (d) => {
            setPanelSize(id, Math.min(1200, Math.max(100, startSize + d)))
          })
        }}
      />
    </div>
  )
}

/** 停靠区（左/右/底三边之一）：盛放该区全部面板 + 区缘尺寸把手；无面板停靠时不渲染 */
export function DockZone({ side, renderPanel }: { side: DockSide; renderPanel: (p: PanelId) => React.ReactNode }) {
  const docks = useStore(s => s.layoutDocks)
  const size = useStore(s => s.zoneSize[side])
  const setZoneSize = useStore(s => s.setZoneSize)
  const panels = PANEL_ORDER.filter(p => docks[p] === side)
  if (panels.length === 0) return null
  const vertical = side === 'left' || side === 'right'
  // 把手在内缘：左区拖拽正向放大，右/下区反向
  const sign = side === 'left' ? 1 : -1
  const max = vertical ? Math.min(900, window.innerWidth - 320) : Math.min(700, window.innerHeight - 260)
  const handle = (
    <div
      className={`zone-handle zh-${side}`}
      title="拖拽调整区域尺寸"
      onPointerDown={(e) => startAxisDrag(e, vertical ? 'x' : 'y', (d) => {
        setZoneSize(side, Math.min(max, Math.max(160, size + sign * d)))
      })}
    />
  )
  return (
    <div className={`dock-zone dz-${side}`} style={vertical ? { width: size } : { height: size }}>
      {(side === 'right' || side === 'bottom') && handle}
      <div className="dock-zone-inner" style={{ flexDirection: vertical ? 'column' : 'row' }}>
        {panels.map(p => <DockBox key={p} id={p} side={side}>{renderPanel(p)}</DockBox>)}
      </div>
      {side === 'left' && handle}
    </div>
  )
}

/** 大纲树专用条：固定全高、贴着左停靠区右侧（不参与四边停靠），宽度可拖；首部 « 收合成窄条 */
export function OutlineStrip({ children }: { children: React.ReactNode }) {
  const width = useStore(s => s.outlineWidth)
  const setOutlineWidth = useStore(s => s.setOutlineWidth)
  const collapsed = useStore(s => s.outlineCollapsed)
  const setCollapsed = useStore(s => s.setOutlineCollapsed)
  if (collapsed) {
    // 收合态：窄条（点击任意处展开），竖排标签 + 顶部 » 按钮
    return (
      <div className="outline-rail" title="展开大纲树" onClick={() => setCollapsed(false)}>
        <button className="outline-rail-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false) }}>»</button>
        <span className="outline-rail-label">大纲树</span>
      </div>
    )
  }
  return (
    <div className="dock-box outline-strip" style={{ flex: '0 0 auto', width }}>
      <div className="dock-head">
        <span>大纲树</span>
        <button className="outline-fold-btn" title="收合大纲树" onClick={() => setCollapsed(true)}>«</button>
      </div>
      <div className="dock-body">{children}</div>
      <div
        className="dock-size dock-size-r"
        title="拖拽调整宽度"
        onPointerDown={(e) => startAxisDrag(e, 'x', (d) => setOutlineWidth(width + d))}
      />
    </div>
  )
}

/** 面板首部右键菜单：选择停靠边 / 重置布局 */
export function DockMenu() {
  const menu = useStore(s => s.dockMenu)
  const docks = useStore(s => s.layoutDocks)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      useStore.getState().closeDockMenu()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useStore.getState().closeDockMenu() }
    const close = () => useStore.getState().closeDockMenu()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  if (!menu) return null
  const opts: { side: DockSide; label: string }[] = [
    { side: 'left', label: '停靠到左侧' },
    { side: 'right', label: '停靠到右侧' },
    { side: 'bottom', label: '停靠到底部' },
  ]
  const x = Math.min(menu.x, window.innerWidth - 180)
  const y = Math.min(menu.y, window.innerHeight - 190)
  return (
    <div className="ctx-menu" ref={ref} style={{ left: x, top: y }}>
      <div className="ctx-title">{PANEL_TITLES[menu.panel]} · 停靠位置</div>
      {opts.map(o => (
        <button key={o.side} className="ctx-item"
          onClick={() => { useStore.getState().setPanelDock(menu.panel, o.side); useStore.getState().closeDockMenu() }}>
          {docks[menu.panel] === o.side ? '✓ ' : ''}{o.label}
        </button>
      ))}
      <div className="ctx-sep" />
      <button className="ctx-item"
        onClick={() => { useStore.getState().resetLayout(); useStore.getState().closeDockMenu() }}>重置全部布局</button>
    </div>
  )
}
