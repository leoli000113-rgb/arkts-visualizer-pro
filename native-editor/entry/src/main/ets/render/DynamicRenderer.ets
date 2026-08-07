/**
 * 动态渲染器：IRNode 树 → 真·ArkUI FrameNode 树（typeNode，API 12+）
 *
 * 画布上的每个组件都是真正的 ArkUI 组件，布局引擎就是真机那一个——
 * 这是 native-editor 相对 Web 版（HTML/CSS 模拟）的保真根基。
 *
 * 覆盖：Text/Button/Image/TextInput/Divider/Blank/Progress/Checkbox/Radio/Slider/Toggle
 *      Column/Row/Stack/Flex/Scroll/List/Grid/Swiper/RelativeContainer + ListItem/GridItem 自动包裹
 * If/ForEach/BuilderCall/Unknown 渲染为占位块（求值器在后续批次）。
 */

import { typeNode, FrameNode } from '@kit.ArkUI'
import { ArgVal, IRNode, Modifier } from '../core/ir'
import { arrayLiteralCount, boolOf, colorOf, enumOf, lengthOf, numOf, objVal, rawOf, strOf } from './argConvert'
import { forEachParams, jsTruthy, tryEval, vToStr, V } from '../core/exprEval'

// ---------- 枚举映射表 ----------

const FONT_WEIGHTS = new Map<string, FontWeight>([
  ['FontWeight.Lighter', FontWeight.Lighter],
  ['FontWeight.Normal', FontWeight.Normal],
  ['FontWeight.Regular', FontWeight.Regular],
  ['FontWeight.Medium', FontWeight.Medium],
  ['FontWeight.Bold', FontWeight.Bold],
  ['FontWeight.Bolder', FontWeight.Bolder],
])

const H_ALIGNS = new Map<string, HorizontalAlign>([
  ['HorizontalAlign.Start', HorizontalAlign.Start],
  ['HorizontalAlign.Center', HorizontalAlign.Center],
  ['HorizontalAlign.End', HorizontalAlign.End],
])

const V_ALIGNS = new Map<string, VerticalAlign>([
  ['VerticalAlign.Top', VerticalAlign.Top],
  ['VerticalAlign.Center', VerticalAlign.Center],
  ['VerticalAlign.Bottom', VerticalAlign.Bottom],
])

const FLEX_ALIGNS = new Map<string, FlexAlign>([
  ['FlexAlign.Start', FlexAlign.Start],
  ['FlexAlign.Center', FlexAlign.Center],
  ['FlexAlign.End', FlexAlign.End],
  ['FlexAlign.SpaceBetween', FlexAlign.SpaceBetween],
  ['FlexAlign.SpaceAround', FlexAlign.SpaceAround],
  ['FlexAlign.SpaceEvenly', FlexAlign.SpaceEvenly],
])

const ALIGNMENTS = new Map<string, Alignment>([
  ['Alignment.TopStart', Alignment.TopStart],
  ['Alignment.Top', Alignment.Top],
  ['Alignment.TopEnd', Alignment.TopEnd],
  ['Alignment.Start', Alignment.Start],
  ['Alignment.Center', Alignment.Center],
  ['Alignment.End', Alignment.End],
  ['Alignment.BottomStart', Alignment.BottomStart],
  ['Alignment.Bottom', Alignment.Bottom],
  ['Alignment.BottomEnd', Alignment.BottomEnd],
])

const ITEM_ALIGNS = new Map<string, ItemAlign>([
  ['ItemAlign.Start', ItemAlign.Start],
  ['ItemAlign.Center', ItemAlign.Center],
  ['ItemAlign.End', ItemAlign.End],
  ['ItemAlign.Baseline', ItemAlign.Baseline],
  ['ItemAlign.Stretch', ItemAlign.Stretch],
  ['ItemAlign.Auto', ItemAlign.Auto],
])

const BUTTON_TYPES = new Map<string, ButtonType>([
  ['ButtonType.Capsule', ButtonType.Capsule],
  ['ButtonType.Normal', ButtonType.Normal],
  ['ButtonType.Circle', ButtonType.Circle],
])

const IMAGE_FITS = new Map<string, ImageFit>([
  ['ImageFit.Contain', ImageFit.Contain],
  ['ImageFit.Cover', ImageFit.Cover],
  ['ImageFit.Auto', ImageFit.Auto],
  ['ImageFit.Fill', ImageFit.Fill],
  ['ImageFit.None', ImageFit.None],
  ['ImageFit.ScaleDown', ImageFit.ScaleDown],
])

const BAR_STATES = new Map<string, BarState>([
  ['BarState.Off', BarState.Off],
  ['BarState.On', BarState.On],
  ['BarState.Auto', BarState.Auto],
])

const SCROLL_DIRS = new Map<string, ScrollDirection>([
  ['ScrollDirection.Vertical', ScrollDirection.Vertical],
  ['ScrollDirection.Horizontal', ScrollDirection.Horizontal],
  ['ScrollDirection.None', ScrollDirection.None],
])

const AXIS = new Map<string, Axis>([
  ['Axis.Vertical', Axis.Vertical],
  ['Axis.Horizontal', Axis.Horizontal],
])

const VISIBILITIES = new Map<string, Visibility>([
  ['Visibility.Visible', Visibility.Visible],
  ['Visibility.Hidden', Visibility.Hidden],
  ['Visibility.None', Visibility.None],
])

