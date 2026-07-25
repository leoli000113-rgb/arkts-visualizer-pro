import React, { CSSProperties } from 'react'
import { ArgVal, IRNode, IRState } from '../ir/types'
import { numModifier, Path } from '../ir/mutate'
import { startResize } from './resize'
import { DropTarget, beginMaybeMove } from '../editor/dnd'
import { useStore } from '../store/store'

/** 打开节点右键菜单（模块内便捷调用，避免每处重复 getState） */
export function openContextMenu(x: number, y: number, path: Path) {
  useStore.getState().openContextMenu(x, y, path)
}

/**
 * 渲染器共享层：单位换算 / ArgVal 取值 / styleOf 修饰符映射 / 选中·把手·落点框架 /
 * @State 轻量求值（禁 eval，仅识别字面量形态）/ If-Else 配对。
 * 供 Renderer.tsx 与 containers/forms/feedback/flow 各组件组共用。
 */

export const VP_TO_CSS = 0.6
export const vp = (n: number) => n * VP_TO_CSS

export function num(a: ArgVal | undefined): number | undefined {
  return a && a.t === 'num' ? a.v : undefined
}
export function len(a: ArgVal | undefined): string | number | undefined {
  if (!a) return undefined
  if (a.t === 'num') return vp(a.v)
  if (a.t === 'str') return a.v
  return undefined
}
/** HarmonyOS Color 枚举 → CSS 颜色（浅色主题默认色值） */
export const COLOR_ENUM: Record<string, string> = {
  'Color.Black': '#000000',
  'Color.Blue': '#0000FF',
  'Color.Brown': '#A52A2A',
  'Color.Gray': '#808080',
  'Color.Grey': '#808080',
  'Color.Green': '#008000',
  'Color.Orange': '#FFA500',
  'Color.Pink': '#FFC0CB',
  'Color.Red': '#FF0000',
  'Color.White': '#FFFFFF',
  'Color.Yellow': '#FFFF00',
  'Color.Transparent': '#00000000',
}

/**
 * ArkTS 颜色 → CSS 颜色。
 * 数值 ≤ 0xFFFFFF 为不透明 RGB；8 位值为 AARRGGBB（ArkTS）→ RRGGBBAA（CSS）通道重排。
 */
