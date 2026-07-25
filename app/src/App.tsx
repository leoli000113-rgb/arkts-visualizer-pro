import { useEffect, useMemo, useState } from 'react'
import { useStore, initStore } from './store/store'
import { deviceList, isFoldable, getViewport } from './devices/devices'
import { renderNode } from './renderer/Renderer'
import { startNewDrag, startNewDragNode } from './editor/dnd'
import { OutlineTree } from './editor/OutlineTree'
import { PropertyPanel } from './editor/PropertyPanel'
import { DeviceEditor } from './editor/DeviceEditor'
import { ContextMenu } from './editor/ContextMenu'
import { validateIr } from './ir/validate'
import { TEMPLATE_CATEGORIES } from './templates/templates'
import { LIBRARY } from './library/components'
import './App.css'

const PALETTE_GROUPS: { label: string; items: string[] }[] = [
  { label: '布局', items: ['Column', 'Row', 'Stack', 'RelativeContainer', 'Flex'] },
  { label: '容器', items: ['Scroll', 'List', 'Grid', 'Tabs', 'ListItem', 'GridItem', 'TabContent'] },
  { label: '基础', items: ['Text', 'Button', 'Image', 'Video'] },
  { label: '表单', items: ['TextInput', 'Toggle', 'Slider', 'Checkbox', 'Radio', 'Progress'] },
]

type SideTab = 'palette' | 'library' | 'templates'

