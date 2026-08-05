import { describe, it, expect } from 'vitest'
import { pxPerVp } from './scale'
import { useStore } from '../store/store'

// px↔vp 换算必须跟随画布「实际生效缩放」（effZoom，含自适应 fit），
// 否则 fitMode 下拖拽位移/落点/调尺寸与画布显示不成比例
describe('pxPerVp：px↔vp 换算口径', () => {
  it('默认 effZoom=1 → 1vp = 0.6 CSS px', () => {
    useStore.getState().setEffZoom(1)
    expect(pxPerVp()).toBeCloseTo(0.6)
  })
  it('effZoom 变化（自适应/手动缩放）→ 换算同步变化', () => {
    useStore.getState().setEffZoom(1.68)
    expect(pxPerVp()).toBeCloseTo(0.6 * 1.68)
    useStore.getState().setEffZoom(0.5)
    expect(pxPerVp()).toBeCloseTo(0.3)
    useStore.getState().setEffZoom(1)
  })
  it('setEffZoom 拒绝非正值（0/负数会破坏除法）', () => {
    useStore.getState().setEffZoom(1.2)
    useStore.getState().setEffZoom(0)
    expect(useStore.getState().effZoom).toBe(1.2)
    useStore.getState().setEffZoom(1)
  })
})