const FONT_STYLES = new Map<string, FontStyle>([
  ['FontStyle.Normal', FontStyle.Normal],
  ['FontStyle.Italic', FontStyle.Italic],
])

const TEXT_ALIGNS = new Map<string, TextAlign>([
  ['TextAlign.Start', TextAlign.Start],
  ['TextAlign.Center', TextAlign.Center],
  ['TextAlign.End', TextAlign.End],
  ['TextAlign.JUSTIFY', TextAlign.JUSTIFY],
])

const BORDER_STYLES = new Map<string, BorderStyle>([
  ['BorderStyle.Solid', BorderStyle.Solid],
  ['BorderStyle.Dashed', BorderStyle.Dashed],
  ['BorderStyle.Dotted', BorderStyle.Dotted],
])

const COLORS = new Map<string, Color>([
  ['Color.White', Color.White],
  ['Color.Black', Color.Black],
  ['Color.Blue', Color.Blue],
  ['Color.Brown', Color.Brown],
  ['Color.Gray', Color.Gray],
  ['Color.Green', Color.Green],
  ['Color.Grey', Color.Grey],
  ['Color.Orange', Color.Orange],
  ['Color.Pink', Color.Pink],
  ['Color.Red', Color.Red],
  ['Color.Yellow', Color.Yellow],
  ['Color.Transparent', Color.Transparent],
])

const TEXT_OVERFLOWS = new Map<string, TextOverflow>([
  ['TextOverflow.None', TextOverflow.None],
  ['TextOverflow.Clip', TextOverflow.Clip],
  ['TextOverflow.Ellipsis', TextOverflow.Ellipsis],
  ['TextOverflow.MARQUEE', TextOverflow.MARQUEE],
])

const TEXT_DECORATION_TYPES = new Map<string, TextDecorationType>([
  ['TextDecorationType.Underline', TextDecorationType.Underline],
  ['TextDecorationType.LineThrough', TextDecorationType.LineThrough],
  ['TextDecorationType.Overline', TextDecorationType.Overline],
  ['TextDecorationType.None', TextDecorationType.None],
])

const EDGE_EFFECTS = new Map<string, EdgeEffect>([
  ['EdgeEffect.Spring', EdgeEffect.Spring],
  ['EdgeEffect.Fade', EdgeEffect.Fade],
  ['EdgeEffect.None', EdgeEffect.None],
])

const IMAGE_REPEATS = new Map<string, ImageRepeat>([
  ['ImageRepeat.NoRepeat', ImageRepeat.NoRepeat],
  ['ImageRepeat.X', ImageRepeat.X],
  ['ImageRepeat.Y', ImageRepeat.Y],
  ['ImageRepeat.XY', ImageRepeat.XY],
])

const FLEX_DIRECTIONS = new Map<string, FlexDirection>([
  ['FlexDirection.Row', FlexDirection.Row],
  ['FlexDirection.Column', FlexDirection.Column],
  ['FlexDirection.RowReverse', FlexDirection.RowReverse],
  ['FlexDirection.ColumnReverse', FlexDirection.ColumnReverse],
])

const FLEX_WRAPS = new Map<string, FlexWrap>([
  ['FlexWrap.NoWrap', FlexWrap.NoWrap],
  ['FlexWrap.Wrap', FlexWrap.Wrap],
  ['FlexWrap.WrapReverse', FlexWrap.WrapReverse],
])

// ---------- 属性值转换 ----------

function colorVal(a: ArgVal | undefined): ResourceColor | null {
  const c = colorOf(a)
  if (c !== null) return c
  const path = enumOf(a)
  if (path !== null) {
    const v = COLORS.get(path)
    if (v !== undefined) return v
  }
  return null
}

function paddingVal(a: ArgVal | undefined): Padding | Length | null {
  const l = lengthOf(a)
  if (l !== null) return l
  if (a !== undefined && a.t === 'obj') {
    const p: Padding = {}
    const top = lengthOf(objVal(a, 'top')); if (top !== null) p.top = top
    const bottom = lengthOf(objVal(a, 'bottom')); if (bottom !== null) p.bottom = bottom
    const left = lengthOf(objVal(a, 'left')); if (left !== null) p.left = left
    const right = lengthOf(objVal(a, 'right')); if (right !== null) p.right = right
    return p
  }
  return null
}

function positionVal(a: ArgVal | undefined): Position | null {
  if (a === undefined || a.t !== 'obj') return null
  const p: Position = {}
  const x = lengthOf(objVal(a, 'x')); if (x !== null) p.x = x
  const y = lengthOf(objVal(a, 'y')); if (y !== null) p.y = y
  return p
}

// ---------- 通用修饰符（任意组件的 attribute 都有这些方法） ----------

