import React from 'react'
import { ViewProps, frameOf, ctorObj, resolveNum } from './shared'

/**
 * 反馈组件组：Progress / Video。
 */

/** Progress({ value, total, type })：Linear 条形；Circular SVG 圆环 */
export function ProgressView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const value = resolveNum(o?.value, ctx.states) ?? 0
  const total = resolveNum(o?.total, ctx.states) ?? 100
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0
  const circular = !!o?.type && o.type.t === 'enum' && o.type.v.includes('Circular')
  if (circular) {
    const R = 15.9155 // 周长 ≈ 100 的标准半径（viewBox 36）
    const C = 2 * Math.PI * R
    return (
      <div {...f.common} style={{ display: 'inline-flex', width: 40, height: 40, ...f.style }}>
        <svg className="ir-progress ir-progress-circular" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={R} fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle cx="18" cy="18" r={R} fill="none" stroke="#0A59F7" strokeWidth="3"
            strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`}
            transform="rotate(-90 18 18)" />
        </svg>
        {f.indicator}
        {f.handles}
      </div>
    )
  }
  return (
    <div {...f.common} style={{ ...f.style }}>
      <div className="ir-progress ir-progress-linear">
        <div className="ir-progress-fill" style={{ width: `${pct * 100}%` }} />
      </div>
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Video({ src })：占位框 + src 标注（沿用 Image 占位策略，深色底） */
export function VideoView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const src = o?.src && o.src.t === 'str' ? o.src.v : ''
  return (
    <div {...f.common} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#999', fontSize: 11, background: '#16181d',
      ...f.style,
    }}>
      [Video: {src}]
      {f.indicator}
      {f.handles}
    </div>
  )
}
