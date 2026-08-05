import { useState } from 'react'
import { useStore } from '../store/store'
import { deviceList, getDeviceProfile, saveDeviceOverride, resetDeviceOverrides, vpToPxDpi } from '../devices/devices'

interface Dims { w: string; h: string; dpi: string }
interface FormState { foldable: boolean; flat: Dims; unfolded: Dims; folded: Dims }

const EMPTY: Dims = { w: '', h: '', dpi: '' }

/** 从合并后的档案读出表单初值（缺失字段留空，保存时校验） */
function loadForm(model: string): FormState {
  const p = getDeviceProfile(model)
  const dims = (d: any): Dims => ({
    w: d?.screenW_px != null ? String(d.screenW_px) : '',
    h: d?.screenH_px != null ? String(d.screenH_px) : '',
    dpi: d?.dpi != null ? String(d.dpi) : '',
  })
  return {
    foldable: !!p?.foldable,
    flat: p && !p.foldable ? dims(p) : { ...EMPTY },
    unfolded: p?.foldable ? dims(p.states?.unfolded) : { ...EMPTY },
    folded: p?.foldable ? dims(p.states?.folded) : { ...EMPTY },
  }
}

function parseDims(d: Dims): { screenW_px: number; screenH_px: number; dpi: number } | null {
  const w = parseInt(d.w, 10)
  const h = parseInt(d.h, 10)
  const dpi = parseInt(d.dpi, 10)
  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(dpi)) return null
  if (w <= 0 || h <= 0 || dpi <= 0) return null
  return { screenW_px: w, screenH_px: h, dpi }
}

const pxToVp = (px: number, dpi: number) => Math.round((px * 160) / dpi)

function DimsGroup({ title, dims, onChange }: { title: string; dims: Dims; onChange: (d: Dims) => void }) {
  const parsed = parseDims(dims)
  const [vpMode, setVpMode] = useState(false)
  // vp 直填：草稿态本地受控（容忍输入中间态），合法正整数即合成 px/dpi 回写（vpToPxDpi 往返精确）；
  // 外部变更（切换设备/新增模式重置表单）时按 dims 内容重同步草稿
  const curWv = parsed ? pxToVp(parsed.screenW_px, parsed.dpi) : 0
  const curHv = parsed ? pxToVp(parsed.screenH_px, parsed.dpi) : 0
  const [wS, setWS] = useState('')
  const [hS, setHS] = useState('')
  const dimsKey = `${dims.w}|${dims.h}|${dims.dpi}`
  const [prevKey, setPrevKey] = useState('')
  if (dimsKey !== prevKey) {
    setPrevKey(dimsKey)
    if (parsed) {
      // 仅当与草稿推导值不一致（外部变更）时覆盖草稿，保留输入中间态
      if (parseInt(wS, 10) !== curWv) setWS(String(curWv))
      if (parseInt(hS, 10) !== curHv) setHS(String(curHv))
    }
  }
  const setVp = (wv: number, hv: number) => {
    if (wv > 0 && hv > 0) {
      const d = vpToPxDpi(wv, hv)
      onChange({ w: String(d.screenW_px), h: String(d.screenH_px), dpi: String(d.dpi) })
    }
  }
  return (
    <div className="dev-group">
      <div className="dev-group-title">
        {title}
        <button type="button" className={`dev-mode-toggle${vpMode ? ' active' : ''}`}
          title="已知道自己手机的 vp 尺寸（真机 px2vp 实测 / DevEco 预览器视口）时，直接填 vp 最准"
          onClick={() => setVpMode(!vpMode)}>
          {vpMode ? 'vp 直填中' : '按 vp 直填'}
        </button>
      </div>
      {vpMode ? (
        <>
          <label className="prop-row"><span>宽（vp）</span>
            <input type="number" value={wS}
              onChange={(e) => { setWS(e.target.value); setVp(parseInt(e.target.value, 10), parseInt(hS, 10)) }} /></label>
          <label className="prop-row"><span>高（vp）</span>
            <input type="number" value={hS}
              onChange={(e) => { setHS(e.target.value); setVp(parseInt(wS, 10), parseInt(e.target.value, 10)) }} /></label>
          <div className="dev-vp-hint">
            如何知道自己手机的 vp：真机跑 px2vp(display.getDefaultDisplaySync().width/height)，或看 DevEco 预览器视口尺寸
          </div>
        </>
      ) : (
        <>
          <label className="prop-row"><span>screenW_px</span>
            <input type="number" value={dims.w} onChange={(e) => onChange({ ...dims, w: e.target.value })} /></label>
          <label className="prop-row"><span>screenH_px</span>
            <input type="number" value={dims.h} onChange={(e) => onChange({ ...dims, h: e.target.value })} /></label>
          <label className="prop-row"><span>dpi</span>
            <input type="number" value={dims.dpi} onChange={(e) => onChange({ ...dims, dpi: e.target.value })} /></label>
        </>
      )}
      <div className="dev-vp-hint">
        {parsed ? `≈ ${pxToVp(parsed.screenW_px, parsed.dpi)} × ${pxToVp(parsed.screenH_px, parsed.dpi)} vp（保存时自动重算）` : '请输入正整数'}
      </div>
    </div>
  )
}

