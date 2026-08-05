import React, { CSSProperties, useState } from 'react'
import { getModifier } from '../ir/mutate'
import {
  ViewProps, frameOf, ctorObj, vp, num, keyOf,
  flexJustify, itemAlign, resolveNum, resolveStr, resolveBool,
} from './shared'

/**
 * 容器组件组：Flex / Scroll / List / ListItem / Grid / GridItem / Tabs / TabContent。
 * 全部通过 frameOf 获得与现有 7 种一致的选中高亮 / 尺寸把手 / 落点指示。
 */

/** Flex({ direction, justifyContent, wrap, alignItems }) → CSS flex */
export function FlexView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  let flexDirection: CSSProperties['flexDirection'] = 'row'
  const dirArg = o?.direction
  if (dirArg && dirArg.t === 'enum') {
    switch (dirArg.v) {
      case 'FlexDirection.Column': flexDirection = 'column'; break
      case 'FlexDirection.RowReverse': flexDirection = 'row-reverse'; break
      case 'FlexDirection.ColumnReverse': flexDirection = 'column-reverse'; break
      default: flexDirection = 'row'
    }
  }
  let flexWrap: CSSProperties['flexWrap']
  const wrapArg = o?.wrap
  if (wrapArg && wrapArg.t === 'enum') {
    if (wrapArg.v === 'FlexWrap.Wrap') flexWrap = 'wrap'
    else if (wrapArg.v === 'FlexWrap.WrapReverse') flexWrap = 'wrap-reverse'
    else flexWrap = 'nowrap'
  }
  return (
    <div {...f.common} style={{
      display: 'flex', flexDirection, flexWrap,
      justifyContent: flexJustify(o?.justifyContent),
      alignItems: itemAlign(o?.alignItems),
      ...f.style,
    }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Scroll：.scrollable(ScrollDirection.*) → overflow，默认 Vertical。
 *  ArkUI 滚动容器默认占满父组件交叉轴（模板常不写 width 也满宽）→ 基线 alignSelf stretch；
 *  显式 width/alignSelf 修饰符经 f.style 自然覆盖（stretch 对显式交叉轴尺寸无效）。 */
export function ScrollView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const dir = getModifier(node, 'scrollable')?.args[0]
  const horizontal = !!dir && dir.t === 'enum' && dir.v.endsWith('.Horizontal')
  return (
    <div {...f.common} style={{
      alignSelf: 'stretch',
      overflowX: horizontal ? 'auto' : 'hidden',
      overflowY: horizontal ? 'hidden' : 'auto',
      ...f.style,
    }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** List：ctor obj space → gap，默认纵向；.listDirection(Axis.Horizontal) → 横向（交叉轴占满同 Scroll） */
export function ListView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const space = o && num(o.space)
  const dirM = getModifier(node, 'listDirection')?.args[0]
  const horizontal = !!dirM && dirM.t === 'enum' && dirM.v.endsWith('.Horizontal')
  return (
    <div {...f.common} style={{
      alignSelf: 'stretch',
      display: 'flex', flexDirection: horizontal ? 'row' : 'column',
      gap: space != null ? `${vp(space)}px` : undefined,
      ...f.style,
    }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** ListItem：列表项普通块容器 */
export function ListItemView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  return (
    <div {...f.common} style={{ ...f.style }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Grid：.columnsTemplate/.rowsTemplate → grid-template-*；.rowsGap/.columnsGap → 间距 */
export function GridView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const strMod = (name: string): string | undefined => {
    const a = getModifier(node, name)?.args[0]
    return a && a.t === 'str' ? a.v : undefined
  }
  const numMod = (name: string): number | undefined => {
    const a = getModifier(node, name)?.args[0]
    return a && a.t === 'num' ? a.v : undefined
  }
  const rowsGap = numMod('rowsGap')
  const columnsGap = numMod('columnsGap')
  return (
    <div {...f.common} style={{
      alignSelf: 'stretch',
      display: 'grid',
      gridTemplateColumns: strMod('columnsTemplate'),
      gridTemplateRows: strMod('rowsTemplate'),
      rowGap: rowsGap != null ? vp(rowsGap) : undefined,
      columnGap: columnsGap != null ? vp(columnsGap) : undefined,
      ...f.style,
    }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** GridItem：网格项普通容器 */
export function GridItemView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  return (
    <div {...f.common} style={{ ...f.style }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/**
 * Tabs：本地 React state 记当前标签（初值取 ctor obj index，可解析 this.x @State），
 * 标签栏文本取各 TabContent 的 .tabBar('...')；非当前 TabContent 以 display:none 保留在
 * DOM 中（SSR/测试可见全量内容），点击标签即时切换。
 * barPosition: Start（默认，顶/左）/ End（底/右）；vertical(true) 时页签栏竖排在左/右。
 * .barMode 先按固定栏呈现。
 */
export function TabsView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const [active, setActive] = useState(() => Math.round(resolveNum(o?.index, ctx.states) ?? 0))
  const cur = Math.max(0, Math.min(active, Math.max(0, node.children.length - 1)))
  // ArkUI：barPosition 默认 Start（水平 Tabs 在顶、垂直在左），End 在底/右
  const bp = o?.barPosition
  const barEnd = !!bp && bp.t === 'enum' && bp.v.endsWith('.End')
  const vertical = resolveBool(o?.vertical, ctx.states) ?? false
  const bar = (
    <div key="bar"
      className={'ir-tabs-bar' + (barEnd ? ' end' : '') + (vertical ? ' vertical' : '')}>
      {node.children.map((c, i) => {
        const ta = getModifier(c, 'tabBar')?.args[0]
        const label = ta && ta.t === 'str' ? ta.v : `Tab ${i + 1}`
        return (
          <div key={i}
            className={'ir-tabs-tab' + (i === cur ? ' active' : '')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setActive(i) }}>
            {label}
          </div>
        )
      })}
    </div>
  )
  const contents = node.children.map((c, i) => (
    <TabContentView key={keyOf([...path, i])} node={c} path={[...path, i]} ctx={ctx} hidden={i !== cur} />
  ))
  return (
    <div {...f.common} style={{
      alignSelf: 'stretch',
      display: 'flex', flexDirection: vertical ? 'row' : 'column',
      ...f.style,
    }}>
      {!barEnd && bar}
      {contents}
      {barEnd && bar}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/**
 * TabContent：单页内容容器；hidden 时仅隐藏不卸载。
 * ArkUI：TabContent 大小 = Tabs 内容区（宽撑满、高 = Tabs − TabBar），其独子按「占满约束」
 * 测量——未显式设尺寸时充满整个 TabContent（真机上 Column.justifyContent(Center) 才能垂直居中，
 * 画布若让子组件包裹内容，居中/百分比高度全部失效，内容堆在顶部）。
 * 用 grid 满格复现：auto 尺寸子组件默认 stretch 撑满；显式宽高不受 stretch 影响，与真机一致。
 */
export function TabContentView({ node, path, ctx, hidden }: ViewProps & { hidden?: boolean }) {
  const f = frameOf(node, path, ctx)
  return (
    <div {...f.common} style={{
      display: hidden ? 'none' : 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'minmax(0, 1fr)',
      gridAutoRows: 'minmax(0, 1fr)',
      flex: 1, minWidth: 0, minHeight: 0,
      ...f.style,
    }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Badge({ count, value })：独子容器 + 右上角角标（count>0 显示数字；value 字符串显示文本） */
export function BadgeView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const count = resolveNum(o?.count, ctx.states)
  const value = resolveStr(o?.value, ctx.states)
  const showNum = count != null && count > 0
  return (
    <div {...f.common} style={{ position: 'relative', display: 'inline-block', ...f.style }}>
      {ctx.renderChildren(node, path)}
      {(showNum || value) && (
        <span style={{
          position: 'absolute', top: -6, right: -6, zIndex: 1,
          minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
          background: '#FA2A2D', color: '#fff', fontSize: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {value ?? (count! > 99 ? '99+' : count)}
        </span>
      )}
      {f.indicator}
      {f.handles}
    </div>
  )
}
