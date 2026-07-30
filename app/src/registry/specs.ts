import { ArgVal, IRNode } from '../ir/types'
import { getModifier } from '../ir/mutate'
import { serializeArg } from '../ir/serialize'
import { ComponentSpec } from './types'

/* ---------- 构造辅助（原 ir/defaults.ts / OutlineTree summary 的零件） ---------- */

const num = (v: number): ArgVal => ({ t: 'num', v })
const str = (v: string): ArgVal => ({ t: 'str', v })
const bool = (v: boolean): ArgVal => ({ t: 'bool', v })
const enumA = (v: string): ArgVal => ({ t: 'enum', v })
const obj = (v: Record<string, ArgVal>): ArgVal => ({ t: 'obj', v })
const mod = (name: string, args: ArgVal[]) => ({ name, args })

const text = (v: string, fontSize = 14): IRNode => ({
  type: 'Text', ctorArgs: [str(v)], children: [], modifiers: [mod('fontSize', [num(fontSize)])],
})

const listItem = (): IRNode => ({ type: 'ListItem', ctorArgs: [], children: [text('列表项')], modifiers: [] })
const gridItem = (): IRNode => ({ type: 'GridItem', ctorArgs: [], children: [text('项')], modifiers: [] })

function createTabContent(label: string): IRNode {
  return {
    type: 'TabContent',
    ctorArgs: [],
    children: [{ type: 'Column', ctorArgs: [], children: [text(label + '内容')], modifiers: [mod('padding', [num(12)])] }],
    modifiers: [mod('tabBar', [str(label)])],
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function argText(a: ArgVal | undefined): string {
  if (!a) return ''
  if (a.t === 'str' || a.t === 'raw' || a.t === 'enum') return a.v
  return serializeArg(a)
}

const firstArgSummary = (n: IRNode) => truncate(argText(n.ctorArgs[0]), 12)

/* ---------- 枚举常量（原 PropertyPanel.tsx） ---------- */

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

/* ---------- 元件注册声明 ---------- */

export const SPECS: ComponentSpec[] = [
  // —— 布局 ——
  {
    type: 'Column', category: '布局', palette: true, container: true,
    makeDefault: () => ({ type: 'Column', ctorArgs: [obj({ space: num(8) })], children: [], modifiers: [] }),
    fields: [
      { kind: 'ctorObjNum', label: 'space', key: 'space' },
      { kind: 'enum', label: 'justifyContent', mod: 'justifyContent', options: FLEX_ALIGNS },
      { kind: 'enum', label: 'alignItems', mod: 'alignItems', options: H_ALIGNS },
    ],
  },
  {
    type: 'Row', category: '布局', palette: true, container: true,
    makeDefault: () => ({ type: 'Row', ctorArgs: [obj({ space: num(8) })], children: [], modifiers: [] }),
    fields: [
      { kind: 'ctorObjNum', label: 'space', key: 'space' },
      { kind: 'enum', label: 'justifyContent', mod: 'justifyContent', options: FLEX_ALIGNS },
      { kind: 'enum', label: 'alignItems', mod: 'alignItems', options: V_ALIGNS },
    ],
  },
  {
    type: 'Stack', category: '布局', palette: true, container: true,
    makeDefault: () => ({ type: 'Stack', ctorArgs: [], children: [], modifiers: [mod('width', [num(120)]), mod('height', [num(120)])] }),
    fields: [
      { kind: 'ctorObjEnum', label: 'alignContent', key: 'alignContent', options: ALIGNMENTS },
    ],
  },
  {
    type: 'RelativeContainer', category: '布局', palette: true, container: true,
    makeDefault: () => ({ type: 'RelativeContainer', ctorArgs: [], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(120)])] }),
  },
  {
    type: 'Flex', category: '布局', palette: true, container: true,
    makeDefault: () => ({
      type: 'Flex',
      ctorArgs: [obj({ direction: enumA('FlexDirection.Row'), wrap: enumA('FlexWrap.NoWrap') })],
      children: [],
      modifiers: [mod('width', [str('100%')])],
    }),
  },

  // —— 容器 ——
  {
    type: 'Scroll', category: '容器', palette: true, container: true, singleChild: true,
    // ArkTS Scroll 独子约束：默认内置一个 Column，后续拖入都进 Column
    makeDefault: () => ({
      type: 'Scroll', ctorArgs: [],
      children: [{ type: 'Column', ctorArgs: [obj({ space: num(8) })], children: [text('滚动内容')], modifiers: [mod('padding', [num(12)])] }],
      modifiers: [mod('width', [str('100%')]), mod('height', [num(200)])],
    }),
    fields: [
      { kind: 'enum', label: 'scrollable', mod: 'scrollable', options: SCROLL_DIRS },
    ],
  },
  {
    type: 'List', category: '容器', palette: true, container: true, accepts: ['ListItem'],
    makeDefault: () => ({
      type: 'List',
      ctorArgs: [obj({ space: num(8) })],
      children: [listItem(), listItem()],
      modifiers: [mod('width', [str('100%')]), mod('height', [num(160)])],
    }),
    fields: [
      { kind: 'ctorObjNum', label: 'space', key: 'space' },
    ],
  },
  {
    type: 'Grid', category: '容器', palette: true, container: true, accepts: ['GridItem'],
    makeDefault: () => ({
      type: 'Grid', ctorArgs: [],
      children: [gridItem(), gridItem(), gridItem(), gridItem()],
      modifiers: [
        mod('columnsTemplate', [str('1fr 1fr')]),
        mod('rowsGap', [num(8)]), mod('columnsGap', [num(8)]),
        mod('width', [str('100%')]), mod('height', [num(160)]),
      ],
    }),
    fields: [
      { kind: 'str', label: 'columnsTemplate', mod: 'columnsTemplate' },
      { kind: 'num', label: 'rowsGap', mod: 'rowsGap' },
      { kind: 'num', label: 'columnsGap', mod: 'columnsGap' },
    ],
  },
  {
    type: 'Tabs', category: '容器', palette: true, container: true, accepts: ['TabContent'],
    makeDefault: () => ({
      type: 'Tabs', ctorArgs: [],
      children: [createTabContent('标签 1'), createTabContent('标签 2')],
      modifiers: [mod('width', [str('100%')]), mod('height', [num(200)])],
    }),
  },
  {
    type: 'ListItem', category: '容器', palette: true, container: false,
    makeDefault: () => ({ type: 'ListItem', ctorArgs: [], children: [text('列表项')], modifiers: [] }),
  },
  {
    type: 'GridItem', category: '容器', palette: true, container: false,
    makeDefault: () => ({ type: 'GridItem', ctorArgs: [], children: [text('项')], modifiers: [] }),
  },
  {
    type: 'TabContent', category: '容器', palette: true, container: true, singleChild: true,
    makeDefault: () => createTabContent('标签'),
    fields: [
      { kind: 'str', label: 'tabBar', mod: 'tabBar' },
    ],
    summary: (n) => truncate(argText(getModifier(n, 'tabBar')?.args[0]), 12),
  },

  // —— 基础 ——
  {
    type: 'Text', category: '基础', palette: true, container: false,
    makeDefault: () => ({ type: 'Text', ctorArgs: [str('Text')], children: [], modifiers: [mod('fontSize', [num(16)])] }),
    fields: [
      { kind: 'ctorText', label: 'text' },
      { kind: 'num', label: 'fontSize', mod: 'fontSize' },
      { kind: 'color', label: 'fontColor', mod: 'fontColor' },
      { kind: 'enum', label: 'fontWeight', mod: 'fontWeight', options: FONT_WEIGHTS },
      { kind: 'enum', label: 'textAlign', mod: 'textAlign', options: TEXT_ALIGNS },
      { kind: 'num', label: 'maxLines', mod: 'maxLines' },
    ],
    summary: firstArgSummary,
  },
  {
    type: 'Button', category: '基础', palette: true, container: false,
    makeDefault: () => ({ type: 'Button', ctorArgs: [str('Button')], children: [], modifiers: [mod('type', [enumA('ButtonType.Capsule')])] }),
    fields: [
      { kind: 'ctorText', label: 'text' },
      { kind: 'enum', label: 'type', mod: 'type', options: BUTTON_TYPES },
      { kind: 'bool', label: 'stateEffect', mod: 'stateEffect' },
      { kind: 'color', label: '背景色', mod: 'backgroundColor' },
    ],
    summary: firstArgSummary,
  },
  {
    type: 'Image', category: '基础', palette: true, container: false,
    makeDefault: () => ({
      type: 'Image', ctorArgs: [str('placeholder.png')], children: [],
      modifiers: [mod('width', [num(80)]), mod('height', [num(60)])],
    }),
    fields: [
      { kind: 'ctorText', label: 'src' },
      { kind: 'enum', label: 'objectFit', mod: 'objectFit', options: IMAGE_FITS },
    ],
    summary: firstArgSummary,
  },
  {
    type: 'Video', category: '基础', palette: true, container: false,
    makeDefault: () => ({
      type: 'Video', ctorArgs: [obj({ src: str('placeholder.mp4') })], children: [],
      modifiers: [mod('width', [str('100%')]), mod('height', [num(120)])],
    }),
  },
  {
    type: 'Divider', category: '基础', palette: true, container: false,
    makeDefault: () => ({ type: 'Divider', ctorArgs: [], children: [], modifiers: [mod('width', [str('100%')])] }),
  },
  {
    type: 'Blank', category: '布局', palette: true, container: false,
    makeDefault: () => ({ type: 'Blank', ctorArgs: [], children: [], modifiers: [] }),
  },
  {
    type: 'Badge', category: '容器', palette: true, container: true, singleChild: true,
    makeDefault: () => ({
      type: 'Badge', ctorArgs: [obj({ count: num(1) })],
      children: [text('消息')], modifiers: [],
    }),
    fields: [
      { kind: 'ctorObjNum', label: 'count', key: 'count', tip: '角标数字（0 = 不显示）' },
    ],
  },
  {
    type: 'Rating', category: '反馈', palette: true, container: false,
    makeDefault: () => ({
      type: 'Rating', ctorArgs: [obj({ rating: num(3), indicator: bool(false) })], children: [],
      modifiers: [],
    }),
    fields: [
      { kind: 'ctorObjNum', label: 'rating', key: 'rating', tip: '当前评分（0–5）' },
    ],
  },

  // —— 表单 ——
  {
    type: 'TextInput', category: '表单', palette: true, container: false,
    makeDefault: () => ({
      type: 'TextInput', ctorArgs: [obj({ placeholder: str('请输入文本') })], children: [],
      modifiers: [mod('width', [str('100%')])],
    }),
    fields: [
      { kind: 'ctorObjStr', label: 'placeholder', key: 'placeholder' },
      { kind: 'ctorObjStr', label: 'text', key: 'text' },
    ],
    summary: (n) => {
      const o = n.ctorArgs[0]
      const v = o && o.t === 'obj' ? o.v : undefined
      return truncate(argText(v?.placeholder), 12)
    },
  },
  {
    type: 'Toggle', category: '表单', palette: true, container: false,
    makeDefault: () => ({ type: 'Toggle', ctorArgs: [obj({ type: enumA('ToggleType.Switch'), isOn: bool(false) })], children: [], modifiers: [] }),
    fields: [
      { kind: 'ctorObjBool', label: 'isOn', key: 'isOn' },
    ],
  },
  {
    type: 'Slider', category: '表单', palette: true, container: false,
    makeDefault: () => ({
      type: 'Slider',
      ctorArgs: [obj({ value: num(30), min: num(0), max: num(100), step: num(1) })],
      children: [],
      modifiers: [mod('width', [str('100%')])],
    }),
    fields: [
      { kind: 'ctorObjNum', label: 'value', key: 'value' },
      { kind: 'ctorObjNum', label: 'min', key: 'min' },
      { kind: 'ctorObjNum', label: 'max', key: 'max' },
      { kind: 'ctorObjNum', label: 'step', key: 'step' },
    ],
  },
  {
    type: 'Checkbox', category: '表单', palette: true, container: false,
    makeDefault: () => ({ type: 'Checkbox', ctorArgs: [obj({ name: str('agree'), group: str('g1') })], children: [], modifiers: [] }),
  },
  {
    type: 'Radio', category: '表单', palette: true, container: false,
    makeDefault: () => ({ type: 'Radio', ctorArgs: [obj({ value: str('0'), group: str('radioGroup') })], children: [], modifiers: [] }),
  },
  {
    type: 'Progress', category: '表单', palette: true, container: false,
    makeDefault: () => ({
      type: 'Progress',
      ctorArgs: [obj({ value: num(45), total: num(100), type: enumA('ProgressType.Linear') })],
      children: [],
      modifiers: [mod('width', [str('100%')])],
    }),
    fields: [
      { kind: 'ctorObjNum', label: 'value', key: 'value' },
      { kind: 'ctorObjNum', label: 'total', key: 'total' },
      { kind: 'ctorObjEnum', label: 'type', key: 'type', options: PROGRESS_TYPES, allowUnset: false },
    ],
  },

  // —— 结构（不进组件面板） ——
  {
    type: 'If', category: '结构', palette: false, container: true, structural: true,
    summary: (n) => {
      const a0 = n.ctorArgs[0]
      return a0 && a0.t === 'raw' ? truncate(a0.v, 16) : ''
    },
  },
  { type: 'Else', category: '结构', palette: false, container: false, structural: true },
  {
    type: 'ForEach', category: '结构', palette: false, container: true, structural: true,
    summary: (n) => {
      const a0 = n.ctorArgs[0]
      return a0 ? truncate(serializeArg(a0), 16) : ''
    },
  },
  { type: 'BuilderCall', category: '结构', palette: false, container: true, structural: true },
]