function applyCommon<T>(attr: CommonMethod<T>, m: Modifier): boolean {
  switch (m.name) {
    case 'width': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.width(v); return true }
    case 'height': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.height(v); return true }
    case 'size': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const o: SizeOptions = {}
      const w = lengthOf(objVal(a, 'width')); if (w !== null) o.width = w
      const h = lengthOf(objVal(a, 'height')); if (h !== null) o.height = h
      attr.size(o); return true
    }
    case 'padding': { const v = paddingVal(m.args[0]); if (v === null) return false; attr.padding(v); return true }
    case 'margin': { const v = paddingVal(m.args[0]); if (v === null) return false; attr.margin(v); return true }
    case 'backgroundColor': { const v = colorVal(m.args[0]); if (v === null) return false; attr.backgroundColor(v); return true }
    case 'borderRadius': {
      const l = lengthOf(m.args[0])
      if (l !== null) { attr.borderRadius(l); return true }
      const a = m.args[0]
      if (a !== undefined && a.t === 'obj') {
        const r: BorderRadiuses = {}
        const tl = lengthOf(objVal(a, 'topLeft')); if (tl !== null) r.topLeft = tl
        const tr = lengthOf(objVal(a, 'topRight')); if (tr !== null) r.topRight = tr
        const bl = lengthOf(objVal(a, 'bottomLeft')); if (bl !== null) r.bottomLeft = bl
        const br = lengthOf(objVal(a, 'bottomRight')); if (br !== null) r.bottomRight = br
        attr.borderRadius(r); return true
      }
      return false
    }
    case 'border': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const b: BorderOptions = {}
      const w = lengthOf(objVal(a, 'width')); if (w !== null) b.width = w
      const c = colorVal(objVal(a, 'color')); if (c !== null) b.color = c
      const r = lengthOf(objVal(a, 'radius')); if (r !== null) b.radius = r
      const s = enumOf(objVal(a, 'style'))
      if (s !== null) { const bs = BORDER_STYLES.get(s); if (bs !== undefined) b.style = bs }
      attr.border(b); return true
    }
    case 'position': { const v = positionVal(m.args[0]); if (v === null) return false; attr.position(v); return true }
    case 'offset': { const v = positionVal(m.args[0]); if (v === null) return false; attr.offset(v); return true }
    case 'markAnchor': { const v = positionVal(m.args[0]); if (v === null) return false; attr.markAnchor(v); return true }
    case 'layoutWeight': { const v = numOf(m.args[0]); if (v === null) return false; attr.layoutWeight(v); return true }
    case 'opacity': { const v = numOf(m.args[0]); if (v === null) return false; attr.opacity(v); return true }
    case 'visibility': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = VISIBILITIES.get(p); if (v === undefined) return false
      attr.visibility(v); return true
    }
    case 'zIndex': { const v = numOf(m.args[0]); if (v === null) return false; attr.zIndex(v); return true }
    case 'translate': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const o: TranslateOptions = {}
      const x = lengthOf(objVal(a, 'x')); if (x !== null) o.x = x
      const y = lengthOf(objVal(a, 'y')); if (y !== null) o.y = y
      const z = lengthOf(objVal(a, 'z')); if (z !== null) o.z = z
      attr.translate(o); return true
    }
    case 'scale': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const o: ScaleOptions = {}
      const x = numOf(objVal(a, 'x')); if (x !== null) o.x = x
      const y = numOf(objVal(a, 'y')); if (y !== null) o.y = y
      const z = numOf(objVal(a, 'z')); if (z !== null) o.z = z
      attr.scale(o); return true
    }
    case 'rotate': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const ang = numOf(objVal(a, 'angle'))
      if (ang === null) return false
      const o: RotateOptions = { angle: ang }
      const x = numOf(objVal(a, 'x')); if (x !== null) o.x = x
      const y = numOf(objVal(a, 'y')); if (y !== null) o.y = y
      const z = numOf(objVal(a, 'z')); if (z !== null) o.z = z
      attr.rotate(o); return true
    }
    case 'clip': { const v = boolOf(m.args[0]); if (v === null) return false; attr.clip(v); return true }
    case 'enabled': { const v = boolOf(m.args[0]); if (v === null) return false; attr.enabled(v); return true }
    case 'alignSelf': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = ITEM_ALIGNS.get(p); if (v === undefined) return false
      attr.alignSelf(v); return true
    }
    case 'flexGrow': { const v = numOf(m.args[0]); if (v === null) return false; attr.flexGrow(v); return true }
    case 'flexShrink': { const v = numOf(m.args[0]); if (v === null) return false; attr.flexShrink(v); return true }
    case 'flexBasis': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.flexBasis(v); return true }
    case 'aspectRatio': { const v = numOf(m.args[0]); if (v === null) return false; attr.aspectRatio(v); return true }
    case 'constraintSize': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const o: ConstraintSizeOptions = {}
      const minW = lengthOf(objVal(a, 'minWidth')); if (minW !== null) o.minWidth = minW
      const maxW = lengthOf(objVal(a, 'maxWidth')); if (maxW !== null) o.maxWidth = maxW
      const minH = lengthOf(objVal(a, 'minHeight')); if (minH !== null) o.minHeight = minH
      const maxH = lengthOf(objVal(a, 'maxHeight')); if (maxH !== null) o.maxHeight = maxH
      attr.constraintSize(o); return true
    }
    case 'shadow': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const radius = numOf(objVal(a, 'radius'))
      if (radius === null) return false
      const o: ShadowOptions = { radius: radius }
      const c = colorVal(objVal(a, 'color')); if (c !== null) o.color = c
      const ox = numOf(objVal(a, 'offsetX')); if (ox !== null) o.offsetX = ox
      const oy = numOf(objVal(a, 'offsetY')); if (oy !== null) o.offsetY = oy
      attr.shadow(o); return true
    }
    case 'blur': { const v = numOf(m.args[0]); if (v === null) return false; attr.blur(v); return true }
    case 'foregroundColor': { const v = colorVal(m.args[0]); if (v === null) return false; attr.foregroundColor(v); return true }
    default: return false
  }
}

