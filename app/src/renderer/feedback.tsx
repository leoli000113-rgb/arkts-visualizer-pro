import React from 'react'
import { getModifier, numModifier } from '../ir/mutate'
import { ViewProps, frameOf, ctorObj, resolveNum, resolveColor, resolveMediaRef, vp } from './shared'

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

/** Video({ src })：src 可解析（导入媒体/URL）→ 真视频渲染；否则占位框 + src 标注（深色底） */
export function VideoView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const url = resolveMediaRef(o?.src ?? node.ctorArgs[0], ctx.res.media)
  if (url) {
    return (
      <div {...f.common} style={{ display: 'flex', overflow: 'hidden', background: '#000', ...f.style }}>
        <video src={url} controls muted playsInline preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        {f.indicator}
        {f.handles}
      </div>
    )
  }
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

/** Divider：默认水平分割线（1px #E5E5E5 全宽）；.vertical(true) 竖线；.strokeWidth/.color 可覆盖 */
export function DividerView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const v = getModifier(node, 'vertical')?.args[0]
  const isV = !!(v && v.t === 'bool' && v.v)
  const sw = numModifier(node, 'strokeWidth')
  const thick = sw != null ? vp(sw) : 1
  const col = resolveColor(getModifier(node, 'color')?.args[0], ctx.states, ctx.res) ?? '#E5E5E5'
  return (
    <div {...f.common} style={{
      flexShrink: 0,
      width: isV ? thick : '100%',
      height: isV ? '100%' : thick,
      alignSelf: isV ? 'stretch' : undefined,
      backgroundColor: col,
      ...f.style,
    }}>
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Blank：弹性占位（撑满剩余空间；编辑器里给一个最小可点选尺寸） */
export function BlankView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  return (
    <div {...f.common} style={{ flexGrow: 1, flexShrink: 1, minWidth: 8, minHeight: 8, ...f.style }}>
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Rating({ rating, indicator })：五星展示，实心数 = round(rating) */
export function RatingView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const rating = resolveNum(o?.rating, ctx.states) ?? 0
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <div {...f.common} style={{ display: 'inline-flex', gap: 2, ...f.style }}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} style={{ color: i < full ? '#FFA000' : '#E5E5E5', fontSize: '1.5em', lineHeight: 1 }}>★</span>
      ))}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** LoadingProgress()：旋转菊花（.color 可覆盖） */
export function LoadingProgressView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const c = resolveColor(getModifier(node, 'color')?.args[0], ctx.states, ctx.res) ?? '#3b82f6'
  return (
    <div {...f.common} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...f.style }}>
      <span className="ir-loading" style={{ color: c }} />
      {f.indicator}
      {f.handles}
    </div>
  )
}
