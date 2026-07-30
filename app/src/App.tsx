import { useEffect, useRef, useState } from 'react'
import { useStore, initStore } from './store/store'
import { getViewport } from './devices/devices'
import { renderNode } from './renderer/Renderer'
import { PropertyPanel } from './editor/PropertyPanel'
import { ContextMenu } from './editor/ContextMenu'
import { TopBar } from './panels/TopBar'
import { SidePanel } from './panels/SidePanel'
import { ZoomBar } from './panels/ZoomBar'
import { CodePane } from './panels/CodePane'
import { HelpModal } from './panels/HelpModal'
import { ErrorBoundary } from './editor/ErrorBoundary'
import './App.css'

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

  useEffect(() => { initStore() }, [])
  useEditorShortcuts()

  const vp = getViewport(deviceModel, fold)
  const zoom = useStore(s => s.zoom)

  return (
    <div className="app">
      <TopBar onOpenHelp={() => setHelpOpen(true)} />
      <ErrorBoundary>
        <div className="content">
          <SidePanel />
          <div className="canvas-pane" ref={paneRef}>
            <ZoomBar paneRef={paneRef} w_css={vp.w_css} h_css={vp.h_css} />
            <div className="zoom-stage" style={{ width: (vp.w_css + 20) * zoom, height: (vp.h_css + 20) * zoom }}>
              <div className="phone-frame" style={{ width: vp.w_css + 20, height: vp.h_css + 20, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                <div className="phone-screen" style={{ width: vp.w_css, height: vp.h_css, fontSize: 9.6, lineHeight: 1.35, color: '#182431' }} onClick={() => setSelected(null)}>
                  {ir ? renderNode(ir.root, [], selectedPath, setSelected, dropTarget) : <div style={{ padding: 16, color: '#888' }}>{error ? '解析失败，见右侧代码窗' : '正在解析…'}</div>}
                </div>
              </div>
            </div>
          </div>
          <div className="right-col">
            <div className="prop-panel">
              <div className="label">属性</div>
              <PropertyPanel />
            </div>
            <CodePane />
          </div>
        </div>
      </ErrorBoundary>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <ContextMenu />
    </div>
  )
}
