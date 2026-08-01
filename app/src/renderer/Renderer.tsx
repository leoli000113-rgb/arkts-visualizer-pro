import React from 'react'
import { IRNode, IRState } from '../ir/types'
import { getModifier, Path } from '../ir/mutate'
import { DropTarget } from '../editor/dnd'
import { useStore } from '../store/store'
import { RelativeContainerEngine } from './RelativeContainer'
import {
  RenderCtx, RenderEnv, ViewProps,
  ctorObj, firstStr, firstStrE, num, vp, keyOf, frameOf, stackAlign, visibleChildren,
  splitTop, evalExpr, ForEachItem, RenderRes, resolveMediaRef,
} from './shared'
import { ArgVal } from '../ir/types'
import {
  FlexView, ScrollView, ListView, ListItemView,
  GridView, GridItemView, TabsView, TabContentView,
} from './containers'
import { TextInputView, ToggleView, SliderView, CheckboxView, RadioView, SelectView } from './forms'
import { ProgressView, VideoView, DividerView, BlankView, RatingView, LoadingProgressView } from './feedback'
import { BadgeView } from './containers'
import { IfView, ElseView, ForEachView, substTemplate } from './flow'
import { instanceStates } from './components'
import './renderer.css'

export const SUPPORTED = new Set([
  // 布局/层叠/相对
  'Column', 'Row', 'Stack', 'RelativeContainer',
  // 弹性/滚动/列表/网格/标签页/角标
  'Flex', 'Scroll', 'List', 'ListItem', 'Grid', 'GridItem', 'Tabs', 'TabContent', 'Badge',
  // 基础
  'Text', 'Button', 'Image', 'Video', 'Divider', 'Blank',
  // 表单
  'TextInput', 'Toggle', 'Slider', 'Checkbox', 'Radio', 'Select',
  // 反馈
  'Progress', 'Rating', 'LoadingProgress',
  // 结构/流程
  'If', 'Else', 'ForEach',
  // Builder 调用点镜像
  'BuilderCall',
])

