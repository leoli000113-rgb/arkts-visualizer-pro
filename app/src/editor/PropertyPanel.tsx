import { useState } from 'react'
import { useStore } from '../store/store'
import { getModifier, getNodeAtPath, numModifier, setModifier, Path } from '../ir/mutate'
import { serializeArg } from '../ir/serialize'
import { ArgVal, IRNode } from '../ir/types'

/* ---------- 读写辅助（全部经 store.mutateNode） ---------- */

type Mut = (fn: (n: IRNode) => IRNode) => void

const ctorObj = (n: IRNode): Record<string, ArgVal> | undefined => {
  const a = n.ctorArgs[0]
  return a && a.t === 'obj' ? a.v : undefined
}

const setCtorObjField = (mut: Mut, key: string, val: ArgVal | undefined) =>
  mut(n => {
    const cur = ctorObj(n) ?? {}
    const next = { ...cur }
    if (val === undefined) delete next[key]
    else next[key] = val
    return { ...n, ctorArgs: [{ t: 'obj', v: next }] }
  })

const setMod = (mut: Mut, name: string, args: ArgVal[]) => mut(n => setModifier(n, name, args))
const removeMod = (mut: Mut, name: string) =>
  mut(n => ({ ...n, modifiers: n.modifiers.filter(m => m.name !== name) }))

function hexToCss(a: ArgVal | undefined): string {
  if (!a || a.t !== 'hex') return '#000000'
  const s = a.v.toString(16).toUpperCase().padStart(6, '0')
  // 8 位含 alpha 的值只取低 24 位供 color 控件显示，写回按数值处理
  return '#' + (s.length > 6 ? s.slice(-6) : s)
}

/* ---------- 属性说明 tooltip（感叹号） ---------- */

function PropTip({ text }: { text?: string }) {
  if (!text) return null
  return <span className="prop-tip" data-tip={text}>!</span>
}

/** 属性中文说明：key 为修饰符名或常用标签 */
const TIPS: Record<string, string> = {
  width: '组件宽度。数字 = vp（1vp = 1/160 英寸），也可填 100% 占满父容器',
  height: '组件高度。数字 = vp，也可填 100%',
  padding: '内边距（vp）：内容与组件边框之间的距离，支持单值或 { top, left, right, bottom }',
  margin: '外边距（vp）：组件与兄弟/父容器之间的距离',
  backgroundColor: '背景颜色。格式 0xRRGGBB 或 0xAARRGGBB（前两位为透明度），也支持 Color.* 枚举',
  fontColor: '文字颜色，格式同背景色',
  fontSize: '文字大小（fp，预览按 vp 等价换算）',
  fontWeight: '字重：Lighter 细 ~ Bolder 特粗，Bold = 700',
  textAlign: '多行文本的水平对齐方式',
  maxLines: '文本最大行数，超出部分截断',
  opacity: '不透明度，0（全透明）~ 1（不透明）',
  borderRadius: '圆角半径（vp）',
  borderWidth: '边框宽度（vp）',
  borderColor: '边框颜色，格式同背景色',
  layoutWeight: '在 Row/Column 中按权重瓜分剩余空间（0 = 按内容大小）',
  flexGrow: '在 Flex 容器中空间富余时的放大比例',
  flexShrink: '在 Flex 容器中空间不足时的缩小比例',
  alignSelf: '覆盖父容器对本组件的交叉轴对齐方式',
  position: '绝对定位 { x, y }（vp）：相对父容器左上角，脱离正常布局流（常用于 Stack 内自由摆放）',
  offset: '相对正常布局位置的偏移 { x, y }（vp），不影响其他组件的位置',
  zIndex: '层叠顺序：值大的盖住值小的',
  aspectRatio: '宽高比（宽/高），如 1.5 = 3:2',
  visibility: 'Visible 显示 / Hidden 不可见但占位 / None 彻底移除不占位',
  enabled: 'false 时组件禁用不可交互（预览中调暗呈现）',
  space: '子组件之间的间距（vp）',
  justifyContent: '主轴方向的对齐与分布（Row=水平，Column=垂直）',
  alignItems: '交叉轴方向的对齐（Row=垂直，Column=水平）',
  alignContent: 'Stack 中所有子组件的整体对齐位置（九宫格）',
  type: '按钮样式：Capsule 胶囊 / Normal 圆角矩形 / Circle 圆形',
  stateEffect: 'true 时按下有按压变暗反馈',
  objectFit: '图片缩放填充方式：Contain 完整显示留白 / Cover 填满裁剪 / Fill 拉伸',
  scrollable: '滚动方向：Vertical 垂直 / Horizontal 水平',
  columnsTemplate: '网格列模板：如 1fr 1fr 1fr 表示三等分列',
  rowsGap: '网格行间距（vp）',
  columnsGap: '网格列间距（vp）',
  tabBar: '该标签页在标签栏显示的标题文字',
  placeholder: '输入框为空时显示的提示文字',
  text: '显示的文本内容',
  src: '资源路径，如 $r(\'app.media.xxx\') 或占位文件名',
  value: '当前值',
  min: '最小值',
  max: '最大值',
  step: '步长：每次增减的最小单位',
  total: '总量：Progress 的总进度值',
  isOn: '开关当前是否打开',
  id: '组件标识：RelativeContainer 的 alignRules 锚点通过 id 引用',
  name: '表单项名称',
  group: '分组标识：同组 Radio/Checkbox 互斥',
}

