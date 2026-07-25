import React, { CSSProperties, useLayoutEffect, useRef, useState } from 'react'
import { IRNode } from '../ir/types'
import { getModifier, Path } from '../ir/mutate'
import { DropTarget } from '../editor/dnd'

interface Rule { anchor: string; align: string }
interface Rules { left?: Rule; right?: Rule; top?: Rule; bottom?: Rule }
interface Box { x: number; y: number; w: number; h: number; sx: boolean; sy: boolean }
interface Margin { top: number; left: number; right: number; bottom: number }

function numArg(a: any): number {
  return a && a.t === 'num' ? a.v : 0
}

const VP = 0.6

function getAlignRules(node: IRNode): Rules {
  const m = getModifier(node, 'alignRules')
  const out: Rules = {}
  if (m && m.args[0] && m.args[0].t === 'obj') {
    const v = m.args[0].v
    for (const k of ['left', 'right', 'top', 'bottom'] as const) {
      const r = v[k]
      if (r && r.t === 'obj' && r.v.anchor && r.v.align) {
        const anchor = r.v.anchor.t === 'str' ? r.v.anchor.v : String(r.v.anchor.v)
        const align = r.v.align.t === 'enum' ? r.v.align.v : String(r.v.align.v)
        out[k] = { anchor, align }
      }
    }
  }
  return out
}

function getMargin(node: IRNode): Margin {
  const m = getModifier(node, 'margin')
  if (!m) return { top: 0, left: 0, right: 0, bottom: 0 }
  const a = m.args[0]
  if (a.t === 'num') return { top: a.v * VP, left: a.v * VP, right: a.v * VP, bottom: a.v * VP }
  if (a.t === 'obj') {
    const o = a.v
    return { top: numArg(o.top) * VP, left: numArg(o.left) * VP, right: numArg(o.right) * VP, bottom: numArg(o.bottom) * VP }
  }
  return { top: 0, left: 0, right: 0, bottom: 0 }
}

function edgeX(anchor: string, align: string, pos: (Box | null)[], cw: number, idToIdx: Record<string, number>): number | null {
  if (anchor === '__container__') {
    if (align.endsWith('Center')) return cw / 2
    if (align.endsWith('End')) return cw
    return 0
  }
  const idx = idToIdx[anchor]
  if (idx === undefined) return 0
  const p = pos[idx]
  if (!p) return null
  if (align.endsWith('Center')) return p.x + p.w / 2
  if (align.endsWith('End')) return p.x + p.w
  return p.x
}

function edgeY(anchor: string, align: string, pos: (Box | null)[], ch: number, idToIdx: Record<string, number>): number | null {
  if (anchor === '__container__') {
    if (align.endsWith('Center')) return ch / 2
    if (align.endsWith('Bottom')) return ch
    return 0
  }
  const idx = idToIdx[anchor]
  if (idx === undefined) return 0
  const p = pos[idx]
  if (!p) return null
  if (align.endsWith('Center')) return p.y + p.h / 2
  if (align.endsWith('Bottom')) return p.y + p.h
  return p.y
}

export interface RelEngineProps {
  node: IRNode
  path: Path
  style: CSSProperties
  selStyle: CSSProperties
  common: any
  handles: React.ReactNode
  indicator: React.ReactNode
  dropTarget: DropTarget | null
  renderChild: (c: IRNode, p: Path) => React.ReactNode
}

export function RelativeContainerEngine(props: RelEngineProps) {
  const { node, path, style, selStyle, common, handles, indicator, renderChild } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const childRefs = useRef<(HTMLDivElement | null)[]>([])
  const [layout, setLayout] = useState<{ left: number; top: number; width?: number; height?: number }[]>([])

  useLayoutEffect(() => {
    const cont = containerRef.current
    if (!cont) return

    const relayout = () => {
      const cw = cont.clientWidth
      const ch = cont.clientHeight
      const nat = childRefs.current.map(r => {
        if (!r) return { w: 0, h: 0 }
        const pw = r.style.width
        const ph = r.style.height
        r.style.width = ''
        r.style.height = ''
        const child = r.firstElementChild as HTMLElement | null
        let w: number, h: number
        if (child) { const rc = child.getBoundingClientRect(); w = rc.width; h = rc.height }
        else { w = r.offsetWidth; h = r.offsetHeight }
        r.style.width = pw
        r.style.height = ph
        return { w, h }
      })
      const idToIdx: Record<string, number> = {}
      node.children.forEach((c, i) => {
        const m = getModifier(c, 'id')
        if (m && m.args[0] && m.args[0].t === 'str') idToIdx[m.args[0].v] = i
      })
      const pos: (Box | null)[] = node.children.map(() => null)
      let progress = true
      let guard = 0
      while (progress && guard++ < node.children.length + 2) {
        progress = false
        for (let i = 0; i < node.children.length; i++) {
          if (pos[i]) continue
          const c = node.children[i]
          const rules = getAlignRules(c)
          const margin = getMargin(c)
          let x: number | null = null
          let w: number | null = null
          let sx = false
          if (rules.left) {
            const e = edgeX(rules.left.anchor, rules.left.align, pos, cw, idToIdx)
            if (e === null) continue
            x = e + margin.left
          }
          if (rules.right) {
            const e = edgeX(rules.right.anchor, rules.right.align, pos, cw, idToIdx)
            if (e === null) continue
            const xr = e - margin.right
            if (x !== null) { w = xr - x; sx = true } else { w = nat[i].w; x = xr - w }
          }
          if (x === null) x = 0
          if (w === null) w = nat[i].w

          let y: number | null = null
          let h: number | null = null
          let sy = false
          if (rules.top) {
            const e = edgeY(rules.top.anchor, rules.top.align, pos, ch, idToIdx)
            if (e === null) continue
            y = e + margin.top
          }
          if (rules.bottom) {
            const e = edgeY(rules.bottom.anchor, rules.bottom.align, pos, ch, idToIdx)
            if (e === null) continue
            const yb = e - margin.bottom
            if (y !== null) { h = yb - y; sy = true } else { h = nat[i].h; y = yb - h }
          }
          if (y === null) y = 0
          if (h === null) h = nat[i].h

          pos[i] = { x, y, w, h, sx, sy }
          progress = true
        }
      }
      setLayout(pos.map(p => p
        ? { left: p.x, top: p.y, width: p.sx ? p.w : undefined, height: p.sy ? p.h : undefined }
        : { left: 0, top: 0 }))
    }

    relayout()
    const ro = new ResizeObserver(() => relayout())
    ro.observe(cont)
    return () => ro.disconnect()
  }, [node])

  return (
    <div ref={containerRef} {...common} style={{ position: 'relative', border: '1px dashed #c9d4e8', ...style, ...selStyle }}>
      {node.children.map((c, i) => (
        <div key={i} ref={el => { childRefs.current[i] = el }}
          style={{ position: 'absolute', display: 'flex', alignItems: 'flex-start', left: layout[i]?.left, top: layout[i]?.top, width: layout[i]?.width, height: layout[i]?.height }}>
          {renderChild(c, [...path, i])}
        </div>
      ))}
      {indicator}
      {handles}
    </div>
  )
}
