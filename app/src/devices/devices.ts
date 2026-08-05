import data from './devices.json'

const VP_TO_CSS = 0.6
const OVERRIDE_KEY = 'arkts-device-overrides'

export interface Viewport { w_vp: number; h_vp: number; w_css: number; h_css: number }

export interface DeviceDef {
  model: string
  foldable: boolean
}

function pxToVp(px: number, dpi: number): number {
  return Math.round((px * 160) / dpi)
}

/**
 * vp → px/dpi 合成（vp 直填标定用）：取 1vp = 3px（dpi 480）的常见比率，
 * round(px×160/480) 精确回到原 vp，档案仍走 px+dpi 存储格式，无需改 schema。
 * 适用场景：真机/DevEco 预览器实测到 vp 尺寸（px2vp(display.width)）后直接录入。
 */
export function vpToPxDpi(w_vp: number, h_vp: number): { screenW_px: number; screenH_px: number; dpi: number } {
  return { screenW_px: w_vp * 3, screenH_px: h_vp * 3, dpi: 480 }
}

/** 深拷贝设备条目，并由 px/dpi 重算全部 vp 字段 */
function withRecomputedVp(profile: any): any {
  const p = JSON.parse(JSON.stringify(profile))
  if (p.foldable) {
    for (const key of ['unfolded', 'folded']) {
      const st = p.states?.[key]
      if (st && typeof st.screenW_px === 'number' && typeof st.screenH_px === 'number' && typeof st.dpi === 'number') {
        st.screenW_vp = pxToVp(st.screenW_px, st.dpi)
        st.screenH_vp = pxToVp(st.screenH_px, st.dpi)
      }
    }
  } else if (typeof p.screenW_px === 'number' && typeof p.screenH_px === 'number' && typeof p.dpi === 'number') {
    p.screenW_vp = pxToVp(p.screenW_px, p.dpi)
    p.screenH_vp = pxToVp(p.screenH_px, p.dpi)
  }
  return p
}

function loadOverrides(): Record<string, any> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** 基础 JSON + localStorage 覆盖层，按 model 覆盖合并 */
function mergedDevices(): any[] {
  const overrides = loadOverrides()
  const base = (data.devices as any[]).map((d) => ({ ...d }))
  const result = base.map((d) => {
    const o = overrides[d.model]
    return o ? { ...d, ...o, model: d.model } : d
  })
  for (const model of Object.keys(overrides)) {
    if (!base.some((d) => d.model === model)) result.push({ ...overrides[model], model })
  }
  return result
}

export const deviceList: DeviceDef[] = []

/** 原地刷新 deviceList，保持导出引用不变 */
function refreshDeviceList(): void {
  deviceList.length = 0
  for (const d of mergedDevices()) deviceList.push({ model: d.model, foldable: !!d.foldable })
}

refreshDeviceList()

export function isFoldable(model: string): boolean {
  const d = mergedDevices().find((x: any) => x.model === model)
  return !!d?.foldable
}

/** 返回合并后的完整设备条目（含 px/dpi/vp），未命中返回 undefined */
export function getDeviceProfile(model: string): any {
  return mergedDevices().find((x: any) => x.model === model)
}

/** 写入覆盖层：vp 字段由 px/dpi 自动重算后一并存储 */
export function saveDeviceOverride(model: string, profile: any): void {
  const overrides = loadOverrides()
  overrides[model] = withRecomputedVp({ ...profile, model })
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides))
  } catch {
    // 存储失败（如配额已满）时忽略，下次读取仍为基础数据
  }
  refreshDeviceList()
}

/** 清除全部覆盖，恢复基础 JSON 数据 */
export function resetDeviceOverrides(): void {
  try {
    localStorage.removeItem(OVERRIDE_KEY)
  } catch {
    // ignore
  }
  refreshDeviceList()
}

export function getViewport(model: string, fold: 'unfolded' | 'folded' | 'flat'): Viewport {
  const d: any = getDeviceProfile(model)
  if (!d) throw new Error(`未知设备: ${model}`)
  let w_vp: number, h_vp: number
  if (d.foldable) {
    const st = fold === 'folded' ? d.states.folded : d.states.unfolded
    w_vp = st.screenW_vp; h_vp = st.screenH_vp
  } else {
    w_vp = d.screenW_vp; h_vp = d.screenH_vp
  }
  return { w_vp, h_vp, w_css: w_vp * VP_TO_CSS, h_css: h_vp * VP_TO_CSS }
}