export function color(a: ArgVal | undefined): string | undefined {
  if (!a) return undefined
  if (a.t === 'hex') {
    if (a.v > 0xFFFFFF) {
      const alpha = (a.v >>> 24) & 0xFF
      const rgb = a.v & 0xFFFFFF
      return '#' + rgb.toString(16).toUpperCase().padStart(6, '0') + alpha.toString(16).toUpperCase().padStart(2, '0')
    }
    return '#' + a.v.toString(16).toUpperCase().padStart(6, '0')
  }
  if (a.t === 'enum') return COLOR_ENUM[a.v]
  // 字符串颜色（'#4a5568' / 'rgba(255,255,255,0.8)' 等）原样直通 CSS
  if (a.t === 'str') return a.v
  return undefined
}
export function box(a: ArgVal | undefined): string | undefined {
  if (!a) return undefined
  if (a.t === 'num') return `${vp(a.v)}px`
  if (a.t === 'obj') {
    const o = a.v
    const top = num(o.top) ?? 0
    const right = num(o.right) ?? num(o.horizontal) ?? 0
    const bottom = num(o.bottom) ?? 0
    const left = num(o.left) ?? num(o.horizontal) ?? 0
    return `${vp(top)}px ${vp(right)}px ${vp(bottom)}px ${vp(left)}px`
  }
  return undefined
}
export function flexJustify(a: ArgVal | undefined): CSSProperties['justifyContent'] {
  if (!a || a.t !== 'enum') return undefined
  switch (a.v) {
    case 'FlexAlign.Center': return 'center'
    case 'FlexAlign.Start': return 'flex-start'
    case 'FlexAlign.End': return 'flex-end'
    case 'FlexAlign.SpaceBetween': return 'space-between'
    case 'FlexAlign.SpaceAround': return 'space-around'
    case 'FlexAlign.SpaceEvenly': return 'space-evenly'
    default: return undefined
  }
}
export function alignItems(a: ArgVal | undefined): CSSProperties['alignItems'] {
  if (!a || a.t !== 'enum') return undefined
  switch (a.v) {
    case 'VerticalAlign.Center': case 'HorizontalAlign.Center': return 'center'
    case 'VerticalAlign.Top': case 'HorizontalAlign.Start': return 'flex-start'
    case 'VerticalAlign.Bottom': case 'HorizontalAlign.End': return 'flex-end'
    default: return undefined
  }
}
/** Flex 构造参数 alignItems 使用 ItemAlign.* 枚举 */
export function itemAlign(a: ArgVal | undefined): CSSProperties['alignItems'] {
  if (!a || a.t !== 'enum') return undefined
  switch (a.v) {
    case 'ItemAlign.Start': return 'flex-start'
    case 'ItemAlign.Center': return 'center'
    case 'ItemAlign.End': return 'flex-end'
    case 'ItemAlign.Stretch': return 'stretch'
    case 'ItemAlign.Baseline': return 'baseline'
    default: return undefined
  }
}
function fontWeight(a: ArgVal | undefined): CSSProperties['fontWeight'] {
  if (!a) return undefined
  if (a.t === 'num') return a.v
  if (a.t !== 'enum') return undefined
  switch (a.v) {
    case 'FontWeight.Bold': case 'FontWeight.Bolder': return 700
    case 'FontWeight.Medium': return 500
    case 'FontWeight.Regular': case 'FontWeight.Normal': return 400
    case 'FontWeight.Light': case 'FontWeight.Lighter': return 300
    default: return undefined
  }
}
function textAlign(a: ArgVal | undefined): CSSProperties['textAlign'] {
  if (!a || a.t !== 'enum') return undefined
  switch (a.v) {
    case 'TextAlign.Center': return 'center'
    case 'TextAlign.Start': return 'start'
    case 'TextAlign.End': return 'end'
    case 'TextAlign.JUSTIFY': case 'TextAlign.Justify': return 'justify'
    default: return undefined
  }
}
/** Stack 构造参数 alignContent：Alignment.* 九宫格 → 子绝放层的 flex 对齐 */
export function stackAlign(a: ArgVal | undefined): Pick<CSSProperties, 'justifyContent' | 'alignItems'> {
  if (!a || a.t !== 'enum') return { justifyContent: 'center', alignItems: 'center' }
  const v = a.v.replace('Alignment.', '')
  const justifyContent = v.includes('Start') ? 'flex-start' : v.includes('End') ? 'flex-end' : 'center'
  const alignItems = v.startsWith('Top') ? 'flex-start' : v.startsWith('Bottom') ? 'flex-end' : 'center'
  return { justifyContent, alignItems }
}

