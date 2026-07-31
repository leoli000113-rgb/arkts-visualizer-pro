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
import { DockZone, DockMenu } from './panels/dock'
import { ErrorBoundary } from './editor/ErrorBoundary'
import './App.css'

/** 停靠面板内容路由：面板 id → 内容组件 */
function renderPanel(p: PanelId): React.ReactNode {
  switch (p) {
    case 'nav': return <SidePanel />
    case 'outline': return <OutlineTree />
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

  return (
    <div className="app">
      <TopBar onOpenHelp={() => setHelpOpen(true)} />
      <ErrorBoundary>
        <div className="content">
          <DockZone side="top" renderPanel={renderPanel} />
          <div className="content-mid">
            <DockZone side="left" renderPanel={renderPanel} />
            <div className="canvas-pane" ref={paneRef}>
              <ZoomBar effZoom={effZoom} />
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
                  <div className={`phone-screen${interactive ? ' interactive' : ''}`} style={{ width: vp.w_css, height: vp.h_css, fontSize: 9.6, lineHeight: 1.35, color: '#182431' }} onClick={() => setSelected(null)}>
                    {ir ? renderNode(ir.root, [], selectedPath, setSelected, dropTarget) : <div style={{ padding: 16, color: '#888' }}>{error ? '解析失败，见右侧代码窗' : '正在解析…'}</div>}
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