function NumField({ label, value, onSet, step, tip }: {
  label: string; value: number | undefined; onSet: (v: number | undefined) => void; step?: string; tip?: string
}) {
  return (
    <label className="prop-row"><span>{label}<PropTip text={tip ?? TIPS[label]} /></span>
      <input type="number" step={step} value={value ?? ''} placeholder="未设置"
        onChange={(e) => {
          if (e.target.value === '') { onSet(undefined); return }
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onSet(n)
        }} />
    </label>
  )
}

/** width/height：纯数字→num(vp)，其它非空→str（如 100%），清空→移除修饰符 */
function SizeField({ label, mod, node, mut }: { label: string; mod: string; node: IRNode; mut: Mut }) {
  const a = getModifier(node, mod)?.args[0]
  const text = a ? (a.t === 'num' ? String(a.v) : a.t === 'str' ? a.v : serializeArg(a)) : ''
  return (
    <label className="prop-row"><span>{label}<PropTip text={TIPS[mod]} /></span>
      <input value={text} placeholder="未设置（数字=vp，可填 100%）"
        onChange={(e) => {
          const v = e.target.value
          if (v === '') { removeMod(mut, mod); return }
          if (/^\d+(\.\d+)?$/.test(v)) setMod(mut, mod, [{ t: 'num', v: parseFloat(v) }])
          else setMod(mut, mod, [{ t: 'str', v }])
        }} />
    </label>
  )
}

/** padding/margin：num 单值简化编辑；obj 等多值原文显示为占位提示（改单值即覆盖） */
function BoxNumField({ label, mod, node, mut }: { label: string; mod: string; node: IRNode; mut: Mut }) {
  const a = getModifier(node, mod)?.args[0]
  const text = a && a.t === 'num' ? String(a.v) : ''
  const hint = a ? (a.t === 'num' ? '未设置' : serializeArg(a)) : '未设置'
  return (
    <label className="prop-row"><span>{label}<PropTip text={TIPS[mod]} /></span>
      <input type="number" value={text} placeholder={hint}
        onChange={(e) => {
          if (e.target.value === '') { removeMod(mut, mod); return }
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) setMod(mut, mod, [{ t: 'num', v: n }])
        }} />
    </label>
  )
}

function StrModField({ label, mod, node, mut }: { label: string; mod: string; node: IRNode; mut: Mut }) {
  const a = getModifier(node, mod)?.args[0]
  const text = a ? (a.t === 'str' ? a.v : serializeArg(a)) : ''
  return (
    <label className="prop-row"><span>{label}<PropTip text={TIPS[mod]} /></span>
      <input value={text} placeholder="未设置"
        onChange={(e) => e.target.value === ''
          ? removeMod(mut, mod)
          : setMod(mut, mod, [{ t: 'str', v: e.target.value }])} />
    </label>
  )
}

