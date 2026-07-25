import { ArgVal, IRNode } from '../ir/types'

const num = (v: number): ArgVal => ({ t: 'num', v })
const str = (v: string): ArgVal => ({ t: 'str', v })
const enumA = (v: string): ArgVal => ({ t: 'enum', v })
const obj = (v: Record<string, ArgVal>): ArgVal => ({ t: 'obj', v })
const mod = (name: string, args: ArgVal[]) => ({ name, args })

export interface LibComponent {
  name: string
  icon: string
  makeNode: () => IRNode
}

function text(v: string, opts?: { fontSize?: number; fontColor?: string }): IRNode {
  const mods = [mod('fontSize', [num(opts?.fontSize ?? 14)])]
  if (opts?.fontColor) mods.push(mod('fontColor', [str(opts.fontColor)]))
  return { type: 'Text', ctorArgs: [str(v)], children: [], modifiers: mods }
}

export const LIBRARY: LibComponent[] = [
  {
    name: '卡片',
    icon: '🗃️',
    makeNode: () => ({
      type: 'Column',
      ctorArgs: [obj({ space: num(8) })],
      children: [
        { type: 'Image', ctorArgs: [str('placeholder.png')], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(120)]), mod('objectFit', [enumA('ImageFit.Cover')])] },
        text('卡片标题', { fontSize: 16 }),
        text('这是卡片的描述文字内容', { fontSize: 12, fontColor: '#999' }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('borderRadius', [num(8)])],
    }),
  },
  {
    name: '列表项',
    icon: '📃',
    makeNode: () => ({
      type: 'Row',
      ctorArgs: [obj({ space: num(8) })],
      children: [
        { type: 'Image', ctorArgs: [str('placeholder.png')], children: [], modifiers: [mod('width', [num(40)]), mod('height', [num(40)]), mod('borderRadius', [num(20)])] },
        {
          type: 'Column',
          ctorArgs: [],
          children: [
            text('列表项标题', { fontSize: 14 }),
            text('说明文字', { fontSize: 12, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)])],
        },
        text('>', { fontSize: 14, fontColor: '#ccc' }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('border', [obj({ width: obj({ bottom: num(1) }), color: str('#eee') })])],
    }),
  },
  {
    name: '宫格项',
    icon: '🔲',
    makeNode: () => ({
      type: 'Column',
      ctorArgs: [obj({ space: num(4) })],
      children: [
        { type: 'Text', ctorArgs: [str('🔧')], children: [], modifiers: [mod('fontSize', [num(28)])] },
        text('功能', { fontSize: 12 }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('alignItems', [enumA('HorizontalAlign.Center')]), mod('padding', [num(8)])],
    }),
  },
  {
    name: '搜索栏',
    icon: '🔍',
    makeNode: () => ({
      type: 'Row',
      ctorArgs: [obj({ space: num(8) })],
      children: [
        text('🔍', { fontSize: 16 }),
        { type: 'TextInput', ctorArgs: [obj({ placeholder: str('搜索内容') })], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('height', [num(36)])] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [obj({ left: num(12), right: num(12), top: num(8), bottom: num(8) })]), mod('backgroundColor', [str('#fff')])],
    }),
  },
  {
    name: '用户头部',
    icon: '🧑',
    makeNode: () => ({
      type: 'Row',
      ctorArgs: [obj({ space: num(12) })],
      children: [
        { type: 'Image', ctorArgs: [str('placeholder.png')], children: [], modifiers: [mod('width', [num(60)]), mod('height', [num(60)]), mod('borderRadius', [num(30)])] },
        {
          type: 'Column',
          ctorArgs: [],
          children: [
            text('用户昵称', { fontSize: 16 }),
            text('个性签名 · 这是用户的个性描述', { fontSize: 12, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)])],
        },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(16)]), mod('backgroundColor', [str('#fff')]), mod('alignItems', [enumA('VerticalAlign.Center')])],
    }),
  },
  {
    name: '按钮组',
    icon: '🎛️',
    makeNode: () => ({
      type: 'Row',
      ctorArgs: [obj({ space: num(8) })],
      children: [
        { type: 'Button', ctorArgs: [str('取消')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('type', [enumA('ButtonType.Capsule')]), mod('backgroundColor', [str('#f0f0f0')]), mod('fontColor', [str('#666')])] },
        { type: 'Button', ctorArgs: [str('确定')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('type', [enumA('ButtonType.Capsule')]), mod('backgroundColor', [str('#07c160')]), mod('fontColor', [str('#fff')])] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)])],
    }),
  },
  {
    name: '统计卡片',
    icon: '📊',
    makeNode: () => ({
      type: 'Column',
      ctorArgs: [obj({ space: num(4) })],
      children: [
        text('1,234', { fontSize: 24 }),
        text('今日访问', { fontSize: 12, fontColor: '#999' }),
      ],
      modifiers: [mod('alignItems', [enumA('HorizontalAlign.Center')]), mod('padding', [num(16)]), mod('backgroundColor', [str('#fff')]), mod('borderRadius', [num(8)]), mod('layoutWeight', [num(1)])],
    }),
  },
  {
    name: '标签栏',
    icon: '🏷️',
    makeNode: () => ({
      type: 'Row',
      ctorArgs: [],
      children: [
        { type: 'Text', ctorArgs: [str('推荐')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('fontSize', [num(14)]), mod('fontColor', [str('#07c160')]), mod('textAlign', [enumA('TextAlign.Center')]), mod('padding', [obj({ top: num(8), bottom: num(8) })])] },
        { type: 'Text', ctorArgs: [str('热门')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('fontSize', [num(14)]), mod('fontColor', [str('#666')]), mod('textAlign', [enumA('TextAlign.Center')]), mod('padding', [obj({ top: num(8), bottom: num(8) })])] },
        { type: 'Text', ctorArgs: [str('最新')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('fontSize', [num(14)]), mod('fontColor', [str('#666')]), mod('textAlign', [enumA('TextAlign.Center')]), mod('padding', [obj({ top: num(8), bottom: num(8) })])] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('backgroundColor', [str('#fff')]), mod('border', [obj({ width: obj({ bottom: num(1) }), color: str('#eee') })])],
    }),
  },
  {
    name: '统计行',
    icon: '📈',
    makeNode: () => ({
      type: 'Row',
      ctorArgs: [],
      children: [
        {
          type: 'Column',
          ctorArgs: [obj({ space: num(2) })],
          children: [
            text('128', { fontSize: 20 }),
            text('文章', { fontSize: 11, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)]), mod('alignItems', [enumA('HorizontalAlign.Center')])],
        },
        {
          type: 'Column',
          ctorArgs: [obj({ space: num(2) })],
          children: [
            text('256', { fontSize: 20 }),
            text('粉丝', { fontSize: 11, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)]), mod('alignItems', [enumA('HorizontalAlign.Center')])],
        },
        {
          type: 'Column',
          ctorArgs: [obj({ space: num(2) })],
          children: [
            text('89', { fontSize: 20 }),
            text('关注', { fontSize: 11, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)]), mod('alignItems', [enumA('HorizontalAlign.Center')])],
        },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(16)]), mod('backgroundColor', [str('#fff')])],
    }),
  },
]