export function renderNode(
  node: IRNode,
  path: Path,
  selectedPath: Path | null,
  onSelect: (p: Path) => void,
  dropTarget: DropTarget | null,
  noMargin = false,
  env?: RenderEnv,
): React.ReactNode {
  const states: IRState[] = env?.states ?? useStore.getState().ir?.states ?? []
  const aids = env?.aids ?? useStore.getState().showAids
  const styles = env?.styles ?? useStore.getState().stylesTable.styles ?? {}
  const extendsTable = env?.extends ?? useStore.getState().stylesTable.extends ?? {}
  const components = env?.components ?? useStore.getState().components ?? {}
  const builders = env?.builders ?? useStore.getState().builders ?? {}
  const depth = env?.depth ?? 0
  const res: RenderRes = env?.res ?? {
    media: useStore.getState().media,
    colors: useStore.getState().resColors,
    strings: useStore.getState().resStrings,
  }
  const childEnv: RenderEnv = { states, aids, styles, extends: extendsTable, components, builders, depth, res }
  const ctx: RenderCtx = {
    selectedPath,
    onSelect,
    dropTarget,
    states,
    aids,
    styles,
    extends: extendsTable,
    components,
    builders,
    depth,
    res,
    render: (c, p, nm) => renderNode(c, p, selectedPath, onSelect, dropTarget, nm ?? false, childEnv),
    renderChildren: (n, p) => visibleChildren(n.children, states).map(
      ({ c, i }) => renderNode(c, [...p, i], selectedPath, onSelect, dropTarget, false, childEnv),
    ),
  }
  const f = frameOf(node, path, ctx, noMargin)
  const k = keyOf(path)

  // 注释节点：不渲染（仅占路径下标）
  if (node.type === 'Comment') return null

  // 表达式语句（this.xxx() 等）：@Builder 带参调用先做只读替换渲染；其余仅辅助标记开启时显示小徽标
  if (node.type === 'Expr') {
    const raw = node.ctorArgs[0]
    const rawText = raw && raw.t === 'raw' ? raw.v : ''
    const bm = rawText.match(/^\s*this\.(\w+)\s*\(([\s\S]*?)\)\s*;?\s*$/)
    if (bm) {
      const def = builders[bm[1]]
      if (def) {
        const argRaws = splitTop(bm[2], ',').map(x => x.trim()).filter(x => x !== '')
        const vals = argRaws.map(a => evalExpr(a, states))
        if (argRaws.length > 0 && vals.every((v): v is ArgVal => !!v)) {
          // 参数按名替换进 @Builder 定义体（只读：pointer-events 穿透，编辑请走定义处）
          let children = def.children
          def.params.forEach((p, i) => {
            const v = vals[i]
            const item: ForEachItem | undefined =
              v.t === 'str' || v.t === 'num' ? v.v : v.t === 'obj' ? v.v : undefined
            if (item !== undefined) children = children.map(c => substTemplate(c, p, item))
          })
          return (
            <div key={k} {...f.common} className={ctx.aids ? 'ir-buildercall' : undefined} style={f.style}>
              {ctx.aids && (
                <div className="ir-buildercall-label">ƒ {rawText.replace(/;$/, '')}</div>
              )}
              <div style={{ pointerEvents: 'none', display: 'contents' }}>
                {children.map((c, i) =>
                  renderNode(c, [...path, i], null, () => {}, null, false,
                    { states, aids, styles, extends: extendsTable, components, builders, depth }))}
              </div>
              {f.indicator}
              {f.handles}
            </div>
          )
        }
      }
    }
    if (!ctx.aids) return null
    return (
      <div key={k} {...f.common} className="ir-expr" title={raw && raw.t === 'raw' ? raw.v : ''}>
        ƒ {raw && raw.t === 'raw' ? raw.v : node.type}
        {f.indicator}
      </div>
    )
  }

  // @Builder 调用点镜像：辅助标记开启时显示 ƒ 标签框；关闭时透明容器（页面即所得）
  if (node.type === 'BuilderCall') {
    const raw = node.ctorArgs[0]
    return (
      <div key={k} {...f.common} className={ctx.aids ? 'ir-buildercall' : undefined} style={f.style}>
        {ctx.aids && (
          <div className="ir-buildercall-label">ƒ {raw && raw.t === 'raw' ? raw.v.replace(/;$/, '') : '@Builder'}</div>
        )}
        {ctx.renderChildren(node, path)}
        {f.indicator}
        {f.handles}
      </div>
    )
  }

  if (!SUPPORTED.has(node.type)) {
    // 解析失败的 Unknown：保留醒目的错误提示（这不是辅助标记，是告警）
    if (node.unsupported) {
      return (
        <div key={k} {...f.common} style={{
          ...f.style, border: '1px dashed #f59e0b', color: '#b45309',
          background: '#fff7e0', padding: '2px 6px', fontSize: 10, borderRadius: 4,
        }}>
          ⚠️ 解析失败片段（已原文保留）
          {f.indicator}
          {f.handles}
        </div>
      )
    }
    // 同文件/跨文件自定义组件：按名解析并渲染其 build()，调用点参数按名覆盖；实例内部只读
    const comp = components[node.type]
    if (comp && depth < 3) {
      const instEnv: RenderEnv = {
        states: instanceStates(comp, ctorObj(node)),
        aids,
        styles,
        components,
        builders,
        depth: depth + 1,
        res,
      }
      return (
        <div key={k} {...f.common} className="ir-instance" style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', ...f.style }}>
          <div style={{ pointerEvents: 'none', display: 'contents' }}>
            {renderNode(comp.root, [], null, () => {}, null, false, instEnv)}
          </div>
          {f.indicator}
          {f.handles}
        </div>
      )
    }
    // 自定义组件（VideoPickerCard/Select 等）：中性占位卡片，不喧宾夺主
    return (
      <div key={k} {...f.common} className="ir-custom" style={{ ...f.style }}>
        <span className="ir-custom-name">{node.type}</span>
        {ctx.renderChildren(node, path)}
        {f.indicator}
        {f.handles}
      </div>
    )
  }

  const view: ViewProps = { node, path, ctx, noMargin }

  switch (node.type) {
    case 'Column': {
      const o = ctorObj(node)
      const space = o && num(o.space)
      // ArkUI Column 交叉轴默认 HorizontalAlign.Center（修饰符 alignItems 可覆盖）
      return (
        <div key={k} {...f.common} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: space != null ? `${vp(space!)}px` : undefined, ...f.style,
        }}>
          {ctx.renderChildren(node, path)}
          {f.indicator}
          {f.handles}
        </div>
      )
    }
    case 'Row': {
      const o = ctorObj(node)
      const space = o && num(o.space)
      // ArkUI Row 交叉轴默认 VerticalAlign.Center（修饰符 alignItems 可覆盖）
      return (
        <div key={k} {...f.common} style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: space != null ? `${vp(space!)}px` : undefined, ...f.style,
        }}>
          {ctx.renderChildren(node, path)}
          {f.indicator}
          {f.handles}
        </div>
      )
    }
    case 'Stack': {
      const o = ctorObj(node)
      const { justifyContent, alignItems } = stackAlign(o?.alignContent)
      // CSS grid 同格层叠：所有子节点放同一 grid 单元（1/1），Stack 尺寸 = 最大子节点
      // ——与 ArkUI Stack 一致（原先 absolute inset:0 层让 Stack 无在流内容，高度塌缩为 0，
      // 「轮播图」这类 Stack{Column(h150)} 结构在画布上直接消失/错位）。
      // .position() 子节点出流后相对 Stack 本层定位（而非某个 inset 层），锚点同样与真机一致。
      // 基线 alignSelf stretch：ArkUI 中子节点的百分比尺寸按父级「提供的约束」解析，
      // Stack{Column(100%)} 在真机是满宽的——CSS 里 100% 按最终包裹宽解析会循环塌缩，
      // stretch 让 Stack 先占满交叉轴约束，子节点 100% 随之与真机一致（显式 alignSelf 可覆盖）。
      return (
        <div key={k} {...f.common} style={{ position: 'relative', display: 'grid', alignSelf: 'stretch', ...f.style }}>
          {visibleChildren(node.children, states).map(({ c, i }) => {
            const rendered = ctx.render(c, [...path, i])
            // 折叠 If/注释等渲染为 null 的子节点不产出层，避免空层拦截点击/遮挡内容
            if (rendered === null) return null
            return (
              <div key={keyOf([...path, i])} style={{
                gridArea: '1 / 1', minWidth: 0, minHeight: 0,
                display: 'flex', alignItems, justifyContent,
                pointerEvents: 'none',
              }}>
                <div style={{ display: 'contents', pointerEvents: 'auto' }}>
                  {rendered}
                </div>
              </div>
            )
          })}
          {f.indicator}
          {f.handles}
        </div>
      )
    }
    case 'RelativeContainer':
      return (
        <RelativeContainerEngine
          key={k} node={node} path={path} style={f.style} selStyle={{}} common={f.common}
          handles={f.handles} indicator={f.indicator} dropTarget={dropTarget}
          renderChild={(c, cp) => ctx.render(c, cp, true)}
        />
      )
    case 'Text':
      return (
        <div key={k} {...f.common} style={{ display: 'inline-block', ...f.style }}>
          {firstStrE(node, states, res) ?? ''}
          {f.indicator}
          {f.handles}
        </div>
      )
    case 'Button': {
      const se = getModifier(node, 'stateEffect')
      const seOn = !!(se && se.args[0] && se.args[0].t === 'bool' && se.args[0].v)
      // ArkUI Button 默认外观：Capsule 圆角 + 主题蓝底白字（修饰符 type/backgroundColor/fontColor 可覆盖）
      return (
        <button key={k} {...f.common} className={seOn ? 'ir-state-effect' : undefined} style={{
          border: 'none', borderRadius: 999, padding: '6px 12px',
          backgroundColor: '#0A59F7', color: '#FFFFFF',
          cursor: 'default', ...f.style,
        }}>
          {firstStrE(node, states, res) ?? ''}
          {f.indicator}
          {f.handles}
        </button>
      )
    }
    case 'Image': {
      // 媒体可解析（$r('app.media.x')/$rawfile/路径/URL 命中导入媒体表）→ 真图渲染，否则占位
      const url = resolveMediaRef(node.ctorArgs[0], ctx.res.media)
      if (url) {
        const fit = (f.style.objectFit as string | undefined) ?? 'cover' // ArkUI 默认 ImageFit.Cover
        return (
          <div key={k} {...f.common} style={{ display: 'flex', overflow: 'hidden', ...f.style }}>
            <img src={url} draggable={false} alt="" style={{ width: '100%', height: '100%', objectFit: fit as never, display: 'block' }} />
            {f.indicator}
            {f.handles}
          </div>
        )
      }
      const src = firstStr(node) ?? (node.ctorArgs[0] && node.ctorArgs[0].t === 'raw' ? node.ctorArgs[0].v : '')
      return (
        <div key={k} {...f.common} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#888', fontSize: 11, border: '1px dashed #bbb',
          background: '#f3f3f3', ...f.style,
        }}>
          [Image: {src.length > 40 ? `${src.slice(0, 40)}…` : src}]
          {f.indicator}
          {f.handles}
        </div>
      )
    }

    // —— 容器组件组 ——
    case 'Flex': return <FlexView key={k} {...view} />
    case 'Scroll': return <ScrollView key={k} {...view} />
    case 'List': return <ListView key={k} {...view} />
    case 'ListItem': return <ListItemView key={k} {...view} />
    case 'Grid': return <GridView key={k} {...view} />
    case 'GridItem': return <GridItemView key={k} {...view} />
    case 'Tabs': return <TabsView key={k} {...view} />
    case 'TabContent': return <TabContentView key={k} {...view} />

    // —— 表单组件组 ——
    case 'TextInput': return <TextInputView key={k} {...view} />
    case 'Toggle': return <ToggleView key={k} {...view} />
    case 'Slider': return <SliderView key={k} {...view} />
    case 'Checkbox': return <CheckboxView key={k} {...view} />
    case 'Radio': return <RadioView key={k} {...view} />
    case 'Select': return <SelectView key={k} {...view} />

    // —— 反馈组件组 ——
    case 'Progress': return <ProgressView key={k} {...view} />
    case 'Video': return <VideoView key={k} {...view} />
    case 'Divider': return <DividerView key={k} {...view} />
    case 'Blank': return <BlankView key={k} {...view} />
    case 'Rating': return <RatingView key={k} {...view} />
    case 'LoadingProgress': return <LoadingProgressView key={k} {...view} />
    case 'Badge': return <BadgeView key={k} {...view} />

    // —— 结构/流程 ——
    case 'If': return <IfView key={k} {...view} />
    case 'Else': return <ElseView key={k} {...view} />
    case 'ForEach': return <ForEachView key={k} {...view} />

    default:
      return null
  }
}