/** 设备档案编辑弹窗：读 getDeviceProfile，写 saveDeviceOverride（vp 自动重算），重置走 resetDeviceOverrides */
export function DeviceEditor({ onClose }: { onClose: () => void }) {
  const deviceModel = useStore(s => s.deviceModel)
  const setDevice = useStore(s => s.setDevice)
  const bumpDeviceVersion = useStore(s => s.bumpDeviceVersion)
  const [model, setModel] = useState(deviceModel)
  const [form, setForm] = useState<FormState>(() => loadForm(deviceModel))
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState<'edit' | 'add'>('edit')
  const [newName, setNewName] = useState('')

  // 切换设备/模式时重置表单与提示：render 期间调整状态（官方推荐替代 effect 同步的模式）
  const syncKey = `${mode}:${model}`
  const [prevSync, setPrevSync] = useState(syncKey)
  if (syncKey !== prevSync) {
    setPrevSync(syncKey)
    if (mode === 'edit') setForm(loadForm(model))
    setMsg('')
  }

  const valid = form.foldable
    ? parseDims(form.unfolded) && parseDims(form.folded)
    : parseDims(form.flat)

  const trimmed = newName.trim()
  const nameTaken = !!trimmed && deviceList.some(d => d.model.toLowerCase() === trimmed.toLowerCase())
  const addValid = !!trimmed && !nameTaken && !!valid

  const onSave = () => {
    const profile = getDeviceProfile(model)
    if (!profile) return
    if (form.foldable) {
      const u = parseDims(form.unfolded)
      const f = parseDims(form.folded)
      if (!u || !f) return
      saveDeviceOverride(model, {
        ...profile,
        states: {
          unfolded: { ...(profile.states?.unfolded ?? {}), ...u },
          folded: { ...(profile.states?.folded ?? {}), ...f },
        },
      })
    } else {
      const flat = parseDims(form.flat)
      if (!flat) return
      saveDeviceOverride(model, { ...profile, ...flat })
    }
    bumpDeviceVersion() // getViewport 已走合并数据，计数 +1 触发重渲立即生效
    setMsg('已保存，视口已更新')
  }

  const onAdd = () => {
    if (!addValid) return
    const profile = form.foldable
      ? {
          model: trimmed, foldable: true, foldType: 'book', custom: true,
          states: { unfolded: parseDims(form.unfolded), folded: parseDims(form.folded) },
        }
      : { model: trimmed, foldable: false, custom: true, ...parseDims(form.flat) }
    saveDeviceOverride(trimmed, profile)
    bumpDeviceVersion()
    setDevice(trimmed) // 直接切换到新设备
    setModel(trimmed)
    setMode('edit')
    setNewName('')
    setMsg(`已添加「${trimmed}」并切换为当前设备`)
  }

  const onReset = () => {
    resetDeviceOverrides()
    bumpDeviceVersion()
    setForm(loadForm(model))
    setMsg('已恢复默认档案')
  }

  const startAdd = () => {
    setNewName('')
    setForm({ foldable: false, flat: { ...EMPTY }, unfolded: { ...EMPTY }, folded: { ...EMPTY } })
    setMode('add')
  }

  return (
    <div className="dev-overlay" onClick={onClose}>
      <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dev-head">
          <span>{mode === 'add' ? '新增设备' : '设备档案'}</span>
          <button className="dev-close" onClick={onClose} title="关闭">×</button>
        </div>
        {mode === 'edit' ? (
          <label className="prop-row"><span>设备</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {deviceList.map((d) => <option key={d.model} value={d.model}>{d.model}{d.foldable ? '（折叠屏）' : ''}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="prop-row"><span>型号名称</span>
              <input value={newName} placeholder="如 Mate 90 Pro" onChange={(e) => setNewName(e.target.value)} />
            </label>
            {nameTaken && <div className="dev-msg err">该型号已存在，请换个名称</div>}
            <label className="prop-row"><span>折叠屏</span>
              <select value={String(form.foldable)}
                onChange={(e) => setForm({ ...form, foldable: e.target.value === 'true' })}>
                <option value="false">否（直板）</option>
                <option value="true">是（含展开/折叠两态）</option>
              </select>
            </label>
          </>
        )}
        {form.foldable ? (
          <>
            <DimsGroup title="展开 unfolded" dims={form.unfolded} onChange={(d) => setForm({ ...form, unfolded: d })} />
            <DimsGroup title="折叠 folded" dims={form.folded} onChange={(d) => setForm({ ...form, folded: d })} />
          </>
        ) : (
          <DimsGroup title="屏幕参数" dims={form.flat} onChange={(d) => setForm({ ...form, flat: d })} />
        )}
        {msg && <div className="dev-msg">{msg}</div>}
        <div className="dev-actions">
          {mode === 'edit' ? (
            <>
              <button onClick={onSave} disabled={!valid}>保存</button>
              <button onClick={startAdd}>新增设备</button>
              <button onClick={onReset} title="清除全部设备覆盖，恢复基础 JSON 数据">恢复默认</button>
              <button onClick={onClose}>关闭</button>
            </>
          ) : (
            <>
              <button onClick={onAdd} disabled={!addValid}>添加</button>
              <button onClick={() => setMode('edit')}>返回</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