export function styleOf(node: IRNode, noMargin = false): CSSProperties {
  const s: CSSProperties = {}
  for (const m of node.modifiers) {
    const a0 = m.args[0]
    switch (m.name) {
      case 'width': s.width = len(a0); break
      case 'height': s.height = len(a0); break
      case 'padding': s.padding = box(a0); break
      case 'margin': if (!noMargin) s.margin = box(a0); break
      case 'backgroundColor': s.backgroundColor = color(a0); break
      case 'fontSize': if (num(a0) != null) s.fontSize = vp(num(a0)!); break
      case 'fontColor': s.color = color(a0); break
      case 'borderRadius': if (num(a0) != null) s.borderRadius = vp(num(a0)!); break
      case 'justifyContent': s.justifyContent = flexJustify(a0); break
      case 'alignItems': s.alignItems = alignItems(a0); break
      case 'objectFit':
        if (a0 && a0.t === 'enum') s.objectFit = a0.v.replace('ImageFit.', '').toLowerCase() as CSSProperties['objectFit']; break
      case 'fontWeight': { const w = fontWeight(a0); if (w != null) s.fontWeight = w; break }
      case 'textAlign': { const t = textAlign(a0); if (t) s.textAlign = t; break }
      case 'maxLines':
        if (num(a0) != null && num(a0)! > 0) {
          (s as any).display = '-webkit-box'
          ;(s as any).WebkitBoxOrient = 'vertical'
          s.WebkitLineClamp = num(a0)
          s.overflow = 'hidden'
        }
        break
      case 'layoutWeight':
        if (num(a0) != null) {
          s.flexGrow = num(a0)!
          s.flexShrink = 1
          s.flexBasis = 0
          s.minWidth = 0
          s.minHeight = 0
        }
        break
      case 'opacity': if (num(a0) != null) s.opacity = num(a0)!; break
      case 'borderWidth':
        if (num(a0) != null) { s.borderWidth = vp(num(a0)!); s.borderStyle = 'solid' }
        break
      case 'borderColor': { const c = color(a0); if (c) { s.borderColor = c; s.borderStyle = 'solid' } break }
      // —— 通用布局/定位属性 ——
      case 'position': {
        // 绝对定位（相对父级）：.position({ x, y })
        const x = a0 && a0.t === 'obj' ? num(a0.v.x) : undefined
        const y = a0 && a0.t === 'obj' ? num(a0.v.y) : undefined
        s.position = 'absolute'
        if (x != null) s.left = vp(x)
        if (y != null) s.top = vp(y)
        break
      }
      case 'offset': {
        // 相对自身布局位置的偏移：.offset({ x, y })
        const x = a0 && a0.t === 'obj' ? num(a0.v.x) : undefined
        const y = a0 && a0.t === 'obj' ? num(a0.v.y) : undefined
        s.transform = `translate(${vp(x ?? 0)}px, ${vp(y ?? 0)}px)`
        break
      }
      case 'zIndex': if (num(a0) != null) s.zIndex = num(a0)!; break
      case 'alignSelf': { const v = itemAlign(a0); if (v) s.alignSelf = v; break }
      case 'visibility':
        if (a0 && a0.t === 'enum') {
          if (a0.v === 'Visibility.Hidden') s.visibility = 'hidden'
          else if (a0.v === 'Visibility.None') s.display = 'none'
        }
        break
      case 'aspectRatio': if (num(a0) != null) s.aspectRatio = String(num(a0)!); break
      case 'constraintSize':
        if (a0 && a0.t === 'obj') {
          const o = a0.v
          if (num(o.minWidth) != null) s.minWidth = vp(num(o.minWidth)!)
          if (num(o.maxWidth) != null) s.maxWidth = vp(num(o.maxWidth)!)
          if (num(o.minHeight) != null) s.minHeight = vp(num(o.minHeight)!)
          if (num(o.maxHeight) != null) s.maxHeight = vp(num(o.maxHeight)!)
        }
        break
      case 'size':
        if (a0 && a0.t === 'obj') {
          if (num(a0.v.width) != null) s.width = vp(num(a0.v.width)!)
          if (num(a0.v.height) != null) s.height = vp(num(a0.v.height)!)
        }
        break
      case 'flexGrow': if (num(a0) != null) s.flexGrow = num(a0)!; break
      case 'flexShrink': if (num(a0) != null) s.flexShrink = num(a0)!; break
      case 'flexBasis': if (num(a0) != null) s.flexBasis = vp(num(a0)!); break
      case 'enabled':
        // 禁用态：调暗呈现（编辑器仍需 pointer 事件以便选中，故不拦截事件）
        if (a0 && a0.t === 'bool' && !a0.v) s.opacity = 0.4
        break
      case 'type': // Button .type(ButtonType.*)
        if (a0 && a0.t === 'enum') {
          if (a0.v === 'ButtonType.Capsule') s.borderRadius = 999
          else if (a0.v === 'ButtonType.Normal') s.borderRadius = 4
          else if (a0.v === 'ButtonType.Circle') s.borderRadius = '50%'
        }
        break
      default: break
    }
  }
  return s
}

