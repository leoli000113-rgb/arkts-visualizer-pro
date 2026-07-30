import { RefObject } from 'react'
import { useStore } from '../store/store'

/** 画布左上缩放条：− / 百分比（点按重置 100%）/ + / 适应窗口 */
export function ZoomBar({ paneRef, w_css, h_css }: {
  paneRef: RefObject<HTMLDivElement | null>
  w_css: number
  h_css: number
}) {
  const zoom = useStore(s => s.zoom)
  const setZoom = useStore(s => s.setZoom)

  /** 适应窗口：按画布可用空间计算缩放（setZoom 内部 clamp 到 0.2–2） */
  function fitZoom() {
    const pane = paneRef.current
    if (!pane) return
    setZoom(Math.min(
      (pane.clientWidth - 80) / (w_css + 20),
      (pane.clientHeight - 80) / (h_css + 20),
    ))
  }

  return (
    <div className="zoom-bar">
      <button onClick={() => setZoom(zoom - 0.25)} disabled={zoom <= 0.2} title="缩小">−</button>
      <button className="zoom-val" title="重置为 100%" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
      <button onClick={() => setZoom(zoom + 0.25)} disabled={zoom >= 2} title="放大">+</button>
      <button onClick={fitZoom} title="缩放以适应窗口">适应</button>
    </div>
  )
}