function EnumField({ label, value, options, allowUnset, onSet, tip }: {
  label: string; value: string | undefined; options: string[]; allowUnset?: boolean
  onSet: (v: string | undefined) => void; tip?: string
}) {
  return (
    <label className="prop-row"><span>{label}<PropTip text={tip ?? TIPS[label]} /></span>
      <select value={value ?? ''} onChange={(e) => onSet(e.target.value === '' ? undefined : e.target.value)}>
        {allowUnset !== false && <option value="">（默认）</option>}
        {options.map(o => <option key={o} value={o}>{o.includes('.') ? o.split('.').pop() : o}</option>)}
        {value && !options.includes(value) && <option value={value}>{value}</option>}
      </select>
    </label>
  )
}

function EnumModField({ label, mod, options, node, mut }: {
  label: string; mod: string; options: string[]; node: IRNode; mut: Mut
}) {
  const a = getModifier(node, mod)?.args[0]
  const v = a && a.t === 'enum' ? a.v : undefined
  return <EnumField label={label} value={v} options={options} tip={TIPS[mod]}
    onSet={(x) => x === undefined ? removeMod(mut, mod) : setMod(mut, mod, [{ t: 'enum', v: x }])} />
}

function BoolModField({ label, mod, node, mut }: { label: string; mod: string; node: IRNode; mut: Mut }) {
  const a = getModifier(node, mod)?.args[0]
  const v = a && a.t === 'bool' ? String(a.v) : ''
  return (
    <label className="prop-row"><span>{label}<PropTip text={TIPS[mod]} /></span>
      <select value={v} onChange={(e) => {
        if (e.target.value === '') removeMod(mut, mod)
        else setMod(mut, mod, [{ t: 'bool', v: e.target.value === 'true' }])
      }}>
        <option value="">（默认）</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </label>
  )
}