// ---------- 文本类专用修饰符 ----------

interface FontSet {
  fontSize: (v: number) => void
  fontColor: (v: ResourceColor) => void
  fontWeight: (v: FontWeight | number) => void
  fontStyle: (v: FontStyle) => void
  fontFamily: (v: string) => void
}

function applyFontLike<T extends CommonMethod<T>>(attr: T, m: Modifier, set: FontSet): boolean {
  switch (m.name) {
    case 'fontSize': { const v = numOf(m.args[0]); if (v === null) return false; set.fontSize(v); return true }
    case 'fontColor': { const v = colorVal(m.args[0]); if (v === null) return false; set.fontColor(v); return true }
    case 'fontWeight': {
      const n = numOf(m.args[0]); if (n !== null) { set.fontWeight(n); return true }
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = FONT_WEIGHTS.get(p); if (v === undefined) return false
      set.fontWeight(v); return true
    }
    case 'fontStyle': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = FONT_STYLES.get(p); if (v === undefined) return false
      set.fontStyle(v); return true
    }
    case 'fontFamily': { const v = strOf(m.args[0]); if (v === null) return false; set.fontFamily(v); return true }
    default: return false
  }
}

function applyTextAttr(attr: TextAttribute, m: Modifier): boolean {
  const fs: FontSet = {
    fontSize: (v) => { attr.fontSize(v) },
    fontColor: (v) => { attr.fontColor(v) },
    fontWeight: (v) => { attr.fontWeight(v) },
    fontStyle: (v) => { attr.fontStyle(v) },
    fontFamily: (v) => { attr.fontFamily(v) },
  }
  if (applyFontLike(attr, m, fs)) return true
  switch (m.name) {
    case 'textAlign': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = TEXT_ALIGNS.get(p); if (v === undefined) return false
      attr.textAlign(v); return true
    }
    case 'lineHeight': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.lineHeight(v); return true }
    case 'maxLines': { const v = numOf(m.args[0]); if (v === null) return false; attr.maxLines(v); return true }
    case 'letterSpacing': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.letterSpacing(v); return true }
    case 'baselineOffset': { const v = numOf(m.args[0]); if (v === null) return false; attr.baselineOffset(v); return true }
    case 'textOverflow': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const p = enumOf(objVal(a, 'overflow')); if (p === null) return false
      const v = TEXT_OVERFLOWS.get(p); if (v === undefined) return false
      attr.textOverflow({ overflow: v }); return true
    }
    case 'decoration': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const p = enumOf(objVal(a, 'type')); if (p === null) return false
      const t = TEXT_DECORATION_TYPES.get(p); if (t === undefined) return false
      const c = colorVal(objVal(a, 'color'))
      if (c !== null) attr.decoration({ type: t, color: c })
      else attr.decoration({ type: t })
      return true
    }
    default: return false
  }
}

function applyButtonAttr(attr: ButtonAttribute, m: Modifier): boolean {
  const fs: FontSet = {
    fontSize: (v) => { attr.fontSize(v) },
    fontColor: (v) => { attr.fontColor(v) },
    fontWeight: (v) => { attr.fontWeight(v) },
    fontStyle: (v) => { attr.fontStyle(v) },
    fontFamily: (v) => { attr.fontFamily(v) },
  }
  if (applyFontLike(attr, m, fs)) return true
  switch (m.name) {
    case 'stateEffect': { const v = boolOf(m.args[0]); if (v === null) return false; attr.stateEffect(v); return true }
    default: return false
  }
}

// ---------- 容器专用修饰符 ----------

function applyColumnAttr(attr: ColumnAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'alignItems': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = H_ALIGNS.get(p); if (v === undefined) return false
      attr.alignItems(v); return true
    }
    case 'justifyContent': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = FLEX_ALIGNS.get(p); if (v === undefined) return false
      attr.justifyContent(v); return true
    }
    default: return false
  }
}

function applyRowAttr(attr: RowAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'alignItems': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = V_ALIGNS.get(p); if (v === undefined) return false
      attr.alignItems(v); return true
    }
    case 'justifyContent': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = FLEX_ALIGNS.get(p); if (v === undefined) return false
      attr.justifyContent(v); return true
    }
    default: return false
  }
}

function applyStackAttr(attr: StackAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'alignContent': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = ALIGNMENTS.get(p); if (v === undefined) return false
      attr.alignContent(v); return true
    }
    default: return false
  }
}

function applyScrollAttr(attr: ScrollAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'scrollable': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = SCROLL_DIRS.get(p); if (v === undefined) return false
      attr.scrollable(v); return true
    }
    case 'scrollBar': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = BAR_STATES.get(p); if (v === undefined) return false
      attr.scrollBar(v); return true
    }
    case 'scrollBarWidth': { const v = numOf(m.args[0]); if (v === null) return false; attr.scrollBarWidth(v); return true }
    case 'edgeEffect': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = EDGE_EFFECTS.get(p); if (v === undefined) return false
      attr.edgeEffect(v); return true
    }
    default: return false
  }
}

