import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { deviceList, isFoldable, getViewport } from '../devices/devices'
import { validateIr } from '../ir/validate'
import { DeviceEditor } from '../editor/DeviceEditor'

/** 复制到剪贴板：优先 Clipboard API，失败时退回 execCommand 临时文本域 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* 剪贴板不可用时放弃 */ }
    ta.remove()
    return ok
  }
}

/** 顶栏：导入/重置/复制/导出/撤销重做/设备切换/折叠态/辅助标记/诊断角标/帮助 */
export function TopBar({ onOpenHelp }: { onOpenHelp: () => void }) {
  const {
    code, ir, error, deviceModel, fold,
    setCode, setDevice, setFold, resetToSample,
    undo, redo, showAids, setShowAids,
  } = useStore()
  const canUndo = useStore(s => s.past.length > 0)
  const canRedo = useStore(s => s.future.length > 0)
  useStore(s => s.deviceVersion)
  const [devEditorOpen, setDevEditorOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const vp = getViewport(deviceModel, fold)
  const warnings = useMemo(() => (ir ? validateIr(ir.root) : []), [ir])

  async function copyCode() {
    if (await copyText(code)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
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
      {error && <span className="err" title={error}>解析失败</span>}
      {!error && warnings.length > 0 && (
        <span className="warn" title={warnings.join('\n')}>⚠ {warnings.length} 处编译风险</span>
      )}
      <button className="help-btn" title="快捷键与手势说明" onClick={onOpenHelp}>?</button>
      {devEditorOpen && <DeviceEditor onClose={() => setDevEditorOpen(false)} />}
    </div>
  )
}