/** 颜色：取色器 + hex 文本双编辑。文本支持 0xRRGGBB / 0xAARRGGBB / Color.*，Enter 或失焦提交 */
function ColorModField({ label, mod, node, mut }: { label: string; mod: string; node: IRNode; mut: Mut }) {
  const a = getModifier(node, mod)?.args[0]
  const committed = a ? serializeArg(a) : ''
  const [text, setText] = useState(committed)
  const commit = () => {
    const v = text.trim()
    if (v === '') { removeMod(mut, mod); return }
    let m = v.match(/^0x([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
    if (m) { setMod(mut, mod, [{ t: 'hex', v: parseInt(m[1], 16) }]); return }
    m = v.match(/^Color\.\w+$/)
    if (m) { setMod(mut, mod, [{ t: 'enum', v }]); return }
    setText(committed) // 无法识别：回退为已提交值
  }
  return (
    <label className="prop-row"><span>{label}<PropTip text={TIPS[mod]} /></span>
      <input type="color" value={hexToCss(a)}
        onChange={(e) => setMod(mut, mod, [{ t: 'hex', v: parseInt(e.target.value.slice(1), 16) }])} />
      <input className="hex-input" value={text} placeholder="0xRRGGBB" spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }} />
    </label>
  )
}

/** position/offset：{ x, y } 对象双数值编辑；两值都清空时移除修饰符 */
function XYModField({ label, mod, node, mut }: { label: string; mod: string; node: IRNode; mut: Mut }) {
  const a = getModifier(node, mod)?.args[0]
  const obj = a && a.t === 'obj' ? a.v : undefined
  const xv = obj?.x && obj.x.t === 'num' ? obj.x.v : undefined
  const yv = obj?.y && obj.y.t === 'num' ? obj.y.v : undefined
  const set = (x: number | undefined, y: number | undefined) => {
    if (x === undefined && y === undefined) { removeMod(mut, mod); return }
    setMod(mut, mod, [{ t: 'obj', v: { x: { t: 'num', v: x ?? 0 }, y: { t: 'num', v: y ?? 0 } } }])
  }
  const onNum = (cur: number | undefined, apply: (v: number | undefined) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') { apply(undefined); return }
    const n = parseFloat(e.target.value)
    if (Number.isFinite(n)) apply(n)
  }
  return (
    <label className="prop-row"><span>{label}<PropTip text={TIPS[mod]} /></span>
      <input type="number" value={xv ?? ''} placeholder="x" onChange={onNum(xv, (v) => set(v, yv))} />
      <input type="number" value={yv ?? ''} placeholder="y" onChange={onNum(yv, (v) => set(xv, v))} />
    </label>
  )
}

/** 首构造参数文本：str 直改；raw 显原文可改；obj/enum 等只读展示序列化文本 */
function CtorTextField({ label, node, mut }: { label: string; node: IRNode; mut: Mut }) {
  const a = node.ctorArgs[0]
  if (!a) return null
  if (a.t === 'str' || a.t === 'raw') {
    return (
      <label className="prop-row"><span>{label}</span>
        <input value={a.v} onChange={(e) => mut(n => ({ ...n, ctorArgs: [{ t: a.t, v: e.target.value }] }))} />
      </label>
    )
  }
  return (
    <label className="prop-row"><span>{label}</span>
      <input value={serializeArg(a)} readOnly title="复杂表达式，请在代码窗修改" />
    </label>
  )
}

/* ---------- 枚举常量 ---------- */

const BUTTON_TYPES = ['ButtonType.Capsule', 'ButtonType.Normal', 'ButtonType.Circle', 'ButtonType.ROUNDED_RECTANGLE']
const IMAGE_FITS = ['ImageFit.Contain', 'ImageFit.Cover', 'ImageFit.Auto', 'ImageFit.Fill', 'ImageFit.None', 'ImageFit.ScaleDown']
const FLEX_ALIGNS = ['FlexAlign.Start', 'FlexAlign.Center', 'FlexAlign.End', 'FlexAlign.SpaceBetween', 'FlexAlign.SpaceAround', 'FlexAlign.SpaceEvenly']
const H_ALIGNS = ['HorizontalAlign.Start', 'HorizontalAlign.Center', 'HorizontalAlign.End']
const V_ALIGNS = ['VerticalAlign.Top', 'VerticalAlign.Center', 'VerticalAlign.Bottom']
const ALIGNMENTS = ['Alignment.TopStart', 'Alignment.Top', 'Alignment.TopEnd', 'Alignment.Start', 'Alignment.Center', 'Alignment.End', 'Alignment.BottomStart', 'Alignment.Bottom', 'Alignment.BottomEnd']
const FONT_WEIGHTS = ['FontWeight.Lighter', 'FontWeight.Normal', 'FontWeight.Regular', 'FontWeight.Medium', 'FontWeight.Bold', 'FontWeight.Bolder']
const TEXT_ALIGNS = ['TextAlign.Start', 'TextAlign.Center', 'TextAlign.End', 'TextAlign.Left', 'TextAlign.Right']
const PROGRESS_TYPES = ['ProgressType.Linear', 'ProgressType.Circular', 'ProgressType.Eclipse', 'ProgressType.ScaleRing', 'ProgressType.Capsule']
const SCROLL_DIRS = ['ScrollDirection.Vertical', 'ScrollDirection.Horizontal', 'ScrollDirection.Free', 'ScrollDirection.None']
const VISIBILITIES = ['Visibility.Visible', 'Visibility.Hidden', 'Visibility.None']
const ITEM_ALIGNS = ['ItemAlign.Auto', 'ItemAlign.Start', 'ItemAlign.Center', 'ItemAlign.End', 'ItemAlign.Stretch', 'ItemAlign.Baseline']

/** If/Else/ForEach/BuilderCall：修饰符不参与序列化，面板只展示信息 */
const STRUCTURAL = new Set(['If', 'Else', 'ForEach', 'BuilderCall'])

/* ---------- 专属编辑区（未知类型返回 null，仅通用区兜底） ---------- */

function SpecificFields({ node, mut }: { node: IRNode; mut: Mut }) {
  const obj = ctorObj(node)
  const objNum = (k: string) => { const a = obj?.[k]; return a && a.t === 'num' ? a.v : undefined }
  const objStr = (k: string) => { const a = obj?.[k]; return a && a.t === 'str' ? a.v : undefined }
  const objEnum = (k: string) => { const a = obj?.[k]; return a && a.t === 'enum' ? a.v : undefined }
  const objBool = (k: string) => { const a = obj?.[k]; return a && a.t === 'bool' ? a.v : undefined }
  const setObjNum = (k: string) => (v: number | undefined) =>
    setCtorObjField(mut, k, v === undefined ? undefined : { t: 'num', v })

  switch (node.type) {
    case 'Text':
      return (<>
        <CtorTextField label="text" node={node} mut={mut} />
        <NumField label="fontSize" value={numModifier(node, 'fontSize')} onSet={(v) => v === undefined ? removeMod(mut, 'fontSize') : setMod(mut, 'fontSize', [{ t: 'num', v }])} />
        <ColorModField label="fontColor" mod="fontColor" node={node} mut={mut} />
        <EnumModField label="fontWeight" mod="fontWeight" options={FONT_WEIGHTS} node={node} mut={mut} />
        <EnumModField label="textAlign" mod="textAlign" options={TEXT_ALIGNS} node={node} mut={mut} />
        <NumField label="maxLines" value={numModifier(node, 'maxLines')} onSet={(v) => v === undefined ? removeMod(mut, 'maxLines') : setMod(mut, 'maxLines', [{ t: 'num', v }])} />
      </>)
    case 'Button':
      return (<>
        <CtorTextField label="text" node={node} mut={mut} />
        <EnumModField label="type" mod="type" options={BUTTON_TYPES} node={node} mut={mut} />
        <BoolModField label="stateEffect" mod="stateEffect" node={node} mut={mut} />
        <ColorModField label="背景色" mod="backgroundColor" node={node} mut={mut} />
      </>)
    case 'Image':
      return (<>
        <CtorTextField label="src" node={node} mut={mut} />
        <EnumModField label="objectFit" mod="objectFit" options={IMAGE_FITS} node={node} mut={mut} />
      </>)
    case 'Column':
    case 'Row':
      return (<>
        <NumField label="space" value={objNum('space')} onSet={setObjNum('space')} />
        <EnumModField label="justifyContent" mod="justifyContent" options={FLEX_ALIGNS} node={node} mut={mut} />
        <EnumModField label="alignItems" mod="alignItems" options={node.type === 'Column' ? H_ALIGNS : V_ALIGNS} node={node} mut={mut} />
      </>)
    case 'Stack':
      return (
        <EnumField label="alignContent" value={objEnum('alignContent')} options={ALIGNMENTS}
          onSet={(v) => setCtorObjField(mut, 'alignContent', v === undefined ? undefined : { t: 'enum', v })} />
      )
    case 'TextInput': {
      const textA = obj?.text
      return (<>
        <label className="prop-row"><span>placeholder</span>
          <input value={objStr('placeholder') ?? ''} placeholder="未设置"
            onChange={(e) => setCtorObjField(mut, 'placeholder', e.target.value === '' ? undefined : { t: 'str', v: e.target.value })} />
        </label>
        {textA && textA.t !== 'str' ? (
          <label className="prop-row"><span>text</span>
            <input value={serializeArg(textA)} readOnly title="绑定状态变量，请在代码窗修改" />
          </label>
        ) : (
          <label className="prop-row"><span>text</span>
            <input value={objStr('text') ?? ''} placeholder="未设置"
              onChange={(e) => setCtorObjField(mut, 'text', e.target.value === '' ? undefined : { t: 'str', v: e.target.value })} />
          </label>
        )}
      </>)
    }
    case 'Slider':
      return (<>
        <NumField label="value" value={objNum('value')} onSet={setObjNum('value')} />
        <NumField label="min" value={objNum('min')} onSet={setObjNum('min')} />
        <NumField label="max" value={objNum('max')} onSet={setObjNum('max')} />
        <NumField label="step" value={objNum('step')} onSet={setObjNum('step')} />
      </>)
    case 'Toggle': {
      const isOnA = obj?.isOn
      if (isOnA && isOnA.t !== 'bool') {
        return (
          <label className="prop-row"><span>isOn</span>
            <input value={serializeArg(isOnA)} readOnly title="绑定状态变量，请在代码窗修改" />
          </label>
        )
      }
      return (
        <label className="prop-row"><span>isOn</span>
          <select value={objBool('isOn') === undefined ? '' : String(objBool('isOn'))}
            onChange={(e) => setCtorObjField(mut, 'isOn', e.target.value === '' ? undefined : { t: 'bool', v: e.target.value === 'true' })}>
            <option value="">（未设置）</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      )
    }
    case 'Progress':
      return (<>
        <NumField label="value" value={objNum('value')} onSet={setObjNum('value')} />
        <NumField label="total" value={objNum('total')} onSet={setObjNum('total')} />
        <EnumField label="type" value={objEnum('type')} options={PROGRESS_TYPES} allowUnset={false}
          onSet={(v) => v !== undefined && setCtorObjField(mut, 'type', { t: 'enum', v })} />
      </>)
    case 'Grid':
      return (<>
        <StrModField label="columnsTemplate" mod="columnsTemplate" node={node} mut={mut} />
        <NumField label="rowsGap" value={numModifier(node, 'rowsGap')} onSet={(v) => v === undefined ? removeMod(mut, 'rowsGap') : setMod(mut, 'rowsGap', [{ t: 'num', v }])} />
        <NumField label="columnsGap" value={numModifier(node, 'columnsGap')} onSet={(v) => v === undefined ? removeMod(mut, 'columnsGap') : setMod(mut, 'columnsGap', [{ t: 'num', v }])} />
      </>)
    case 'TabContent':
      return <StrModField label="tabBar" mod="tabBar" node={node} mut={mut} />
    case 'List':
      return <NumField label="space" value={objNum('space')} onSet={setObjNum('space')} />
    case 'Scroll':
      return <EnumModField label="scrollable" mod="scrollable" options={SCROLL_DIRS} node={node} mut={mut} />
    default:
      return null
  }
}

/* ---------- 全部修饰符区（任意属性兜底：可删、可按原文新增） ---------- */

function AllModifiers({ node, mut }: { node: IRNode; mut: Mut }) {
  const [name, setName] = useState('')
  const [args, setArgs] = useState('')
  const add = () => {
    const n = name.trim()
    if (!n) return
    setMod(mut, n, args.trim() ? [{ t: 'raw', v: args.trim() }] : [])
    setName(''); setArgs('')
  }
  return (
    <div className="mod-list">
      {node.modifiers.map((m, i) => (
        <div className="mod-item" key={`${m.name}-${i}`}>
          <code>.{m.name}({m.args.map(serializeArg).join(', ')})</code>
          <button className="mod-del" title="删除该修饰符"
            onClick={() => mut(n2 => ({ ...n2, modifiers: n2.modifiers.filter((_, j) => j !== i) }))}>×</button>
        </div>
      ))}
      {node.modifiers.length === 0 && <div className="mod-empty">无修饰符</div>}
      <div className="mod-add">
        <input className="mod-name" value={name} placeholder="修饰符名" onChange={(e) => setName(e.target.value)} />
        <input className="mod-args" value={args} placeholder="参数原文（可空）" onChange={(e) => setArgs(e.target.value)} />
        <button onClick={add} disabled={!name.trim()}>添加</button>
      </div>
    </div>
  )
}

/* ---------- 结构节点信息 ---------- */

function StructuralInfo({ node }: { node: IRNode }) {
  if (node.type === 'BuilderCall') {
    const raw = node.ctorArgs[0]
    return (
      <div className="struct-info">
        <div className="struct-desc">@Builder 调用点：内部是 {raw && raw.t === 'raw' ? raw.v.replace(/;$/, '') : '@Builder'} 的 UI，可直接选中编辑（改动会写回对应 @Builder 定义）。</div>
      </div>
    )
  }
  if (node.type === 'If') {
    const cond = node.ctorArgs[0]
    return (
      <div className="struct-info">
        <div className="struct-desc">条件渲染块：条件为真时渲染其子节点。修饰符不参与序列化，请在代码窗调整结构。</div>
        <label className="prop-row"><span>条件原文</span>
          <input value={cond && cond.t === 'raw' ? cond.v : ''} readOnly title="条件请在代码窗修改" />
        </label>
      </div>
    )
  }
  if (node.type === 'ForEach') {
    const src = node.ctorArgs[0]
    const params = node.ctorArgs[1]
    return (
      <div className="struct-info">
        <div className="struct-desc">循环渲染块：对数据源每一项渲染一次模板体（子节点）。</div>
        <label className="prop-row"><span>数据源</span><input value={src ? serializeArg(src) : ''} readOnly /></label>
        <label className="prop-row"><span>迭代参数</span><input value={params && params.t === 'raw' ? params.v : ''} readOnly /></label>
      </div>
    )
  }
  return <div className="struct-info"><div className="struct-desc">else 分支：前置 if 条件不成立时渲染其子节点。</div></div>
}

/* ---------- 面板主体 ---------- */

export function PropertyPanel() {
  const { ir, selectedPath, mutateNode, removeNode } = useStore()

  if (!ir || !selectedPath) {
    return <div className="prop-empty">点击画布或大纲树中的组件以选中<br /><span>选中后可编辑属性 / 拖拽改尺寸 / Delete 删除</span></div>
  }
  const node = getNodeAtPath(ir.root, selectedPath)
  if (!node) return <div className="prop-empty">节点丢失</div>

  const p: Path = selectedPath
  const mut: Mut = (fn) => mutateNode(p, fn)

  return (
    <div className="prop">
      <div className="prop-head">
        <span className="prop-type">{node.type}</span>
        <span className="prop-path">路径 [{p.join(',')}]</span>
        <button className="prop-del" onClick={() => removeNode(p)} disabled={p.length === 0}>删除</button>
      </div>
      {STRUCTURAL.has(node.type) ? (
        <StructuralInfo node={node} />
      ) : (
        <>
          <SpecificFields node={node} mut={mut} />
          <div className="prop-sec">通用 · 布局</div>
          <SizeField label="width" mod="width" node={node} mut={mut} />
          <SizeField label="height" mod="height" node={node} mut={mut} />
          <BoxNumField label="padding" mod="padding" node={node} mut={mut} />
          <BoxNumField label="margin" mod="margin" node={node} mut={mut} />
          <NumField label="layoutWeight" value={numModifier(node, 'layoutWeight')} onSet={(v) => v === undefined ? removeMod(mut, 'layoutWeight') : setMod(mut, 'layoutWeight', [{ t: 'num', v }])} />
          <NumField label="flexGrow" value={numModifier(node, 'flexGrow')} onSet={(v) => v === undefined ? removeMod(mut, 'flexGrow') : setMod(mut, 'flexGrow', [{ t: 'num', v }])} />
          <NumField label="flexShrink" value={numModifier(node, 'flexShrink')} onSet={(v) => v === undefined ? removeMod(mut, 'flexShrink') : setMod(mut, 'flexShrink', [{ t: 'num', v }])} />
          <EnumModField label="alignSelf" mod="alignSelf" options={ITEM_ALIGNS} node={node} mut={mut} />
          <XYModField label="position" mod="position" node={node} mut={mut} />
          <XYModField label="offset" mod="offset" node={node} mut={mut} />
          <NumField label="zIndex" value={numModifier(node, 'zIndex')} onSet={(v) => v === undefined ? removeMod(mut, 'zIndex') : setMod(mut, 'zIndex', [{ t: 'num', v }])} />
          <NumField label="aspectRatio" value={numModifier(node, 'aspectRatio')} onSet={(v) => v === undefined ? removeMod(mut, 'aspectRatio') : setMod(mut, 'aspectRatio', [{ t: 'num', v }])} />
          <EnumModField label="visibility" mod="visibility" options={VISIBILITIES} node={node} mut={mut} />
          <BoolModField label="enabled" mod="enabled" node={node} mut={mut} />
          <div className="prop-sec">通用 · 外观</div>
          <ColorModField label="backgroundColor" mod="backgroundColor" node={node} mut={mut} />
          <NumField label="opacity" step="0.1" value={numModifier(node, 'opacity')} onSet={(v) => v === undefined ? removeMod(mut, 'opacity') : setMod(mut, 'opacity', [{ t: 'num', v: Math.max(0, Math.min(1, v)) }])} />
          <NumField label="borderRadius" value={numModifier(node, 'borderRadius')} onSet={(v) => v === undefined ? removeMod(mut, 'borderRadius') : setMod(mut, 'borderRadius', [{ t: 'num', v }])} />
          <NumField label="borderWidth" value={numModifier(node, 'borderWidth')} onSet={(v) => v === undefined ? removeMod(mut, 'borderWidth') : setMod(mut, 'borderWidth', [{ t: 'num', v }])} />
          <ColorModField label="borderColor" mod="borderColor" node={node} mut={mut} />
          <StrModField label="id" mod="id" node={node} mut={mut} />
          <div className="prop-sec">全部修饰符</div>
          <AllModifiers node={node} mut={mut} />
        </>
      )}
    </div>
  )
}