function applyListAttr(attr: ListAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'listDirection': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = AXIS.get(p); if (v === undefined) return false
      attr.listDirection(v); return true
    }
    case 'scrollBar': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = BAR_STATES.get(p); if (v === undefined) return false
      attr.scrollBar(v); return true
    }
    case 'lanes': { const v = numOf(m.args[0]); if (v === null) return false; attr.lanes(v); return true }
    case 'cachedCount': { const v = numOf(m.args[0]); if (v === null) return false; attr.cachedCount(v); return true }
    case 'divider': {
      const a = m.args[0]
      if (a === undefined || a.t !== 'obj') return false
      const w = numOf(objVal(a, 'strokeWidth'))
      if (w === null) return false
      const d: ListDividerOptions = { strokeWidth: w }
      const c = colorVal(objVal(a, 'color')); if (c !== null) d.color = c
      const sm = lengthOf(objVal(a, 'startMargin')); if (sm !== null) d.startMargin = sm
      const em = lengthOf(objVal(a, 'endMargin')); if (em !== null) d.endMargin = em
      attr.divider(d); return true
    }
    default: return false
  }
}

function applyGridAttr(attr: GridAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'columnsTemplate': { const v = strOf(m.args[0]); if (v === null) return false; attr.columnsTemplate(v); return true }
    case 'rowsTemplate': { const v = strOf(m.args[0]); if (v === null) return false; attr.rowsTemplate(v); return true }
    case 'columnsGap': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.columnsGap(v); return true }
    case 'rowsGap': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.rowsGap(v); return true }
    case 'scrollBar': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = BAR_STATES.get(p); if (v === undefined) return false
      attr.scrollBar(v); return true
    }
    case 'cachedCount': { const v = numOf(m.args[0]); if (v === null) return false; attr.cachedCount(v); return true }
    default: return false
  }
}

function applySwiperAttr(attr: SwiperAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'index': { const v = numOf(m.args[0]); if (v === null) return false; attr.index(v); return true }
    case 'autoPlay': { const v = boolOf(m.args[0]); if (v === null) return false; attr.autoPlay(v); return true }
    case 'interval': { const v = numOf(m.args[0]); if (v === null) return false; attr.interval(v); return true }
    case 'indicator': { const v = boolOf(m.args[0]); if (v === null) return false; attr.indicator(v); return true }
    case 'loop': { const v = boolOf(m.args[0]); if (v === null) return false; attr.loop(v); return true }
    case 'vertical': { const v = boolOf(m.args[0]); if (v === null) return false; attr.vertical(v); return true }
    case 'itemSpace': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.itemSpace(v); return true }
    case 'duration': { const v = numOf(m.args[0]); if (v === null) return false; attr.duration(v); return true }
    default: return false
  }
}

function applyImageAttr(attr: ImageAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'objectFit': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = IMAGE_FITS.get(p); if (v === undefined) return false
      attr.objectFit(v); return true
    }
    case 'objectRepeat': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = IMAGE_REPEATS.get(p); if (v === undefined) return false
      attr.objectRepeat(v); return true
    }
    case 'interpolation': { const v = numOf(m.args[0]); if (v === null) return false; attr.interpolation(v); return true }
    case 'renderMode': {
      const p = enumOf(m.args[0]); if (p === null) return false
      if (p === 'ImageRenderMode.Original') { attr.renderMode(ImageRenderMode.Original); return true }
      if (p === 'ImageRenderMode.Template') { attr.renderMode(ImageRenderMode.Template); return true }
      return false
    }
    default: return false
  }
}

function applyTextInputAttr(attr: TextInputAttribute, m: Modifier): boolean {
  const fs: FontSet = {
    fontSize: (v) => { attr.fontSize(v) },
    fontColor: (v) => { attr.fontColor(v) },
    fontWeight: (v) => { attr.fontWeight(v) },
    fontStyle: (v) => { attr.fontStyle(v) },
    fontFamily: (v) => { attr.fontFamily(v) },
  }
  if (applyFontLike(attr, m, fs)) return true
  switch (m.name) {
    case 'placeholderColor': { const v = colorVal(m.args[0]); if (v === null) return false; attr.placeholderColor(v); return true }
    case 'textAlign': {
      const p = enumOf(m.args[0]); if (p === null) return false
      const v = TEXT_ALIGNS.get(p); if (v === undefined) return false
      attr.textAlign(v); return true
    }
    case 'maxLength': { const v = numOf(m.args[0]); if (v === null) return false; attr.maxLength(v); return true }
    case 'showUnderline': { const v = boolOf(m.args[0]); if (v === null) return false; attr.showUnderline(v); return true }
    default: return false
  }
}

function applyDividerAttr(attr: DividerAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'strokeWidth': { const v = lengthOf(m.args[0]); if (v === null) return false; attr.strokeWidth(v); return true }
    case 'color': { const v = colorVal(m.args[0]); if (v === null) return false; attr.color(v); return true }
    case 'vertical': { const v = boolOf(m.args[0]); if (v === null) return false; attr.vertical(v); return true }
    default: return false
  }
}

