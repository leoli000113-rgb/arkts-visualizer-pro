import { useStore } from '../store/store'

/**
 * 屏幕像素 ↔ vp 的唯一换算口径：1vp = 0.6 CSS px × 画布有效缩放。
 * 必须用 effZoom（含自适应 fit）而非 zoom（手动值）——fitMode 默认开启，
 * 两者不等时拖拽位移 / Stack 落点 / 尺寸调整都会与画布显示不成比例
 * （典型症状：画布上只拖了一点，生成的 vp 偏移在手机上却跑出很远）。
 */
export function pxPerVp(): number {
  return 0.6 * useStore.getState().effZoom
}
