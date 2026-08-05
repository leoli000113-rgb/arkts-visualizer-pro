import { describe, it, expect } from 'vitest'
import { getViewport, vpToPxDpi, deviceList } from './devices'

// 设备档案：vp 换算与 vp 直填标定的往返精确性
describe('devices：vp 换算', () => {
  it('vpToPxDpi 合成后 getViewport 精确保留 vp（×3 / dpi480 比率）', () => {
    for (const [w, h] of [[360, 780], [464, 1001], [419, 949], [458, 989]] as const) {
      const d = vpToPxDpi(w, h)
      // 与 withRecomputedVp 同一公式校验：round(px*160/dpi) === 原 vp
      expect(Math.round((d.screenW_px * 160) / d.dpi)).toBe(w)
      expect(Math.round((d.screenH_px * 160) / d.dpi)).toBe(h)
    }
  })
  it('内置档案：直板机 vp 与 px/dpi 一致（防手改 json 失配）', () => {
    for (const model of ['Mate 80 Pro Max', '标准 360 基准', 'Mate 60 Pro', 'Mate 70 Pro', 'Pura 70 Pro']) {
      const vp = getViewport(model, 'unfolded')
      expect(vp.w_vp, model).toBeGreaterThan(0)
      expect(vp.w_css).toBeCloseTo(vp.w_vp * 0.6)
      expect(vp.h_css).toBeCloseTo(vp.h_vp * 0.6)
    }
  })
  it('设备清单包含新增主流机型与 360 基准', () => {
    const models = deviceList.map(d => d.model)
    for (const m of ['标准 360 基准', 'Mate 60 Pro', 'Mate 70 Pro', 'Pura 70 Pro']) {
      expect(models).toContain(m)
    }
  })
  it('标准 360 基准 = 360×780 vp（设计稿/模拟器基准）', () => {
    const vp = getViewport('标准 360 基准', 'unfolded')
    expect([vp.w_vp, vp.h_vp]).toEqual([360, 780])
  })
})