function applyGridItemAttr(attr: GridItemAttribute, m: Modifier): boolean {
  switch (m.name) {
    case 'rowStart': { const v = numOf(m.args[0]); if (v === null) return false; attr.rowStart(v); return true }
    case 'rowEnd': { const v = numOf(m.args[0]); if (v === null) return false; attr.rowEnd(v); return true }
    case 'columnStart': { const v = numOf(m.args[0]); if (v === null) return false; attr.columnStart(v); return true }
    case 'columnEnd': { const v = numOf(m.args[0]); if (v === null) return false; attr.columnEnd(v); return true }
    default: return false
  }
}

// ---------- 编辑钩子（点选/几何注册/位移直写） ----------

export interface RenderHooks {
  onTap: (path: string) => void
  registry: Map<string, FrameNode>
  /** 每路径一个 offset 直写闭包：移动拖拽时改活节点，绕过整树重建 */
  offsetAppliers: Map<string, (x: number, y: number) => void>
}

function tap<T>(attr: CommonMethod<T>, hooks: RenderHooks | null, path: string): void {
  if (hooks === null) return
  attr.onClick(() => hooks.onTap(path))
  hooks.offsetAppliers.set(path, (x: number, y: number) => { attr.offset({ x: x, y: y }) })
}

function childPath(p: string, i: number): string {
  return p === '' ? String(i) : `${p}.${i}`
}

// ---------- 占位块 ----------

function placeholder(ctx: UIContext, label: string, color: ResourceColor, hooks: RenderHooks | null, path: string): typeNode.Text {
  const n = typeNode.createNode(ctx, 'Text')
  n.initialize(label)
  n.attribute.fontSize(12)
  n.attribute.fontColor('#888888')
  n.attribute.backgroundColor(color)
  n.attribute.padding(6)
  n.attribute.borderRadius(4)
  n.attribute.margin(2)
  tap(n.attribute, hooks, path)
  return n
}

/** 渲染失败兜底块（红底）：单个子树失败绝不让整个画布白屏 */
function errorBlock(ctx: UIContext, label: string, hooks: RenderHooks | null, path: string): typeNode.Text {
  const n = placeholder(ctx, label, '#ffeded', hooks, path)
  n.attribute.fontColor('#cc0000')
  return n
}

/** 供 EditorCanvas 使用的根级兜底：buildFrame 抛错时返回错误块而非 null */
export function errorFrame(ctx: UIContext, err: Object): FrameNode {
  const msg = err instanceof Error ? err.message : String(err)
  return errorBlock(ctx, `渲染失败: ${msg.length > 60 ? msg.slice(0, 60) + '…' : msg}`, null, '')
}

// ---------- 子节点挂载（If/ForEach/BuilderCall 在兄弟序列中求值展开） ----------

function mountChild(ctx: UIContext, parent: FrameNode, c: IRNode, cp: string, wrap: string, hooks: RenderHooks | null, scope: Map<string, V> | null): void {
  let child: FrameNode | null = null
  try {
    child = buildFrame(ctx, c, hooks, cp, scope)
  } catch (e) {
    // 单个子树渲染失败（如 Button 里塞 Scroll 这类非法结构）：就地放错误块，保住其余树
    const msg = e instanceof Error ? e.message : String(e)
    child = errorBlock(ctx, `${c.type}: ${msg.length > 30 ? msg.slice(0, 30) + '…' : msg}`, hooks, cp)
  }
  if (child === null) return
  if (wrap === 'ListItem' && c.type !== 'ListItem') {
    const item = typeNode.createNode(ctx, 'ListItem')
    item.appendChild(child)
    parent.appendChild(item)
  } else if (wrap === 'GridItem' && c.type !== 'GridItem') {
    const item = typeNode.createNode(ctx, 'GridItem')
    item.appendChild(child)
    parent.appendChild(item)
  } else {
    parent.appendChild(child)
  }
}

function appendChildren(ctx: UIContext, parent: FrameNode, children: IRNode[], wrap: string, hooks: RenderHooks | null, path: string, scope: Map<string, V> | null): void {
  let i = 0
  while (i < children.length) {
    const c = children[i]
    const cp = childPath(path, i)
    if (c.type === 'If') {
      const cond = rawOf(c.ctorArgs[0])
      const v = cond !== null ? tryEval(cond, scope) : undefined
      if (v === undefined) {
        mountChild(ctx, parent, c, cp, wrap, hooks, scope) // 条件不可求值 → 占位块
      } else if (jsTruthy(v)) {
        appendChildren(ctx, parent, c.children, wrap, hooks, cp, scope)
        while (i + 1 < children.length && children[i + 1].type === 'Else') i++ // 跳过 else 分支
      } else {
        if (i + 1 < children.length && children[i + 1].type === 'Else') {
          i++
          appendChildren(ctx, parent, children[i].children, wrap, hooks, childPath(path, i), scope)
        }
      }
      i++
      continue
    }
    if (c.type === 'Else') { i++; continue } // 孤儿 else（不应出现）忽略
    if (c.type === 'BuilderCall') {
      // this.MyBuilder() 调用点：内容直接内联渲染（children 与 @Builder 定义共享引用）
      appendChildren(ctx, parent, c.children, wrap, hooks, cp, scope)
      i++
      continue
    }
    if (c.type === 'ForEach') {
      const itemsRaw = rawOf(c.ctorArgs[0])
      const items = itemsRaw !== null ? tryEval(itemsRaw, scope) : undefined
      if (items !== undefined && Array.isArray(items)) {
        const pr = rawOf(c.ctorArgs[1]) || '(item)'
        const pn = forEachParams(pr)
        for (let k = 0; k < items.length; k++) {
          const s2 = new Map<string, V>(scope !== null ? scope : new Map<string, V>())
          s2.set(pn[0], items[k])
          if (pn[1] !== null) s2.set(pn[1], k)
          // 实例后缀 #k 保证每次迭代的注册键唯一（点选/选中框定位到被点的那个实例）；
          // keyToPath 的 parseInt 会剥掉 '#…' 后缀，IR 操作仍命中共享的模板子树
          appendChildren(ctx, parent, c.children, wrap, hooks, k === 0 ? cp : `${cp}#${k}`, s2)
        }
      } else {
        mountChild(ctx, parent, c, cp, wrap, hooks, scope) // 数据源不可求值 → 占位块
      }
      i++
      continue
    }
    mountChild(ctx, parent, c, cp, wrap, hooks, scope)
    i++
  }
}

