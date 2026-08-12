import { useStore } from '../store/store'
import { VP_TO_CSS } from '../renderer/shared'
import { hdcStreamUrl } from '../ai/client'

/**
 * 真机画布：MJPEG 像素流 + 透明命中叠加层（按设备 WS 回发的几何图定位）。
 * 设备 snapshotRects 回发 path→{x,y,w,h}（canvas 相对 vp），×0.6 落到 .phone-screen 的 css px。
 * P2 只读选中：点命中区 → 选中节点（命中区取最深/最小矩形优先）。拖拽/落点 P3/P4 接入。
 *
 * 对齐前提（P5 校准）：设备 previewMode 全屏沉浸后，geo 原点 = 屏幕左上 = MJPEG 原点，
 * 且 .phone-screen 宽高 = 真机 vp × 0.6（profile vp 与真机 vp 一致时成立，否则竖向漂移）。
 */
export function RealDeviceCanvas({ vp, selectedPath, setSelected }: {
  vp: { w_css: number; h_css: number }
  selectedPath: number[] | null
  setSelected: (p: number[] | null) => void
}) {
  const geo = useStore(s => s.geo)
  const selKey = selectedPath ? selectedPath.join('.') : ''

  // 命中区按面积升序排：小的（叶节点）在后渲染、叠在上层，点击优先命中最深节点
  const entries = Array.from(geo.entries()).sort((a, b) => {
    const sa = a[1].w * a[1].h
    const sb = b[1].w * b[1].h
    return sa - sb
  })

  return (
    <div className="real-canvas" style={{ position: 'relative', width: vp.w_css, height: vp.h_css, overflow: 'hidden', background: '#000' }}>
      <img src={hdcStreamUrl} alt="真机 ArkUI 预览" draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', userSelect: 'none' }} />
      {entries.map(([key, r]) => {
        const cleanKey = key.split('#')[0]
        const isSel = cleanKey === selKey && selKey !== ''
        return (
          <div key={key} title={key}
            onClick={(e) => { e.stopPropagation(); setSelected(pathFromGeoKey(key)) }}
            onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); setSelected(pathFromGeoKey(key)) }}
            style={{
              position: 'absolute',
              left: r.x * VP_TO_CSS, top: r.y * VP_TO_CSS,
              width: r.w * VP_TO_CSS, height: r.h * VP_TO_CSS,
              cursor: 'pointer',
              boxSizing: 'border-box',
              border: isSel ? '2px solid #ff3b30' : '1px solid rgba(0,122,255,0.18)',
              background: isSel ? 'rgba(255,59,48,0.10)' : 'transparent',
            }} />
        )
      })}
    </div>
  )
}

/** geo key（可能带 ForEach #k 后缀）→ 干净 IR Path。root 空串 → []。 */
function pathFromGeoKey(k: string): number[] {
  const clean = k.split('#')[0]
  if (clean === '') return []
  return clean.split('.').map(Number)
}
