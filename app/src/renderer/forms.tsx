import React, { useState } from 'react'
import { getModifier } from '../ir/mutate'
import { ViewProps, frameOf, ctorObj, resolveStr, resolveNum, resolveBool } from './shared'

/**
 * 表单组件组：TextInput / Toggle / Slider / Checkbox / Radio。
 * 预览可交互但只动本地 React state——绝不改 IR、不模拟 ArkTS 事件。
 * 初值可解析 this.xxx → 对应 @State 字面量初值。
 */

/** TextInput({ placeholder, text })：受控 input，初值解析 @State 字符串 */
export function TextInputView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const [val, setVal] = useState(() => resolveStr(o?.text, ctx.states) ?? '')
  return (
    <div {...f.common} style={{ display: 'flex', alignItems: 'center', ...f.style }}>
      <input
        className="ir-input"
        value={val}
        placeholder={resolveStr(o?.placeholder, ctx.states) ?? ''}
        onChange={(e) => setVal(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Toggle({ type: ToggleType.Switch, isOn })：switch 样式，点击切换本地状态 */
export function ToggleView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const [on, setOn] = useState(() => resolveBool(o?.isOn, ctx.states) ?? false)
  return (
    <div {...f.common} style={{ display: 'inline-flex', alignItems: 'center', ...f.style }}>
      <span className={'ir-switch' + (on ? ' on' : '')} onClick={() => setOn(!on)} />
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Slider({ value, min, max, step })：range 滑块 + 当前值标注 */
export function SliderView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const min = resolveNum(o?.min, ctx.states) ?? 0
  const max = resolveNum(o?.max, ctx.states) ?? 100
  const step = resolveNum(o?.step, ctx.states) ?? 1
  const [val, setVal] = useState(() => resolveNum(o?.value, ctx.states) ?? min)
  return (
    <div {...f.common} style={{ display: 'flex', alignItems: 'center', gap: 6, ...f.style }}>
      <input
        type="range"
        className="ir-slider"
        min={min} max={max} step={step} value={val}
        onChange={(e) => setVal(parseFloat(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <span className="ir-slider-val">{val}</span>
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Checkbox({ name, group })：勾选态取 .select(...) 修饰符（可解析 @State 布尔） */
export function CheckboxView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const [on, setOn] = useState(() => resolveBool(getModifier(node, 'select')?.args[0], ctx.states) ?? false)
  return (
    <div {...f.common} style={{ display: 'inline-flex', alignItems: 'center', ...f.style }}>
      <input
        type="checkbox"
        className="ir-check"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
      />
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Radio({ value, group })：选中态取 .checked(...)（支持 this.x === n 与 @State 初值比较） */
export function RadioView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const o = ctorObj(node)
  const group = o?.group && o.group.t === 'str' ? o.group.v : undefined
  const [on, setOn] = useState(() => resolveBool(getModifier(node, 'checked')?.args[0], ctx.states) ?? false)
  return (
    <div {...f.common} style={{ display: 'inline-flex', alignItems: 'center', ...f.style }}>
      <input
        type="radio"
        className="ir-check"
        name={group}
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
      />
      {f.indicator}
      {f.handles}
    </div>
  )
}

/** Select(options).selected(i).value(str)：拟态下拉框（选项多为运行时 .map()，不可静态求值→显示 .value 文本或占位） */
export function SelectView({ node, path, ctx }: ViewProps) {
  const f = frameOf(node, path, ctx)
  const value = resolveStr(getModifier(node, 'value')?.args[0], ctx.states)
  return (
    <div {...f.common} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      padding: '6px 10px', border: '1px solid #cbd5e0', borderRadius: 4, background: '#fff',
      minWidth: 60, ...f.style,
    }}>
      <span style={{ fontSize: 13, color: value ? '#2d3748' : '#a0aec0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value ?? '请选择'}
      </span>
      <span style={{ fontSize: 10, color: '#a0aec0' }}>▾</span>
      {f.indicator}
      {f.handles}
    </div>
  )
}