/** 文本构造参数求值：字符串直接用；raw（this.xxx / 模板串）在作用域内求值，失败回退原文 */
function textContent(ir: IRNode, scope: Map<string, V> | null): string | null {
  const s = strOf(ir.ctorArgs[0])
  if (s !== null) return s
  const raw = rawOf(ir.ctorArgs[0])
  if (raw === null) return null
  const v = tryEval(raw, scope)
  return v !== undefined ? vToStr(v) : raw
}

// ---------- 构造参数 ----------

function spaceOf(ir: IRNode): string | number | null {
  const a = ir.ctorArgs[0]
  if (a === undefined || a.t !== 'obj') return null
  return lengthOf(objVal(a, 'space'))
}

// ---------- 主入口 ----------

export function buildFrame(ctx: UIContext, ir: IRNode, hooks: RenderHooks | null = null, path: string = '', scope: Map<string, V> | null = null): FrameNode | null {
  const n = buildNode(ctx, ir, hooks, path, scope)
  if (n !== null && hooks !== null) hooks.registry.set(path, n)
  return n
}

function buildNode(ctx: UIContext, ir: IRNode, hooks: RenderHooks | null, path: string, scope: Map<string, V> | null): FrameNode | null {
  switch (ir.type) {
    case 'Comment':
    case 'Expr':
      return null

    case 'If': {
      const cond = rawOf(ir.ctorArgs[0]) || '(?)'
      return placeholder(ctx, `if ${cond}`, '#f0f0f0', hooks, path)
    }
    case 'Else':
      return placeholder(ctx, 'else', '#f0f0f0', hooks, path)
    case 'ForEach': {
      const raw = rawOf(ir.ctorArgs[0])
      const n = raw !== null ? arrayLiteralCount(raw) : null
      return placeholder(ctx, n !== null ? `ForEach ×${n}` : 'ForEach', '#eaeaea', hooks, path)
    }
    case 'Unknown':
    case 'BuilderCall': {
      const raw = rawOf(ir.ctorArgs[0]) || ir.type
      return placeholder(ctx, raw.length > 24 ? raw.slice(0, 24) + '…' : raw, '#e8e8e8', hooks, path)
    }

    case 'Text': {
      const n = typeNode.createNode(ctx, 'Text')
      const c = textContent(ir, scope)
      n.initialize(c !== null ? c : '')
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyTextAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      return n
    }
    case 'Button': {
      const n = typeNode.createNode(ctx, 'Button')
      const label = textContent(ir, scope)
      const opt: ButtonOptions = {}
      const a1 = ir.ctorArgs[1]
      const bt = a1 !== undefined && a1.t === 'obj' ? BUTTON_TYPES.get(enumOf(objVal(a1, 'type')) || '') : undefined
      if (bt !== undefined) opt.type = bt
      // ArkUI Button 是「文本」或「子组件」二选一：有子组件时带 label 初始化再 appendChild 会炸
      if (label !== null && ir.children.length === 0) n.initialize(label, opt)
      else n.initialize(opt)
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyButtonAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Image': {
      const n = typeNode.createNode(ctx, 'Image')
      const s = strOf(ir.ctorArgs[0])
      if (s !== null) n.initialize(s)
      else {
        // $r()/表达式图源无法求值：给可见占位底，占位尺寸交给 width/height 修饰符
        n.attribute.backgroundColor('#e3e5e8')
      }
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyImageAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      return n
    }
    case 'TextInput': {
      const n = typeNode.createNode(ctx, 'TextInput')
      const a = ir.ctorArgs[0]
      if (a !== undefined && a.t === 'obj') {
        const o: TextInputOptions = {}
        const ph = strOf(objVal(a, 'placeholder')); if (ph !== null) o.placeholder = ph
        const tx = strOf(objVal(a, 'text')); if (tx !== null) o.text = tx
        n.initialize(o)
      } else {
        n.initialize({})
      }
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyTextInputAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      return n
    }
    case 'Divider': {
      const n = typeNode.createNode(ctx, 'Divider')
      n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyDividerAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      return n
    }
    case 'Blank': {
      const n = typeNode.createNode(ctx, 'Blank')
      n.initialize()
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      return n
    }
    case 'Column': {
      const n = typeNode.createNode(ctx, 'Column')
      const sp = spaceOf(ir)
      if (sp !== null) n.initialize({ space: sp })
      else n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyColumnAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Row': {
      const n = typeNode.createNode(ctx, 'Row')
      const sp = spaceOf(ir)
      if (sp !== null) n.initialize({ space: sp })
      else n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyRowAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Stack': {
      const n = typeNode.createNode(ctx, 'Stack')
      const a = ir.ctorArgs[0]
      const p = a !== undefined && a.t === 'obj' ? enumOf(objVal(a, 'alignContent')) : null
      const ac = p !== null ? ALIGNMENTS.get(p) : undefined
      if (ac !== undefined) n.initialize({ alignContent: ac })
      else n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyStackAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Flex': {
      const n = typeNode.createNode(ctx, 'Flex')
      const a = ir.ctorArgs[0]
      if (a !== undefined && a.t === 'obj') {
        const o: FlexOptions = {}
        const d = enumOf(objVal(a, 'direction'))
        if (d !== null) { const v = FLEX_DIRECTIONS.get(d); if (v !== undefined) o.direction = v }
        const w = enumOf(objVal(a, 'wrap'))
        if (w !== null) { const v = FLEX_WRAPS.get(w); if (v !== undefined) o.wrap = v }
        const jc = enumOf(objVal(a, 'justifyContent'))
        if (jc !== null) { const v = FLEX_ALIGNS.get(jc); if (v !== undefined) o.justifyContent = v }
        const ai = enumOf(objVal(a, 'alignItems'))
        if (ai !== null) { const v = ITEM_ALIGNS.get(ai); if (v !== undefined) o.alignItems = v }
        n.initialize(o)
      } else {
        n.initialize()
      }
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Scroll': {
      const n = typeNode.createNode(ctx, 'Scroll')
      n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyScrollAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'List': {
      const n = typeNode.createNode(ctx, 'List')
      const sp = spaceOf(ir)
      if (sp !== null) n.initialize({ space: sp })
      else n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyListAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, 'ListItem', hooks, path, scope)
      return n
    }
    case 'ListItem': {
      const n = typeNode.createNode(ctx, 'ListItem')
      n.initialize()
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Grid': {
      const n = typeNode.createNode(ctx, 'Grid')
      // Grid 构造签名是 (scroller?, layoutOptions?)，没有 space；间距走 columnsGap/rowsGap
      n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyGridAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, 'GridItem', hooks, path, scope)
      return n
    }
    case 'GridItem': {
      const n = typeNode.createNode(ctx, 'GridItem')
      n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applyGridItemAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Swiper': {
      const n = typeNode.createNode(ctx, 'Swiper')
      n.initialize()
      for (const m of ir.modifiers) {
        if (applyCommon(n.attribute, m)) continue
        applySwiperAttr(n.attribute, m)
      }
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'RelativeContainer': {
      const n = typeNode.createNode(ctx, 'RelativeContainer')
      n.initialize()
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      appendChildren(ctx, n, ir.children, '', hooks, path, scope)
      return n
    }
    case 'Progress': {
      const n = typeNode.createNode(ctx, 'Progress')
      const a = ir.ctorArgs[0]
      if (a !== undefined && a.t === 'obj') {
        const v = numOf(objVal(a, 'value'))
        const t = numOf(objVal(a, 'total'))
        n.initialize({ value: v !== null ? v : 0, total: t !== null ? t : 100 })
      } else {
        n.initialize({ value: 0, total: 100 })
      }
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      return n
    }
    case 'Checkbox': {
      const n = typeNode.createNode(ctx, 'Checkbox')
      const a = ir.ctorArgs[0]
      const name = a !== undefined && a.t === 'obj' ? strOf(objVal(a, 'name')) : null
      if (name !== null) n.initialize({ name: name })
      else n.initialize({})
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      return n
    }
    case 'Slider': {
      const n = typeNode.createNode(ctx, 'Slider')
      const a = ir.ctorArgs[0]
      if (a !== undefined && a.t === 'obj') {
        const o: SliderOptions = {}
        const v = numOf(objVal(a, 'value')); if (v !== null) o.value = v
        const mn = numOf(objVal(a, 'min')); if (mn !== null) o.min = mn
        const mx = numOf(objVal(a, 'max')); if (mx !== null) o.max = mx
        n.initialize(o)
      } else {
        n.initialize({})
      }
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      return n
    }
    case 'Toggle': {
      const n = typeNode.createNode(ctx, 'Toggle')
      const a = ir.ctorArgs[0]
      const o: ToggleOptions = { type: ToggleType.Switch }
      if (a !== undefined && a.t === 'obj') {
        const tp = enumOf(objVal(a, 'type'))
        if (tp === 'ToggleType.Button') o.type = ToggleType.Button
        else if (tp === 'ToggleType.Checkbox') o.type = ToggleType.Checkbox
        const on = boolOf(objVal(a, 'isOn')); if (on !== null) o.isOn = on
      }
      n.initialize(o)
      for (const m of ir.modifiers) applyCommon(n.attribute, m)
      tap(n.attribute, hooks, path)
      return n
    }
    default: {
      // Tabs/TabContent/Navigation 等 typeNode 不支持的类型：占位
      return placeholder(ctx, ir.type, '#eeeeee', hooks, path)
    }
  }
}
