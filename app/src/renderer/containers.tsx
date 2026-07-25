import React, { CSSProperties, useState } from 'react'
import { getModifier } from '../ir/mutate'
import {
  ViewProps, frameOf, ctorObj, vp, num, keyOf,
  flexJustify, itemAlign, resolveNum,
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

/** Scroll：.scrollable(ScrollDirection.*) → overflow，默认 Vertical */
export function ScrollView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const dir = getModifier(node, 'scrollable')?.args[0]
  const horizontal = !!dir && dir.t === 'enum' && dir.v.endsWith('.Horizontal')
  return (
    <div {...f.common} style={{
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

/** List：ctor obj space → gap，默认纵向；.listDirection(Axis.Horizontal) → 横向 */
export function ListView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const space = o && num(o.space)
  const dirM = getModifier(node, 'listDirection')?.args[0]
  const horizontal = !!dirM && dirM.t === 'enum' && dirM.v.endsWith('.Horizontal')
  return (
    <div {...f.common} style={{
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
 * DOM 中（SSR/测试可见全量内容），点击标签即时切换。.barMode 先按固定栏呈现。
 */
export function TabsView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const [active, setActive] = useState(() => Math.round(resolveNum(o?.index, ctx.states) ?? 0))
  const cur = Math.max(0, Math.min(active, Math.max(0, node.children.length - 1)))
  return (
    <div {...f.common} style={{ display: 'flex', flexDirection: 'column', ...f.style }}>
      <div className="ir-tabs-bar">
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
      {node.children.map((c, i) => (
        <TabContentView key={keyOf([...path, i])} node={c} path={[...path, i]} ctx={ctx} hidden={i !== cur} />
      ))}
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** TabContent：单页内容容器；hidden 时仅隐藏不卸载 */
export function TabContentView({ node, path, ctx, hidden }: ViewProps & { hidden?: boolean }) {
  const f = frameOf(node, path, ctx)
  return (
    <div {...f.common} style={{
      display: hidden ? 'none' : 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
      ...f.style,
    }}>
      {ctx.renderChildren(node, path)}
      {f.indicator}
      {f.handles}
    </div>
  )
}
