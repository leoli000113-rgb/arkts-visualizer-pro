import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { deviceList, isFoldable, getViewport } from '../devices/devices'
import { validateIr } from '../ir/validate'
import { DeviceEditor } from '../editor/DeviceEditor'
import { isMediaFile, mediaKeyOf, parseResourceJson } from '../project/project'

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

/** File → dataURL（媒体资源内联存储用） */
function readDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })
}

const MEDIA_SIZE_CAP = 12 * 1024 * 1024 // 单文件 12MB 上限（dataURL 落盘 localStorage，防爆配额）

/** 顶栏：导入（单文件/整项目/媒体）/重置/复制/导出/撤销重做/设备切换/折叠态/交互预览/辅助标记/诊断角标/帮助 */
export function TopBar({ onOpenHelp }: { onOpenHelp: () => void }) {
  const {
    code, ir, error, deviceModel, fold,
    setDevice, setFold, resetToSample,
    undo, redo, showAids, setShowAids,
    interactive, setInteractive,
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
    e.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => useStore.getState().loadSingleFile(String(reader.result || ''))
    reader.readAsText(f)
  }

  /** 整项目导入：递归读取所选目录的 .ets/.ts、媒体资源、resources element json */
  async function onProjectDir(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!list.length) return
    const files: Record<string, string> = {}
    const media: Record<string, string> = {}
    const colors: Record<string, string> = {}
    const strings: Record<string, string> = {}
    for (const f of list) {
      const rel = (f as { webkitRelativePath?: string }).webkitRelativePath || f.name
      if (/node_modules|ohosTest|\/build\/|\.test\.|\.d\.ts$/i.test(rel)) continue
      if (/\.(ets|ts)$/i.test(f.name)) {
        files[rel] = await f.text()
      } else if (isMediaFile(f.name)) {
        if (f.size > MEDIA_SIZE_CAP) continue
        const key = mediaKeyOf(f.name)
        if (!(key in media)) media[key] = await readDataUrl(f)
      } else if (/element.*\.json$/i.test(rel) || /(color|string)\.json$/i.test(f.name)) {
        const map = parseResourceJson(await f.text())
        if (map && /color/i.test(f.name)) Object.assign(colors, map)
        else if (map && /string/i.test(f.name)) Object.assign(strings, map)
      }
    }
    if (Object.keys(files).length) {
      useStore.getState().importProject(files, media, colors, strings)
    }
  }

  /** 追加导入图片/视频（合并进当前媒体表） */
  async function onMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    e.target.value = ''
    const entries: Record<string, string> = {}
    for (const f of list) {
      if (!isMediaFile(f.name) || f.size > MEDIA_SIZE_CAP) continue
      entries[mediaKeyOf(f.name)] = await readDataUrl(f)
    }
    if (Object.keys(entries).length) useStore.getState().importMedia(entries)
  }

  return (
    <div className="topbar">
      <h1>ArkTS 可视化编辑器 · Pro</h1>
      <label className="file">导入 .ets<input type="file" accept=".ets,.ts" onChange={onFile} hidden /></label>
      <label className="file" title="选择 ArkTS 工程目录（递归读取 ets 源码/媒体/resources）">
        导入项目
        <input type="file" multiple onChange={onProjectDir} hidden
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} />
      </label>
      <label className="file" title="导入图片/视频，供 $r('app.media.x') 与路径引用解析">
        导入媒体
        <input type="file" accept="image/*,video/*" multiple onChange={onMedia} hidden />
      </label>
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
      <label className="aids-toggle" title="开启后：点击带 router 跳转的组件即切换页面（模拟真机导航），不再选中节点">
        <input type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} />
        交互预览
      </label>
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