export function ctorObj(node: IRNode): Record<string, ArgVal> | undefined {
  const a = node.ctorArgs[0]
  return a && a.t === 'obj' ? a.v : undefined
}
export function firstStr(node: IRNode): string | undefined {
  const a = node.ctorArgs[0]
  return a && a.t === 'str' ? a.v : undefined
}

export function eqPath(a: Path | null, b: Path): boolean {
  if (!a) return false
  if (a.length !== b.length) return false
  return a.every((x, i) => x === b[i])
}
export function keyOf(p: Path): string {
  return p.join('.')
}

export function handlesFor(node: IRNode, path: Path): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const hasW = numModifier(node, 'width') != null
  const hasH = numModifier(node, 'height') != null
  if (hasW) {
    out.push(<div key="he" className="handle handle-e" title="拖拽改宽度" onPointerDown={(e) => startResize(path, 'width', e)} />)
  }
  if (hasH) {
    out.push(<div key="hs" className="handle handle-s" title="拖拽改高度" onPointerDown={(e) => startResize(path, 'height', e)} />)
  }
  if (hasW && hasH) {
    out.push(<div key="hse" className="handle handle-se" title="拖拽同时改宽高" onPointerDown={(e) => startResize(path, 'both', e)} />)
  }
  return out
}

export function dropIndicator(pos: 'before' | 'after' | 'inside' | null): React.ReactNode {
  if (!pos) return null
  if (pos === 'inside') return <div key="di" className="drop-inside" />
  const cls = pos === 'before' ? 'drop-line drop-line-top' : 'drop-line drop-line-bottom'
  return <div key="di" className={cls} />
}

// ---------- 渲染上下文 ----------

/** renderNode 的可选环境：显式传入 @State 表与辅助标记（SSR 测试等无 store 场景） */
export interface RenderEnv { states?: IRState[]; aids?: boolean }

export interface RenderCtx {
  selectedPath: Path | null
  onSelect: (p: Path) => void
  dropTarget: DropTarget | null
  states: IRState[]
  /** 辅助标记：false 时隐藏 ƒ/if/ForEach 角标、折叠占位与 builder 标签（页面即所得） */
  aids: boolean
  render: (c: IRNode, p: Path, noMargin?: boolean) => React.ReactNode
  /** 按 If/Else 配对规则渲染子节点序列（路径保持原始下标） */
  renderChildren: (n: IRNode, p: Path) => React.ReactNode[]
}

export interface ViewProps {
  node: IRNode
  path: Path
  ctx: RenderCtx
  noMargin?: boolean
}

export interface Frame {
  sel: boolean
  dropPos: 'before' | 'after' | 'inside' | null
  common: {
    'data-path': string
    onClick: (e: React.MouseEvent) => void
    onPointerDown: (e: React.PointerEvent) => void
  }
  handles: React.ReactNode[]
  indicator: React.ReactNode
  style: CSSProperties
}

/** 与现有 7 种组件完全一致的选中高亮 / 尺寸把手 / 落点指示框架 */
export function frameOf(node: IRNode, path: Path, ctx: RenderCtx, noMargin = false): Frame {
  const sel = eqPath(ctx.selectedPath, path)
  const onClick = (e: React.MouseEvent) => { e.stopPropagation(); ctx.onSelect(path) }
  const dropPos = ctx.dropTarget && eqPath(ctx.dropTarget.path, path) ? ctx.dropTarget.pos : null
  const common = {
    'data-path': keyOf(path),
    onClick,
    onPointerDown: (e: React.PointerEvent) => beginMaybeMove(path, e),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ctx.onSelect(path) // 右键即选中，菜单操作目标与选中态一致
      openContextMenu(e.clientX, e.clientY, path)
    },
  }
  const selStyle: CSSProperties = sel || dropPos ? { position: 'relative' } : {}
  if (sel) { selStyle.outline = '2px solid #3a6df0'; selStyle.outlineOffset = '-2px' }
  const handles = sel ? handlesFor(node, path) : []
  const indicator = dropIndicator(dropPos)
  const style = { ...styleOf(node, noMargin), ...selStyle }
  return { sel, dropPos, common, handles, indicator, style }
}

