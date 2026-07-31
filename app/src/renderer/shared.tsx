import React, { CSSProperties } from 'react'
import { ArgVal, IRFile, IRNode, IRState, Modifier } from '../ir/types'
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

/**
 * $r('app.color.<name>') → 内置语义色表（不读外部项目 color.json）。
 * 名字取 MovieGenerate_2 等常见调色板（紫蓝主色 + 浅灰文本），未命中返回 undefined。
 */
const RESOURCE_COLORS: Record<string, string> = {
  primary: '#667eea',
  text_primary: '#2d3748',
  text_secondary: '#4a5568',
  text_hint: '#a0aec0',
  surface: '#ffffff',
  border: '#e2e8f0',
  error: '#e53e3e',
  warning: '#dd6b20',
  success: '#48bb78',
  bg_gradient_start: '#f0f4ff',
  bg_gradient_end: '#a78bfa',
}

/** 项目资源表：导入工程后由 store 注入 ctx（媒体 dataURL 表 / color.json / string.json） */
export interface RenderRes {
  media: Record<string, string>
  colors: Record<string, string>
  strings: Record<string, string>
}
export const EMPTY_RES: RenderRes = { media: {}, colors: {}, strings: {} }

/** $r('app.color.<name>')：项目 color.json 优先，未命中回退内置语义色表 */
export function resourceColor(a: ArgVal | undefined, projectColors?: Record<string, string>): string | undefined {
  if (!a || a.t !== 'raw') return undefined
  const m = a.v.match(/\$r\(\s*['"]app\.color\.([\w]+)['"]\s*\)/)
  if (!m) return undefined
  return projectColors?.[m[1]] ?? RESOURCE_COLORS[m[1]]
}

/** $r('app.string.<name>') → 项目 string.json 文案（未导入工程时无解） */
export function resourceString(a: ArgVal | undefined, projectStrings?: Record<string, string>): string | undefined {
  if (!a || a.t !== 'raw') return undefined
  const m = a.v.match(/\$r\(\s*['"]app\.string\.([\w]+)['"]\s*\)/)
  return m ? projectStrings?.[m[1]] : undefined
}

/**
 * 媒体引用解析：http(s)/data/blob 直出；$r('app.media.x') / $rawfile('dir/x.png') /
 * 相对路径字符串 → 导入媒体表（按「文件名去扩展名」键）。求不出返回 undefined（走占位）。
 */
export function resolveMediaRef(a: ArgVal | undefined, media: Record<string, string> = {}): string | undefined {
  if (!a) return undefined
  const raw = a.t === 'raw' ? a.v.trim() : a.t === 'str' ? a.v : undefined
  if (!raw) return undefined
  if (/^(https?:|data:|blob:)/.test(raw)) return raw
  const r = raw.match(/\$r\(\s*['"]app\.media\.([\w]+)['"]\s*\)/)
  if (r) return media[r[1]]
  const rf = raw.match(/\$rawfile\(\s*['"]([^'"]+)['"]\s*\)/)
  const path = rf ? rf[1] : raw
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|mp4|webm|mov|m4v|avi|mkv)$/i.test(path)) {
    return media[path.split('/').pop()!.replace(/\.[^.]+$/, '')]
  }
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

export function styleOf(node: IRNode, noMargin = false, states: IRState[] = [], styles: Record<string, Modifier[]> = {}, extendsTable: Record<string, Record<string, Modifier[]>> = {}, res?: RenderRes): CSSProperties {
  const s: CSSProperties = {}
  const tf: string[] = [] // transform 合成（offset/translate/rotate/scale 共存）
  // @Styles/@Extend 展开：0 参数且命中样式表的修饰符调用，就地展开为其修饰符链
  // （@Extend 组件专属样式优先于全局 @Styles；本机后续修饰符自然覆盖）
  let modifiers = node.modifiers
  const styleOfType = extendsTable[node.type]
  if (Object.keys(styles).length || styleOfType) {
    modifiers = []
    for (const m of node.modifiers) {
      const chain = m.args.length === 0 ? (styleOfType?.[m.name] ?? styles[m.name]) : undefined
      if (chain) modifiers.push(...chain)
      else modifiers.push(m)
    }
  }
  // 求值感知版取值：raw 表达式经 evalExpr 小求值后再映射（求不出回退 undefined）
  const numE = (a: ArgVal | undefined): number | undefined => {
    if (!a) return undefined
    if (a.t === 'raw') { const v = evalExpr(a.v, states); return v && v.t === 'num' ? v.v : undefined }
    return num(a)
  }
  const lenE = (a: ArgVal | undefined): string | number | undefined => {
    if (!a) return undefined
    if (a.t === 'raw') { const v = evalExpr(a.v, states); return v ? len(v) : undefined }
    return len(a)
  }
  const colorE = (a: ArgVal | undefined): string | undefined => {
    if (!a) return undefined
    if (a.t === 'raw') {
      const rc = resourceColor(a, res?.colors); if (rc) return rc
      const v = evalExpr(a.v, states); return v ? color(v) : undefined
    }
    return color(a)
  }
  let hasMaxLines = false
  for (const m of modifiers) {
    const a0 = m.args[0]
    switch (m.name) {
      case 'width': s.width = lenE(a0); break
      case 'height': s.height = lenE(a0); break
      case 'padding': s.padding = box(a0); break
      case 'margin': if (!noMargin) s.margin = box(a0); break
      case 'backgroundColor': s.backgroundColor = colorE(a0); break
      case 'fontSize': if (numE(a0) != null) s.fontSize = vp(numE(a0)!); break
      case 'font': {
        // .font({ size: 14, weight, family }) — 只取 size（weight/family 较少用）
        if (a0?.t === 'obj') { const sz = numE(a0.v.size); if (sz != null) s.fontSize = vp(sz!) }
        break
      }
      case 'fontColor': s.color = colorE(a0); break
      case 'borderRadius': if (numE(a0) != null) s.borderRadius = vp(numE(a0)!); break
      case 'justifyContent': s.justifyContent = flexJustify(a0); break
      case 'alignItems': s.alignItems = alignItems(a0); break
      case 'objectFit':
        if (a0 && a0.t === 'enum') s.objectFit = a0.v.replace('ImageFit.', '').toLowerCase() as CSSProperties['objectFit']; break
      case 'fontWeight': { const w = fontWeight(a0); if (w != null) s.fontWeight = w; break }
      case 'fontStyle': if (a0 && a0.t === 'enum' && a0.v === 'FontStyle.Italic') s.fontStyle = 'italic'; break
      case 'fontFamily': if (a0 && a0.t === 'str') s.fontFamily = a0.v; break
      case 'letterSpacing': if (numE(a0) != null) s.letterSpacing = vp(numE(a0)!); break
      case 'lineHeight': if (numE(a0) != null) s.lineHeight = vp(numE(a0)!); break
      case 'textAlign': { const t = textAlign(a0); if (t) s.textAlign = t; break }
      case 'maxLines':
        if (numE(a0) != null && numE(a0)! > 0) {
          hasMaxLines = true
          ;(s as any).display = '-webkit-box'
          ;(s as any).WebkitBoxOrient = 'vertical'
          s.WebkitLineClamp = numE(a0)
          s.overflow = 'hidden'
        }
        break
      case 'textOverflow':
        if (a0 && a0.t === 'enum' && a0.v.includes('Ellipsis')) s.textOverflow = 'ellipsis'
        break
      case 'layoutWeight':
        if (numE(a0) != null) {
          s.flexGrow = numE(a0)!
          s.flexShrink = 1
          s.flexBasis = 0
          s.minWidth = 0
          s.minHeight = 0
        }
        break
      case 'opacity': if (numE(a0) != null) s.opacity = numE(a0)!; break
      case 'borderWidth':
        if (numE(a0) != null) { s.borderWidth = vp(numE(a0)!); s.borderStyle = 'solid' }
        break
      case 'borderColor': { const c = colorE(a0); if (c) { s.borderColor = c; s.borderStyle = 'solid' } break }
      case 'border':
        // .border({ width, color, radius, style })（逐边写法暂不展开）
        if (a0 && a0.t === 'obj') {
          const o = a0.v
          if (numE(o.width) != null) { s.borderWidth = vp(numE(o.width)!); s.borderStyle = 'solid' }
          const c = colorE(o.color); if (c) { s.borderColor = c; s.borderStyle = 'solid' }
          if (numE(o.radius) != null) s.borderRadius = vp(numE(o.radius)!)
          if (o.style && o.style.t === 'enum') s.borderStyle = o.style.v.replace('BorderStyle.', '').toLowerCase()
        }
        break
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
        tf.push(`translate(${vp(x ?? 0)}px, ${vp(y ?? 0)}px)`)
        break
      }
      case 'translate': {
        const x = a0 && a0.t === 'obj' ? num(a0.v.x) : undefined
        const y = a0 && a0.t === 'obj' ? num(a0.v.y) : undefined
        tf.push(`translate(${vp(x ?? 0)}px, ${vp(y ?? 0)}px)`)
        break
      }
      case 'rotate': {
        // .rotate({ x, y, z, angle }) → rotate3d；仅 angle → rotate
        if (a0 && a0.t === 'obj') {
          const ang = num(a0.v.angle)
          if (ang != null) {
            const rx = num(a0.v.x) ?? 0
            const ry = num(a0.v.y) ?? 0
            const rz = num(a0.v.z) ?? 0
            tf.push(rx || ry || rz ? `rotate3d(${rx}, ${ry}, ${rz || 1}, ${ang}deg)` : `rotate(${ang}deg)`)
          }
        }
        break
      }
      case 'scale': {
        if (a0 && a0.t === 'obj') {
          const sx = num(a0.v.x)
          const sy = num(a0.v.y)
          if (sx != null || sy != null) tf.push(`scale(${sx ?? 1}, ${sy ?? sx ?? 1})`)
        }
        break
      }
      case 'zIndex': if (numE(a0) != null) s.zIndex = numE(a0)!; break
      case 'alignSelf': { const v = itemAlign(a0); if (v) s.alignSelf = v; break }
      case 'visibility':
        if (a0 && a0.t === 'enum') {
          if (a0.v === 'Visibility.Hidden') s.visibility = 'hidden'
          else if (a0.v === 'Visibility.None') s.display = 'none'
        }
        break
      case 'aspectRatio': if (numE(a0) != null) s.aspectRatio = String(numE(a0)!); break
      case 'constraintSize':
        if (a0 && a0.t === 'obj') {
          const o = a0.v
          if (numE(o.minWidth) != null) s.minWidth = vp(numE(o.minWidth)!)
          if (numE(o.maxWidth) != null) s.maxWidth = vp(numE(o.maxWidth)!)
          if (numE(o.minHeight) != null) s.minHeight = vp(numE(o.minHeight)!)
          if (numE(o.maxHeight) != null) s.maxHeight = vp(numE(o.maxHeight)!)
        }
        break
      case 'size':
        if (a0 && a0.t === 'obj') {
          if (numE(a0.v.width) != null) s.width = vp(numE(a0.v.width)!)
          if (numE(a0.v.height) != null) s.height = vp(numE(a0.v.height)!)
        }
        break
      case 'flexGrow': if (numE(a0) != null) s.flexGrow = numE(a0)!; break
      case 'flexShrink': if (numE(a0) != null) s.flexShrink = numE(a0)!; break
      case 'flexBasis': if (numE(a0) != null) s.flexBasis = vp(numE(a0)!); break
      case 'clip': if (a0 && a0.t === 'bool' && a0.v) s.overflow = 'hidden'; break
      case 'blur': if (numE(a0) != null) s.filter = `blur(${vp(numE(a0)!)}px)`; break
      case 'backdropBlur': if (numE(a0) != null) s.backdropFilter = `blur(${vp(numE(a0)!)}px)`; break
      case 'shadow': {
        // .shadow({ radius, color, offsetX, offsetY })
        if (a0 && a0.t === 'obj') {
          const o = a0.v
          const r = num(o.radius) ?? 10
          const ox = num(o.offsetX) ?? 0
          const oy = num(o.offsetY) ?? 0
          const c = colorE(o.color) ?? 'rgba(0,0,0,0.3)'
          s.boxShadow = `${vp(ox)}px ${vp(oy)}px ${vp(r)}px ${c}`
        }
        break
      }
      case 'linearGradient': {
        // .linearGradient({ angle | direction, colors: [[色, 位置], ...] }) — 位置 0~1
        if (a0 && a0.t === 'obj') {
          const o = a0.v
          // direction: GradientDirection.* → CSS 角度（0=上→下，顺时针）
          let angle = num(o.angle)
          if (angle == null && o.direction && o.direction.t === 'enum') {
            angle = ({ 'GradientDirection.Top': 0, 'GradientDirection.Bottom': 180, 'GradientDirection.Left': 270, 'GradientDirection.Right': 90, 'GradientDirection.TopToBottom': 180, 'GradientDirection.BottomToTop': 0, 'GradientDirection.LeftToRight': 90, 'GradientDirection.RightToLeft': 270 } as Record<string, number>)[o.direction.v]
          }
          if (angle == null) angle = 180
          const raw = o.colors && o.colors.t === 'raw' ? o.colors.v : undefined
          if (raw) {
            const stops: string[] = []
            const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '')
            let ok = true
            for (const t0 of splitTop(inner, ',')) {
              const t = t0.trim()
              if (!t.startsWith('[')) continue
              const pair = t.replace(/^\[/, '').replace(/\]$/, '')
              const ps = splitTop(pair, ',')
              if (ps.length !== 2) { ok = false; break }
              const cv = ps[0].trim()
              const pos = parseFloat(ps[1])
              let c: string | undefined
              const sm = cv.match(/^'(.*)'$/) ?? cv.match(/^"(.*)"$/)
              if (sm) c = sm[1]
              else if (/^0x[0-9a-fA-F]+$/.test(cv)) c = color({ t: 'hex', v: parseInt(cv, 16) })
              else if (/^[A-Za-z]+\.\w+$/.test(cv)) c = color({ t: 'enum', v: cv })
              if (!c || !Number.isFinite(pos)) { ok = false; break }
              stops.push(`${c} ${Math.round(pos * 100)}%`)
            }
            if (ok && stops.length >= 2) s.backgroundImage = `linear-gradient(${angle}deg, ${stops.join(', ')})`
          }
        }
        break
      }
      case 'backgroundImage': {
        // $r('app.media.x')/$rawfile/相对路径 → 导入媒体；普通 url 字符串直通
        const url = resolveMediaRef(a0, res?.media)
        if (url) s.backgroundImage = `url(${url})`
        else if (a0 && a0.t === 'str' && !a0.v.startsWith('$')) s.backgroundImage = `url(${a0.v})`
        break
      }
      case 'backgroundImageSize':
        if (a0 && a0.t === 'enum') {
          const v = a0.v.replace('ImageSize.', '')
          if (v === 'Cover' || v === 'Contain') s.backgroundSize = v.toLowerCase()
          else if (v === 'Auto') s.backgroundSize = 'auto'
        } else if (a0 && a0.t === 'obj') {
          if (num(a0.v.width) != null) s.backgroundSize = `${vp(num(a0.v.width)!)}px`
        }
        break
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
  // 单行省略：未设 maxLines 时 textOverflow 需 nowrap
  if (s.textOverflow === 'ellipsis' && !hasMaxLines) {
    s.whiteSpace = 'nowrap'
    s.overflow = 'hidden'
  }
  if (tf.length) s.transform = tf.join(' ')
  return s
}

/** 求值感知颜色解析：raw 表达式经 evalExpr 小求值后再映射（项目色表优先于内置色表） */
export function resolveColor(a: ArgVal | undefined, states: IRState[], res?: RenderRes): string | undefined {
  if (!a) return undefined
  if (a.t === 'raw') {
    const rc = resourceColor(a, res?.colors); if (rc) return rc
    const v = evalExpr(a.v, states); return v ? color(v) : undefined
  }
  return color(a)
}

export function ctorObj(node: IRNode): Record<string, ArgVal> | undefined {
  const a = node.ctorArgs[0]
  return a && a.t === 'obj' ? a.v : undefined
}
export function firstStr(node: IRNode): string | undefined {
  const a = node.ctorArgs[0]
  return a && a.t === 'str' ? a.v : undefined
}
/** 首构造参数的求值感知版：raw 表达式（三元/拼接/this.x/$r 字符串资源）经小求值取字符串 */
export function firstStrE(node: IRNode, states: IRState[], res?: RenderRes): string | undefined {
  const a = node.ctorArgs[0]
  if (!a) return undefined
  if (a.t === 'str') return a.v
  return resolveStr(a, states, res)
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

/** renderNode 的可选环境：显式传入 @State 表、辅助标记、@Styles/@Extend 表与同文件组件表（SSR 测试等无 store 场景） */
export interface RenderEnv {
  states?: IRState[]
  aids?: boolean
  styles?: Record<string, Modifier[]>
  extends?: Record<string, Record<string, Modifier[]>>
  components?: Record<string, IRFile>
  /** @Builder 定义表（带参调用点只读替换渲染用） */
  builders?: Record<string, { params: string[]; children: IRNode[] }>
  /** 自定义组件嵌套渲染深度（递归引用保护，>3 回退占位卡） */
  depth?: number
  /** 项目资源表（媒体/颜色/字符串）；缺省为空表 */
  res?: RenderRes
}

export interface RenderCtx {
  selectedPath: Path | null
  onSelect: (p: Path) => void
  dropTarget: DropTarget | null
  states: IRState[]
  /** 辅助标记：false 时隐藏 ƒ/if/ForEach 角标、折叠占位与 builder 标签（页面即所得） */
  aids: boolean
  /** @Styles 定义表（styleOf 展开 0 参样式调用用） */
  styles: Record<string, Modifier[]>
  /** @Extend 定义表（组件类型 → 样式名 → 修饰符链） */
  extends: Record<string, Record<string, Modifier[]>>
  /** 同文件自定义组件表（未收录类型按名解析渲染） */
  components: Record<string, IRFile>
  /** @Builder 定义表 */
  builders: Record<string, { params: string[]; children: IRNode[] }>
  depth: number
  /** 项目资源表（媒体/颜色/字符串） */
  res: RenderRes
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
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // 交互预览模式：命中 router 导航（内联或 this.method 间接调用）时执行页面跳转，不做选中
    const st = useStore.getState()
    if (st.interactive) {
      const act = routerActionOf(node, st.methodRoutes)
      if (act) {
        if (act.kind === 'back') st.navigateBack()
        else if (act.url) st.navigateTo(act.url)
        return
      }
    }
    ctx.onSelect(path)
  }
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
  const style = { ...styleOf(node, noMargin, ctx.states, ctx.styles, ctx.extends, ctx.res), ...selStyle }
  return { sel, dropPos, common, handles, indicator, style }
}

// ---------- 表达式与字面量小解析（禁 eval，求不出一律回退） ----------

export function findState(states: IRState[], name: string): IRState | undefined {
  return states.find(s => s.name === name)
}

/** 按单字符分隔符做顶层拆分：忽略引号内与括号嵌套内的分隔符 */
export function splitTop(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ''
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      cur += ch
      if (ch === '\\' && i + 1 < s.length) { cur += s[++i]; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

/** 在顶层查找运算符（引号/括号感知，ops 按先长后短传入），返回起始下标；未找到返回 -1 */
export function findTopOp(s: string, ops: readonly string[]): number {
  let depth = 0
  let quote = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (depth === 0) {
      for (const op of ops) if (s.startsWith(op, i)) return i
    }
  }
  return -1
}

/** 剥掉成对的外层括号（"(a ? b : c)" → "a ? b : c"） */
function stripParens(s: string): string {
  let t = s.trim()
  while (t.startsWith('(') && t.endsWith(')')) {
    let depth = 0
    let wraps = true
    for (let i = 0; i < t.length; i++) {
      const ch = t[i]
      if (ch === "'" || ch === '"') { i++; while (i < t.length && t[i] !== ch) { if (t[i] === '\\') i++; i++ } continue }
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0 && i < t.length - 1) { wraps = false; break }
        if (depth < 0) { wraps = false; break }
      }
    }
    if (!wraps || depth !== 0) break
    t = t.slice(1, -1).trim()
  }
  return t
}

/** 求值中间值：ArgVal / 对象字面量 / 数组字面量 / null */
type EvalVal = ArgVal | Record<string, ArgVal> | ForEachItem[] | null

const isArgVal = (v: EvalVal | undefined): v is ArgVal =>
  !!v && typeof v === 'object' && !Array.isArray(v) && 't' in (v as object)

function truthy(v: EvalVal | undefined): boolean | undefined {
  if (v === undefined) return undefined
  if (v === null) return false
  if (Array.isArray(v)) return true
  if (!isArgVal(v)) return true
  if (v.t === 'bool') return v.v
  if (v.t === 'num') return v.v !== 0
  if (v.t === 'str') return v.v.length > 0
  return undefined
}

function toText(v: EvalVal | undefined): string | undefined {
  if (v === null) return 'null'
  if (v === undefined || !isArgVal(v)) return undefined
  if (v.t === 'str') return v.v
  if (v.t === 'num' || v.t === 'bool') return String(v.v)
  return undefined
}

const numOf = (v: EvalVal | undefined): number | undefined =>
  isArgVal(v) && v.t === 'num' ? v.v : undefined

/** 扫描顶层二元运算符的最后一次出现（左结合递归用）；'+/-' 防负号/连符误判 */
function scanLastOp(s: string, ops: readonly string[]): { idx: number; op: string } | null {
  let depth = 0
  let quote = ''
  let found: { idx: number; op: string } | null = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (depth !== 0) continue
    for (const op of ops) {
      if (!s.startsWith(op, i)) continue
      if ((op === '+' || op === '-') && (i === 0 || '+-*/%('.includes(s[i - 1]))) continue
      found = { idx: i, op }
    }
  }
  return found
}

/** 顶层三元 '?'（排除 ?. 与 ??） */
function findTernaryQ(s: string): number {
  let depth = 0
  let quote = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (depth === 0 && ch === '?' && s[i + 1] !== '?' && s[i + 1] !== '.' && s[i - 1] !== '?') return i
  }
  return -1
}

interface PostStep { kind: 'prop' | 'index'; key: string }

/** 从 start 位置解析后缀链（.prop / ?.prop / [expr]） */
function parseChain(s: string, start: number): { base: string; steps: PostStep[] } | null {
  const steps: PostStep[] = []
  let i = start
  while (i < s.length) {
    if (s.startsWith('?.', i) || s[i] === '.') {
      i += s.startsWith('?.', i) ? 2 : 1
      const m = /^[A-Za-z_$][\w$]*/.exec(s.slice(i))
      if (!m) return null
      steps.push({ kind: 'prop', key: m[0] })
      i += m[0].length
      continue
    }
    if (s[i] === '[') {
      let d = 1
      let j = i + 1
      for (; j < s.length; j++) {
        if (s[j] === '[') d++
        else if (s[j] === ']') { d--; if (d === 0) break }
      }
      if (d !== 0) return null
      steps.push({ kind: 'index', key: s.slice(i + 1, j) })
      i = j + 1
      continue
    }
    return null
  }
  return { base: s.slice(0, start), steps }
}

function applyStep(v: EvalVal, st: PostStep, states: IRState[]): EvalVal | undefined {
  if (v === undefined) return undefined
  if (st.kind === 'index') {
    if (!Array.isArray(v)) return undefined
    const n = numOf(evalVal(st.key, states))
    if (n === undefined || n < 0 || n >= v.length) return undefined
    const el = v[n]
    if (typeof el === 'object') return el
    return { t: typeof el === 'number' ? 'num' : 'str', v: el } as ArgVal
  }
  if (Array.isArray(v)) {
    if (st.key === 'length') return { t: 'num', v: v.length }
    return undefined
  }
  if (v === null) return undefined
  if (!isArgVal(v)) return v[st.key]
  if (v.t === 'obj') return v.v[st.key] // ctor obj 形态的对象（@State user: object = {...}）
  if (v.t === 'str' && st.key === 'length') return { t: 'num', v: v.v.length }
  return undefined
}

const CMP_OPS = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'] as const

/**
 * 表达式小求值：字面量 / this.x 状态 / 三元 / 比较 / && || ?? / ! / 加减乘除 /
 * 拼接 / 成员访问（.prop ?.prop [i]，含 .length）。求不出一律回退 undefined（不猜、不丢）。
 */
function evalVal(raw: string, states: IRState[]): EvalVal | undefined {
  const s0 = raw.trim()
  if (!s0) return undefined
  const s = stripParens(s0)

  // 三元 cond ? a : b
  const q = findTernaryQ(s)
  if (q >= 0) {
    const rest = s.slice(q + 1)
    const colon = findTopOp(rest, [':'])
    if (colon < 0) return undefined
    const c = truthy(evalVal(s.slice(0, q), states))
    if (c === undefined) return undefined
    return evalVal(c ? rest.slice(0, colon) : rest.slice(colon + 1), states)
  }

  // ??（左结合）
  const nn = scanLastOp(s, ['??'])
  if (nn) {
    const l = evalVal(s.slice(0, nn.idx), states)
    return l === undefined || l === null ? evalVal(s.slice(nn.idx + 2), states) : l
  }

  // || / &&
  const orIdx = scanLastOp(s, ['||'])
  if (orIdx) {
    const l = truthy(evalVal(s.slice(0, orIdx.idx), states))
    if (l === undefined) return undefined
    return l ? { t: 'bool', v: true } : evalVal(s.slice(orIdx.idx + 2), states)
  }
  const andIdx = scanLastOp(s, ['&&'])
  if (andIdx) {
    const l = truthy(evalVal(s.slice(0, andIdx.idx), states))
    if (l === undefined) return undefined
    return l ? evalVal(s.slice(andIdx.idx + 2), states) : { t: 'bool', v: false }
  }

  // 比较（先长后短）
  const ci = findTopOp(s, CMP_OPS)
  if (ci > 0) {
    const op = CMP_OPS.find(o => s.startsWith(o, ci))!
    const l = evalVal(s.slice(0, ci), states)
    const r = evalVal(s.slice(ci + op.length), states)
    if (l === undefined || r === undefined) return undefined
    if (op === '===' || op === '==') return { t: 'bool', v: eqVal(l, r) }
    if (op === '!==' || op === '!=') return { t: 'bool', v: !eqVal(l, r) }
    const ln = numOf(l)
    const rn = numOf(r)
    if (ln === undefined || rn === undefined) return undefined
    switch (op) {
      case '>=': return { t: 'bool', v: ln >= rn }
      case '<=': return { t: 'bool', v: ln <= rn }
      case '>': return { t: 'bool', v: ln > rn }
      case '<': return { t: 'bool', v: ln < rn }
    }
    return undefined
  }

  // 加减（左结合；全数值求值，'+' 遇非数值转拼接）
  const add = scanLastOp(s, ['+', '-'])
  if (add) {
    const l = evalVal(s.slice(0, add.idx), states)
    const r = evalVal(s.slice(add.idx + 1), states)
    if (l === undefined || r === undefined) return undefined
    const ln = numOf(l)
    const rn = numOf(r)
    if (ln !== undefined && rn !== undefined) {
      return { t: 'num', v: add.op === '+' ? ln + rn : ln - rn }
    }
    if (add.op === '+') {
      const lt = toText(l)
      const rt = toText(r)
      if (lt !== undefined && rt !== undefined) return { t: 'str', v: lt + rt }
    }
    return undefined
  }

  // 乘除余（左结合，仅数值）
  const mul = scanLastOp(s, ['*', '/', '%'])
  if (mul) {
    const l = numOf(evalVal(s.slice(0, mul.idx), states))
    const r = numOf(evalVal(s.slice(mul.idx + 1), states))
    if (l === undefined || r === undefined) return undefined
    if (mul.op === '*') return { t: 'num', v: l * r }
    if (r === 0) return undefined
    return { t: 'num', v: mul.op === '/' ? l / r : l % r }
  }

  // 一元 !
  if (s.startsWith('!')) {
    const v = truthy(evalVal(s.slice(1), states))
    return v === undefined ? undefined : { t: 'bool', v: !v }
  }

  // 成员访问后缀链：逐步尝试最长的可求值基值前缀
  for (let i = 0; i < s.length; i++) {
    const isChainStart = s[i] === '.' || s[i] === '[' || (s[i] === '?' && s[i + 1] === '.')
    if (!isChainStart) continue
    if (s[i] === '.' && (s[i - 1] === '?' || (/\d/.test(s[i - 1] ?? '') && /\d/.test(s[i + 1] ?? '')))) continue
    if (s[i] === '[' && i === 0) break // 数组字面量不是后缀
    const chain = parseChain(s, i)
    if (!chain) continue
    let v = evalVal(chain.base, states)
    if (v === undefined) continue
    for (const st of chain.steps) {
      v = applyStep(v, st, states)
      if (v === undefined) break
    }
    if (v !== undefined) return v
  }

  // 主值：字符串 / 数字 / 布尔 / null / this.x（对象、数组、raw 初值递归）
  const strM = s.match(/^'([^']*)'$/) ?? s.match(/^"([^"]*)"$/)
  if (strM) return { t: 'str', v: strM[1] }
  if (/^-?\d+(\.\d+)?$/.test(s)) return { t: 'num', v: parseFloat(s) }
  if (s === 'true' || s === 'false') return { t: 'bool', v: s === 'true' }
  if (s === 'null' || s === 'undefined') return null
  const thisM = s.match(/^this\.(\w+)$/)
  if (thisM) {
    const st = findState(states, thisM[1])
    if (!st) return undefined
    if (st.init.t === 'raw') {
      const rv = st.init.v.trim()
      if (rv.startsWith('{')) {
        const o = parseObjectLiteral(rv)
        if (o) return o
      }
      if (rv.startsWith('[')) {
        const a = parseArrayLiteral(rv)
        if (a) return a
      }
      return evalVal(rv, states)
    }
    return st.init
  }
  // 枚举路径（Color.Red 等）
  if (/^[A-Za-z_$][\w$]*(\.[\w$]+)+$/.test(s)) return { t: 'enum', v: s }
  return undefined
}

/** 宽松相等（预览够用）：同类型比值，num 与可转文本互比 */
function eqVal(l: EvalVal, r: EvalVal): boolean {
  if (l === null || r === null) return l === null && r === null
  const lt = toText(l)
  const rt = toText(r)
  if (lt === undefined || rt === undefined) return false
  if (isArgVal(l) && isArgVal(r) && l.t === 'num' && r.t === 'num') return l.v === r.v
  return lt === rt
}

/** 公开入口：仅当求值结果为 ArgVal 时返回（对象/数组中间值不外泄） */
export function evalExpr(raw: string, states: IRState[]): ArgVal | undefined {
  const v = evalVal(raw, states)
  return isArgVal(v) ? v : undefined
}

/** ForEach 数据项：原始值或对象字面量（值为结构化 ArgVal） */
export type ForEachItem = string | number | Record<string, ArgVal>

/** 对象字面量单项解析（ForEach 用）：key: 字串/数字/布尔/枚举路径/其余 raw */
function parseObjectLiteral(raw: string): Record<string, ArgVal> | null {
  const t = raw.trim()
  if (!t.startsWith('{') || !t.endsWith('}')) return null
  const inner = t.slice(1, -1).trim()
  const out: Record<string, ArgVal> = {}
  if (!inner) return out
  for (const pair0 of splitTop(inner, ',')) {
    const pair = pair0.trim()
    const ci = findTopOp(pair, [':'])
    if (ci <= 0) return null
    const k = pair.slice(0, ci).trim().replace(/^['"]|['"]$/g, '')
    const v = pair.slice(ci + 1).trim()
    const strM = v.match(/^'([^']*)'$/) ?? v.match(/^"([^"]*)"$/)
    if (strM) { out[k] = { t: 'str', v: strM[1] }; continue }
    if (/^-?\d+(\.\d+)?$/.test(v)) { out[k] = { t: 'num', v: parseFloat(v) }; continue }
    if (v === 'true' || v === 'false') { out[k] = { t: 'bool', v: v === 'true' }; continue }
    if (/^[A-Za-z_$][\w$]*(\.[\w$]+)+$/.test(v)) { out[k] = { t: 'enum', v }; continue }
    out[k] = { t: 'raw', v }
  }
  return out
}

/** 数组字面量原文 → 条目列表（原始值或对象）；含不可解析部分时返回 null（不强行求值） */
export function parseArrayLiteral(raw: string): ForEachItem[] | null {
  const t = raw.trim()
  if (!t.startsWith('[') || !t.endsWith(']')) return null
  const inner = t.slice(1, -1).trim()
  if (!inner) return []
  const out: ForEachItem[] = []
  for (const p0 of splitTop(inner, ',')) {
    const p = p0.trim()
    if (!p) continue // 尾逗号（真实代码常见）
    if (p.startsWith('{')) {
      const o = parseObjectLiteral(p)
      if (!o) return null
      out.push(o)
      continue
    }
    const m = p.match(/^'([^']*)'$/) ?? p.match(/^"([^"]*)"$/)
    if (m) { out.push(m[1]); continue }
    if (/^-?\d+(\.\d+)?$/.test(p)) { out.push(parseFloat(p)); continue }
    return null
  }
  return out
}

// ---------- @State 轻量求值（禁 eval，字面量形态 + 小表达式） ----------

export function resolveNum(a: ArgVal | undefined, states: IRState[]): number | undefined {
  if (!a) return undefined
  if (a.t === 'num') return a.v
  if (a.t === 'enum') {
    const m = a.v.match(/^this\.(\w+)$/)
    if (!m) return undefined
    const st = findState(states, m[1])
    return st && st.init.t === 'num' ? st.init.v : undefined
  }
  if (a.t === 'raw') {
    const v = evalExpr(a.v, states)
    return v && v.t === 'num' ? v.v : undefined
  }
  return undefined
}

export function resolveStr(a: ArgVal | undefined, states: IRState[], res?: RenderRes): string | undefined {
  if (!a) return undefined
  if (a.t === 'str') return a.v
  if (a.t === 'enum') {
    const m = a.v.match(/^this\.(\w+)$/)
    if (!m) return undefined
    const st = findState(states, m[1])
    return st && st.init.t === 'str' ? st.init.v : undefined
  }
  if (a.t === 'raw') {
    const rs = resourceString(a, res?.strings)
    if (rs !== undefined) return rs
    const v = evalExpr(a.v, states)
    if (!v) return undefined
    if (v.t === 'str') return v.v
    if (v.t === 'num' || v.t === 'bool') return String(v.v)
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
    const v = evalExpr(a.v, states)
    if (v) return truthy(v)
    // 宽松回退：历史行为（文本含 true/false 字面量）
    if (/\btrue\b/.test(a.v)) return true
    if (/\bfalse\b/.test(a.v)) return false
  }
  return undefined
}

// ---------- If / Else 配对 ----------

/** If 是否折叠：条件经 evalExpr 求值为 false（含 this.x 布尔/比较/三元等），求不出按不折叠 */
export function ifCollapsed(ifNode: IRNode, states: IRState[]): boolean {
  const a = ifNode.ctorArgs[0]
  const raw = a && a.t === 'raw' ? a.v : ''
  const v = evalExpr(raw, states)
  if (v && v.t === 'bool') return !v.v
  // 宽松回退：文本含 false 字面量（历史行为）
  if (/\bfalse\b/.test(raw)) return true
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

// ---------- 交互预览：router 导航动作提取 ----------

export interface RouteAction { kind: 'push' | 'back'; url?: string }

/** 在一段源码文本中找 router 导航调用（pushUrl/replaceUrl 优先于 back），找不到返回 null */
export function findRouterAction(text: string): RouteAction | null {
  const push = text.match(/router\.(?:pushUrl|replaceUrl)\s*\(\s*\{[\s\S]{0,400}?url\s*:\s*['"]([^'"]+)['"]/)
  if (push) return { kind: 'push', url: push[1] }
  if (/router\.back\s*\(/.test(text)) return { kind: 'back' }
  return null
}

/** 从 openIdx（'{' 位置）截取配平的方法体（引号/注释不感知，启发式够用） */
function balancedFrom(text: string, openIdx: number): string {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(0, i + 1) }
  }
  return text
}

/** 从 struct 成员的 raw 原文提取「方法名 → router 动作」表（onClick 间接调用的导航方法，如 this.open(id)） */
export function extractMethodRoutes(ir: IRFile): Record<string, RouteAction> {
  const out: Record<string, RouteAction> = {}
  for (const m of ir.members) {
    if (m.kind !== 'raw') continue
    const re = /(?:^|\n)\s*(?:public\s+|private\s+|async\s+|static\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^\n{]+)?\s*\{/g
    let d: RegExpExecArray | null
    while ((d = re.exec(m.text))) {
      const act = findRouterAction(balancedFrom(m.text, d.index + d[0].length - 1))
      if (act) out[d[1]] = act
    }
  }
  return out
}

/** 节点 onClick 的导航动作：内联 router 调用优先，否则解析 this.method() 间接调用 */
export function routerActionOf(node: IRNode, methodRoutes: Record<string, RouteAction> = {}): RouteAction | null {
  const oc = node.modifiers.find(m => m.name === 'onClick')
  if (!oc) return null
  for (const a of oc.args) {
    if (a.t !== 'raw') continue
    const direct = findRouterAction(a.v)
    if (direct) return direct
    for (const c of a.v.matchAll(/this\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      const act = methodRoutes[c[1]]
      if (act) return act
    }
  }
  return null
}