function Palette() {
  return (
    <div className="palette">
      <div className="palette-scroll">
        {PALETTE_GROUPS.map((g) => (
          <div key={g.label} className="palette-group">
            <div className="palette-group-label">{g.label}</div>
            <div className="palette-items">
              {g.items.map((t) => (
                <div key={t} className="palette-item"
                  onPointerDown={(e) => { e.preventDefault(); startNewDrag(t) }}
                >{t}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="palette-hint">拖入画布：边缘 30% = 前/后插入；中部 = 放入容器</div>
    </div>
  )
}

function LibraryPanel() {
  return (
    <div className="palette">
      <div className="palette-scroll">
        <div className="palette-group">
          <div className="palette-group-label">复合组件</div>
          <div className="palette-items library-items">
            {LIBRARY.map((c) => (
              <div key={c.name} className="palette-item library-item"
                onPointerDown={(e) => { e.preventDefault(); startNewDragNode(c.makeNode()) }}
              >
                <span className="lib-icon">{c.icon}</span>
                <span>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="palette-hint">复合组件 = 多个基础组件的组合，拖入即生成一组 UI</div>
    </div>
  )
}

function TemplatePanel() {
  const { setCode } = useStore()
  return (
    <div className="palette">
      <div className="palette-scroll">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <div key={cat.label} className="palette-group">
            <div className="palette-group-label">{cat.icon} {cat.label} ({cat.templates.length})</div>
            <div className="template-list">
              {cat.templates.map((t) => (
                <div key={t.name} className="template-card"
                  onClick={() => setCode(t.code)}
                >
                  <span className="tmpl-icon">{t.icon}</span>
                  <div className="tmpl-info">
                    <div className="tmpl-name">{t.name}</div>
                    <div className="tmpl-desc">{t.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="palette-hint">点击模板 → 替换当前页面代码</div>
    </div>
  )
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
  const {
    code, ir, error, deviceModel, fold, selectedPath, dropTarget,
    setCode, setDevice, setFold, setSelected, resetToSample,
    undo, redo, showAids, setShowAids,
  } = useStore()
  const canUndo = useStore(s => s.past.length > 0)
  const canRedo = useStore(s => s.future.length > 0)
  useStore(s => s.deviceVersion)
  const [devEditorOpen, setDevEditorOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sideTab, setSideTab] = useState<SideTab>('palette')

  useEffect(() => { initStore() }, [])
  useEditorShortcuts()

  const vp = getViewport(deviceModel, fold)
  const warnings = useMemo(() => (ir ? validateIr(ir.root) : []), [ir])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.querySelector<HTMLTextAreaElement>('.code-pane textarea')
      if (ta) { ta.focus(); ta.select() }
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function exportFile() {
    const name = (ir?.structName || 'Index') + '.ets'
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setCode(String(reader.result || ''))
    reader.readAsText(f)
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>ArkTS 可视化编辑器 · Pro</h1>
        <label className="file">导入 .ets<input type="file" accept=".ets,.ts" onChange={onFile} hidden /></label>
        <button onClick={resetToSample}>重置</button>
        <button onClick={copyCode}>{copied ? '✓ 已复制' : '复制代码'}</button>
        <button onClick={exportFile}>导出 .ets</button>
        <button onClick={undo} disabled={!canUndo}>↩ 撤销</button>
        <button onClick={redo} disabled={!canRedo}>↪ 重做</button>
        <span>设备：</span>
        <select value={deviceModel} onChange={(e) => { setDevice(e.target.value); if (!isFoldable(e.target.value)) setFold('unfolded') }}>
          {deviceList.map((d) => <option key={d.model} value={d.model}>{d.model}{d.foldable ? '（折叠屏）' : ''}</option>)}
        </select>
        {isFoldable(deviceModel) && (
          <div className="fold-toggle">
            <button className={fold === 'unfolded' ? 'active' : ''} onClick={() => setFold('unfolded')}>展开</button>
            <button className={fold === 'folded' ? 'active' : ''} onClick={() => setFold('folded')}>折叠</button>
          </div>
        )}
        <button onClick={() => setDevEditorOpen(true)}>设备档案</button>
        <label className="aids-toggle">
          <input type="checkbox" checked={showAids} onChange={(e) => setShowAids(e.target.checked)} />
          辅助标记
        </label>
        <span className="dim">{vp.w_vp} × {vp.h_vp} vp</span>
        {error && <span className="err">解析失败</span>}
        {!error && warnings.length > 0 && (
          <span className="warn" title={warnings.join('\n')}>⚠ {warnings.length} 处编译风险</span>
        )}
      </div>
      <div className="content">
        <div className="side-col">
          <div className="side-tabs">
            <button className={sideTab === 'palette' ? 'active' : ''} onClick={() => setSideTab('palette')}>组件</button>
            <button className={sideTab === 'library' ? 'active' : ''} onClick={() => setSideTab('library')}>组件库</button>
            <button className={sideTab === 'templates' ? 'active' : ''} onClick={() => setSideTab('templates')}>模板</button>
          </div>
          {sideTab === 'palette' && <Palette />}
          {sideTab === 'library' && <LibraryPanel />}
          {sideTab === 'templates' && <TemplatePanel />}
          <div className="outline-panel">
            <div className="label">大纲树</div>
            <OutlineTree />
          </div>
        </div>
        <div className="canvas-pane">
          <div className="phone-frame" style={{ width: vp.w_css + 20, height: vp.h_css + 20 }}>
            <div className="phone-screen" style={{ width: vp.w_css, height: vp.h_css, fontSize: 9.6, lineHeight: 1.35, color: '#182431' }} onClick={() => setSelected(null)}>
              {ir ? renderNode(ir.root, [], selectedPath, setSelected, dropTarget) : <div style={{ padding: 16, color: '#888' }}>{error ? '解析失败，见右侧代码窗' : '正在解析…'}</div>}
            </div>
          </div>
        </div>
        <div className="right-col">
          <div className="prop-panel">
            <div className="label">属性</div>
            <PropertyPanel />
          </div>
          <div className="code-pane">
            <div className="label">代码</div>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
          </div>
        </div>
      </div>
      {devEditorOpen && <DeviceEditor onClose={() => setDevEditorOpen(false)} />}
      <ContextMenu />
    </div>
  )
}