// ---------- @State 轻量求值（禁 eval） ----------

export function findState(states: IRState[], name: string): IRState | undefined {
  return states.find(s => s.name === name)
}

export function resolveNum(a: ArgVal | undefined, states: IRState[]): number | undefined {
  if (!a) return undefined
  if (a.t === 'num') return a.v
  if (a.t === 'enum') {
    const m = a.v.match(/^this\.(\w+)$/)
    if (!m) return undefined
    const st = findState(states, m[1])
    return st && st.init.t === 'num' ? st.init.v : undefined
  }
  return undefined
}

export function resolveStr(a: ArgVal | undefined, states: IRState[]): string | undefined {
  if (!a) return undefined
  if (a.t === 'str') return a.v
  if (a.t === 'enum') {
    const m = a.v.match(/^this\.(\w+)$/)
    if (!m) return undefined
    const st = findState(states, m[1])
    return st && st.init.t === 'str' ? st.init.v : undefined
  }
  return undefined
}

export function resolveBool(a: ArgVal | undefined, states: IRState[]): boolean | undefined {
  if (!a) return undefined
  if (a.t === 'bool') return a.v
  if (a.t === 'enum') {
    const m = a.v.match(/^this\.(\w+)$/)
    if (!m) return undefined
    const st = findState(states, m[1])
    return st && st.init.t === 'bool' ? st.init.v : undefined
  }
  if (a.t === 'raw') {
    const raw = a.v.trim()
    const paren = raw.match(/^\(\s*this\.(\w+)\s*\)$/)
    if (paren) {
      const st = findState(states, paren[1])
      return st && st.init.t === 'bool' ? st.init.v : undefined
    }
    // this.x === 0 形态：与 @State 数值初值比较
    const cmp = raw.match(/this\.(\w+)\s*={2,3}\s*(-?\d+(?:\.\d+)?)/)
    if (cmp) {
      const st = findState(states, cmp[1])
      return st && st.init.t === 'num' ? st.init.v === parseFloat(cmp[2]) : undefined
    }
    if (/\btrue\b/.test(raw)) return true
    if (/\bfalse\b/.test(raw)) return false
  }
  return undefined
}

// ---------- If / Else 配对 ----------

/** If 是否折叠：条件原文含 false 字面量，或条件为 (this.x) 且对应 @State 初值为 false */
export function ifCollapsed(ifNode: IRNode, states: IRState[]): boolean {
  const a = ifNode.ctorArgs[0]
  const raw = a && a.t === 'raw' ? a.v : ''
  if (/\bfalse\b/.test(raw)) return true
  const m = raw.match(/^\(\s*(!?)\s*this\.(\w+)\s*\)$/)
  if (m) {
    const st = findState(states, m[2])
    if (st && st.init.t === 'bool') return m[1] === '!' ? st.init.v : !st.init.v
  }
  return false
}

/** 子节点序列按 If/Else 配对过滤：Else 仅在紧随的 If 折叠时保留（路径下标不变） */
export function visibleChildren(children: IRNode[], states: IRState[]): { c: IRNode; i: number }[] {
  const out: { c: IRNode; i: number }[] = []
  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    if (c.type === 'Else') {
      const prev = children[i - 1]
      if (prev && prev.type === 'If' && !ifCollapsed(prev, states)) continue
    }
    out.push({ c, i })
  }
  return out
}
