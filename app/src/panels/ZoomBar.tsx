import { useStore } from '../store/store'

/**
 * 画布左上缩放条：− / 百分比（点按重置 100%）/ + / 适应窗口。
 * 「适应」为常开模式（默认）：缩放随窗口与设备自动计算；手动 −/+ 即退出该模式。
 */
export function ZoomBar({ effZoom }: { effZoom: number }) {
  const fitMode = useStore(s => s.fitMode)
  const setFitMode = useStore(s => s.setFitMode)
  const setZoom = useStore(s => s.setZoom)

  /** 手动缩放：退出自适应，以当前有效缩放为起点 */
  function manual(z: number) {
    setFitMode(false)
    setZoom(z)
  }

  return (
    <div className="zoom-bar">
      <button onClick={() => manual(effZoom - 0.25)} disabled={!fitMode && effZoom <= 0.2} title="缩小">−</button>
      <button className="zoom-val" title="重置为 100%" onClick={() => manual(1)}>{Math.round(effZoom * 100)}%</button>
      <button onClick={() => manual(effZoom + 0.25)} disabled={!fitMode && effZoom >= 2} title="放大">+</button>
      <button className={fitMode ? 'active' : ''} onClick={() => setFitMode(true)} title="缩放自动适应窗口">适应</button>
    </div>
  )
}
