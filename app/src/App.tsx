import { useEffect, useRef, useState } from 'react'
import { useStore, initStore, PanelId } from './store/store'
import { getViewport } from './devices/devices'
import { renderNode } from './renderer/Renderer'
import { PropertyPanel } from './editor/PropertyPanel'
import { ContextMenu } from './editor/ContextMenu'
import { OutlineTree } from './editor/OutlineTree'
import { TopBar } from './panels/TopBar'
import { SidePanel } from './panels/SidePanel'
import { ZoomBar } from './panels/ZoomBar'
import { CodePane } from './panels/CodePane'
import { HelpModal } from './panels/HelpModal'
import { DockZone, DockMenu, OutlineStrip } from './panels/dock'
import { ErrorBoundary } from './editor/ErrorBoundary'
import './App.css'

/** 停靠面板内容路由：面板 id → 内容组件（大纲树为独立固定条，见 OutlineStrip） */
function renderPanel(p: PanelId): React.ReactNode {
  switch (p) {
    case 'nav': return <SidePanel />
    case 'props': return <PropertyPanel />
    case 'code': return <CodePane />
  }
}

function useEditorShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      // 「位置调整」模式：Esc 退出；方向键微调 .offset（Shift = 10vp 步进）
      const nudge = useStore.getState().nudgePath
      // 粘贴模式：Esc 退出（复制后点击容器/组件即粘贴）
      if (e.key === 'Escape' && !inField && useStore.getState().pasteArmed) {
        useStore.getState().setPasteArmed(false)
        return
      }
      if (nudge && !inField) {
        if (e.key === 'Escape') { useStore.getState().setNudge(null); return }
        const delta = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, number[]>)[e.key]
        if (delta) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          useStore.getState().nudgeBy(delta[0] * step, delta[1] * step)
          return
        }
      }
      if (mod && key === 'z' && !e.shiftKey) {
        if (inField) return
        e.preventDefault()
        useStore.getState().undo()
      } else if ((mod && key === 'y') || (mod && e.shiftKey && key === 'z')) {
        if (inField) return
        e.preventDefault()
        useStore.getState().redo()
      } else if (mod && key === 'c' && !inField) {
        const { selectedPath, copyNode } = useStore.getState()
        if (!selectedPath) return
        e.preventDefault()
        copyNode(selectedPath)
      } else if (mod && key === 'x' && !inField) {
        const { selectedPath, cutNode } = useStore.getState()
        if (!selectedPath || selectedPath.length === 0) return
        e.preventDefault()
        cutNode(selectedPath)
      } else if (mod && key === 'v' && !inField) {
        const { clipboard, pasteNode } = useStore.getState()
        if (!clipboard) return
        e.preventDefault()
        pasteNode()
      } else if (mod && key === 'd' && !inField) {
        const { selectedPath, duplicateNode } = useStore.getState()
        if (!selectedPath || selectedPath.length === 0) return
        e.preventDefault()
        duplicateNode(selectedPath)
      } else if (e.key === 'Delete' && !inField) {
        const { selectedPath, removeNode } = useStore.getState()
        if (selectedPath && selectedPath.length > 0) removeNode(selectedPath)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const { ir, error, deviceModel, fold, selectedPath, dropTarget, setSelected } = useStore()
  const [helpOpen, setHelpOpen] = useState(false)
  const paneRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)

  useEffect(() => { initStore() }, [])
  useEditorShortcuts()

  const vp = getViewport(deviceModel, fold)
  const zoom = useStore(s => s.zoom)
  const fitMode = useStore(s => s.fitMode)
  const interactive = useStore(s => s.interactive)
  const currentFile = useStore(s => s.currentFile)
  const navDepth = useStore(s => s.navStack.length)
  const navigateBack = useStore(s => s.navigateBack)

  // 自适应窗口：画布可用空间或设备视口变化时重算适配缩放（fitMode 开启时生效）
  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const update = () => {
      setFit(Math.min(
        (pane.clientWidth - 80) / (vp.w_css + 20),
        (pane.clientHeight - 80) / (vp.h_css + 20),
      ))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(pane)
    return () => ro.disconnect()
  }, [vp.w_css, vp.h_css])

  const effZoom = fitMode ? Math.min(2, Math.max(0.2, fit)) : zoom
  const nudgePath = useStore(s => s.nudgePath)
  const pasteArmed = useStore(s => s.pasteArmed)
  const systemBars = useStore(s => s.systemBars)

  return (
    <div className="app">
      <TopBar onOpenHelp={() => setHelpOpen(true)} />
      <ErrorBoundary>
        <div className="content">
          <div className="content-mid">
            <DockZone side="left" renderPanel={renderPanel} />
            <OutlineStrip><OutlineTree /></OutlineStrip>
            <div className="canvas-pane" ref={paneRef}>
              <ZoomBar effZoom={effZoom} />
              {nudgePath && (
                <div className="nudge-bar">
                  位置调整中：拖拽改偏移 · 方向键微调（Shift ×10）· Esc 退出
                  <button className="nudge-bar-x" title="退出位置调整"
                    onClick={() => useStore.getState().setNudge(null)}>✕</button>
                </div>
              )}
              {pasteArmed && (
                <div className="nudge-bar paste-bar">
                  粘贴模式：点击容器放入内部 · 点击组件放到其后 · 可连续点击多处 · Esc 退出
                  <button className="nudge-bar-x" title="退出粘贴模式"
                    onClick={() => useStore.getState().setPasteArmed(false)}>✕</button>
                </div>
              )}
              {(currentFile || navDepth > 0) && (
                <div className="page-bar">
                  {navDepth > 0 && (
                    <button className="page-back" onClick={navigateBack} title="模拟 router.back()">◀ 返回</button>
                  )}
                  <span className="page-name" title={currentFile ?? undefined}>{ir?.structName ?? currentFile}</span>
                  {interactive && <span className="page-live">交互预览</span>}
                </div>
              )}
              <div className="zoom-stage" style={{ width: (vp.w_css + 20) * effZoom, height: (vp.h_css + 20) * effZoom }}>
                <div className="phone-frame" style={{ width: vp.w_css + 20, height: vp.h_css + 20, transform: `scale(${effZoom})`, transformOrigin: 'top left' }}>
                  <div className={`phone-screen${interactive ? ' interactive' : ''}${pasteArmed ? ' paste-armed' : ''}`} style={{ width: vp.w_css, height: vp.h_css, fontSize: 9.6, lineHeight: 1.35, color: '#182431' }} onClick={() => { setSelected(null); useStore.getState().setNudge(null); useStore.getState().setPasteArmed(false) }}>
                    {systemBars && (
                      <div className="status-bar" title="手机状态栏（安全区）：应用内容从其下方开始">
                        <span className="sb-time">10:08</span>
                        <span className="sb-icons">
                          <svg width="11" height="8" viewBox="0 0 11 8" aria-hidden="true">
                            <rect x="0" y="5" width="2" height="3" rx="0.5" fill="currentColor" />
                            <rect x="3" y="3.5" width="2" height="4.5" rx="0.5" fill="currentColor" />
                            <rect x="6" y="2" width="2" height="6" rx="0.5" fill="currentColor" />
                            <rect x="9" y="0.5" width="2" height="7.5" rx="0.5" fill="currentColor" opacity="0.35" />
                          </svg>
                          <svg width="11" height="8" viewBox="0 0 12 9" aria-hidden="true">
                            <path d="M6 8.2 4.1 6.2a2.7 2.7 0 0 1 3.8 0L6 8.2z" fill="currentColor" />
                            <path d="M2.6 4.7a4.9 4.9 0 0 1 6.8 0L8 6.1a2.9 2.9 0 0 0-4 0l-1.4-1.4z" fill="currentColor" />
                            <path d="M0.9 3a7.4 7.4 0 0 1 10.2 0l-1.3 1.3a5.4 5.4 0 0 0-7.6 0L0.9 3z" fill="currentColor" />
                          </svg>
                          <svg width="15" height="8" viewBox="0 0 16 9" aria-hidden="true">
                            <rect x="0.5" y="0.5" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.5" />
                            <rect x="2" y="2" width="8" height="5" rx="1" fill="currentColor" />
                            <rect x="13.5" y="3" width="2" height="3" rx="1" fill="currentColor" fillOpacity="0.5" />
                          </svg>
                        </span>
                      </div>
                    )}
                    <div className="app-area">
                      {ir ? renderNode(ir.root, [], selectedPath, setSelected, dropTarget) : <div style={{ padding: 16, color: '#888' }}>{error ? '解析失败，见右侧代码窗' : '正在解析…'}</div>}
                    </div>
                    {systemBars && (
                      <div className="nav-bar" title="底部导航条（安全区）：手势横条区域">
                        <span className="nav-pill" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DockZone side="right" renderPanel={renderPanel} />
          </div>
          <DockZone side="bottom" renderPanel={renderPanel} />
        </div>
      </ErrorBoundary>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <ContextMenu />
      <DockMenu />
    </div>
  )
}
