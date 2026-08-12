import { useStore } from '../store/store'
import { VP_TO_CSS, keyOf } from '../renderer/shared'
import { hdcStreamUrl } from '../ai/client'
import { getNodeAtPath } from '../ir/mutate'
import type { IRFile } from '../ir/types'
import type { DropTarget as DT } from '../editor/dnd'

/**
 * 真机画布：MJPEG 像素流 + 透明命中叠加层（按设备 WS 回发的几何图定位）。
 * 设备 snapshotRects 回发 path→{x,y,w,h}（canvas 相对 vp），×0.6 落到 .phone-screen 的 css px。
 * P2 只读选中 + P3 落点指示/nudge 描边（dnd 已迁 geo，dropTarget/selectedPath/nudge 都按 geo 画）。
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
  const dropTarget = useStore(s => s.dropTarget)
  const nudgePath = useStore(s => s.nudgePath)
  const ir = useStore(s => s.ir)
  const selKey = selectedPath ? selectedPath.join('.') : ''
  const nudgeKey = nudgePath ? nudgePath.join('.') : ''

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
        const isNudge = cleanKey === nudgeKey && nudgeKey !== ''
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
              border: isSel ? '2px solid #ff3b30' : isNudge ? '2px solid #ff9500' : '1px solid rgba(0,122,255,0.18)',
              background: isSel ? 'rgba(255,59,48,0.10)' : isNudge ? 'rgba(255,149,0,0.08)' : 'transparent',
            }} />
        )
      })}
      {/* 落点指示（dnd dropTarget）：inside=容器虚框；before/after=兄弟边线；Stack at=十字标 */}
      {dropTarget && <DropIndicator dt={dropTarget} geo={geo} ir={ir} />}
    </div>
  )
}

/** 落点指示叠加：按 geo 矩形定位（vp×0.6 落 css px）。 */
function DropIndicator({ dt, geo, ir }: { dt: DT; geo: Map<string, { x: number; y: number; w: number; h: number }>; ir: IRFile | null }) {
  const r = geo.get(keyOf(dt.path))
  if (!r) return null
  const L = r.x * VP_TO_CSS
  const T = r.y * VP_TO_CSS
  const W = r.w * VP_TO_CSS
  const H = r.h * VP_TO_CSS
  // 父容器类型决定 before/after 是横向（上下沿）还是纵向（左右沿）
  const parent = ir && dt.parent.length ? getNodeAtPath(ir.root, dt.parent) : null
  const horiz = !!(parent && parent.type === 'Row')

  if (dt.pos === 'inside') {
    return <div style={{ position: 'absolute', left: L, top: T, width: W, height: H, boxSizing: 'border-box', border: '2px dashed #0091ff', background: 'rgba(0,145,255,0.10)', pointerEvents: 'none' }} />
  }
  if (dt.pos === 'before') {
    // Row: 左沿竖线；其余: 上沿横线
    return horiz
      ? <div style={{ position: 'absolute', left: L - 1, top: T, width: 3, height: H, background: '#0091ff', pointerEvents: 'none' }} />
      : <div style={{ position: 'absolute', left: L, top: T - 1, width: W, height: 3, background: '#0091ff', pointerEvents: 'none' }} />
  }
  if (dt.pos === 'after') {
    return horiz
      ? <div style={{ position: 'absolute', left: L + W - 2, top: T, width: 3, height: H, background: '#0091ff', pointerEvents: 'none' }} />
      : <div style={{ position: 'absolute', left: L, top: T + H - 2, width: W, height: 3, background: '#0091ff', pointerEvents: 'none' }} />
  }
  // Stack 自由定位 at（vp，相对容器）：十字标
  if (dt.at && dt.parent.length) {
    const c = geo.get(keyOf(dt.parent))
    if (!c) return null
    const cx = (c.x + dt.at.x) * VP_TO_CSS
    const cy = (c.y + dt.at.y) * VP_TO_CSS
    return <div style={{ position: 'absolute', left: cx - 6, top: cy - 6, width: 12, height: 12, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 5, top: 0, width: 2, height: 12, background: '#0091ff' }} />
      <div style={{ position: 'absolute', left: 0, top: 5, width: 12, height: 2, background: '#0091ff' }} />
    </div>
  }
  return null
}

/** geo key（可能带 ForEach #k 后缀）→ 干净 IR Path。root 空串 → []。 */
function pathFromGeoKey(k: string): number[] {
  const clean = k.split('#')[0]
  if (clean === '') return []
  return clean.split('.').map(Number)
}
