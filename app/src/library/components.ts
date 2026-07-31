import { ArgVal, IRNode } from '../ir/types'

const num = (v: number): ArgVal => ({ t: 'num', v })
const str = (v: string): ArgVal => ({ t: 'str', v })
const enumA = (v: string): ArgVal => ({ t: 'enum', v })
const obj = (v: Record<string, ArgVal>): ArgVal => ({ t: 'obj', v })
const mod = (name: string, args: ArgVal[]) => ({ name, args })

export interface LibComponent {
  name: string
  icon: string
  /** 分组（组件库面板按此归类展示） */
  category: string
  makeNode: () => IRNode
}

/** 分类展示顺序 */
export const LIBRARY_CATEGORIES = ['导航', '列表', '卡片', '表单', '反馈', '媒体']

function text(v: string, opts?: { fontSize?: number; fontColor?: string }): IRNode {
  const mods = [mod('fontSize', [num(opts?.fontSize ?? 14)])]
  if (opts?.fontColor) mods.push(mod('fontColor', [str(opts.fontColor)]))
  return { type: 'Text', ctorArgs: [str(v)], children: [], modifiers: mods }
}

const img = (w: number, h: number, extra: ReturnType<typeof mod>[] = []): IRNode => ({
  type: 'Image', ctorArgs: [str('placeholder.png')], children: [],
  modifiers: [mod('width', [num(w)]), mod('height', [num(h)]), ...extra],
})

const pad = (l: number, r: number, t: number, b: number) => mod('padding', [obj({ left: num(l), right: num(r), top: num(t), bottom: num(b) })])

export const LIBRARY: LibComponent[] = [
  /* ---------------- 导航 ---------------- */
  {
    name: '顶部导航栏', icon: '🔝', category: '导航',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(8) })],
      children: [
        text('‹', { fontSize: 22 }),
        {
          type: 'Text', ctorArgs: [str('页面标题')], children: [],
          modifiers: [mod('fontSize', [num(17)]), mod('fontWeight', [enumA('FontWeight.Medium')]), mod('layoutWeight', [num(1)]), mod('textAlign', [enumA('TextAlign.Center')])],
        },
        text('⋯', { fontSize: 18 }),
      ],
      modifiers: [mod('width', [str('100%')]), pad(12, 12, 10, 10), mod('backgroundColor', [str('#fff')]), mod('alignItems', [enumA('VerticalAlign.Center')])],
    }),
  },
  {
    name: '底部导航栏', icon: '⬇️', category: '导航',
    makeNode: () => {
      const tab = (icon: string, label: string, active = false): IRNode => ({
        type: 'Column', ctorArgs: [obj({ space: num(2) })],
        children: [
          { type: 'Text', ctorArgs: [str(icon)], children: [], modifiers: [mod('fontSize', [num(20)])] },
          text(label, { fontSize: 10, fontColor: active ? '#07c160' : '#666' }),
        ],
        modifiers: [mod('layoutWeight', [num(1)]), mod('alignItems', [enumA('HorizontalAlign.Center')]), pad(0, 0, 6, 6)],
      })
      return {
        type: 'Row', ctorArgs: [],
        children: [tab('🏠', '首页', true), tab('🧭', '发现'), tab('🔔', '消息'), tab('👤', '我的')],
        modifiers: [mod('width', [str('100%')]), mod('backgroundColor', [str('#fff')]), mod('borderWidth', [obj({ top: num(1) })]), mod('borderColor', [str('#eee')])],
      }
    },
  },
  {
    name: '搜索栏', icon: '🔍', category: '导航',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(8) })],
      children: [
        text('🔍', { fontSize: 16 }),
        { type: 'TextInput', ctorArgs: [obj({ placeholder: str('搜索内容') })], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('height', [num(36)])] },
      ],
      modifiers: [mod('width', [str('100%')]), pad(12, 12, 8, 8), mod('backgroundColor', [str('#fff')])],
    }),
  },
  {
    name: '标签栏', icon: '🏷️', category: '导航',
    makeNode: () => ({
      type: 'Row', ctorArgs: [],
      children: [
        { type: 'Text', ctorArgs: [str('推荐')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('fontSize', [num(14)]), mod('fontColor', [str('#07c160')]), mod('textAlign', [enumA('TextAlign.Center')]), pad(0, 0, 8, 8)] },
        { type: 'Text', ctorArgs: [str('热门')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('fontSize', [num(14)]), mod('fontColor', [str('#666')]), mod('textAlign', [enumA('TextAlign.Center')]), pad(0, 0, 8, 8)] },
        { type: 'Text', ctorArgs: [str('最新')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('fontSize', [num(14)]), mod('fontColor', [str('#666')]), mod('textAlign', [enumA('TextAlign.Center')]), pad(0, 0, 8, 8)] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('backgroundColor', [str('#fff')]), mod('borderWidth', [obj({ bottom: num(1) })]), mod('borderColor', [str('#eee')])],
    }),
  },
  {
    name: '宫格项', icon: '🔲', category: '导航',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(4) })],
      children: [
        { type: 'Text', ctorArgs: [str('🔧')], children: [], modifiers: [mod('fontSize', [num(28)])] },
        text('功能', { fontSize: 12 }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('alignItems', [enumA('HorizontalAlign.Center')]), mod('padding', [num(8)])],
    }),
  },

  /* ---------------- 列表 ---------------- */
  {
    name: '列表项', icon: '📃', category: '列表',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(8) })],
      children: [
        img(40, 40, [mod('borderRadius', [num(20)])]),
        {
          type: 'Column', ctorArgs: [],
          children: [
            text('列表项标题', { fontSize: 14 }),
            text('说明文字', { fontSize: 12, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)])],
        },
        text('>', { fontSize: 14, fontColor: '#ccc' }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('borderWidth', [obj({ bottom: num(1) })]), mod('borderColor', [str('#eee')])],
    }),
  },
  {
    name: '消息列表项', icon: '💬', category: '列表',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(10) })],
      children: [
        {
          type: 'Badge', ctorArgs: [obj({ count: num(2) })],
          children: [img(44, 44, [mod('borderRadius', [num(6)])])],
          modifiers: [],
        },
        {
          type: 'Column', ctorArgs: [obj({ space: num(3) })],
          children: [
            text('联系人', { fontSize: 15 }),
            text('最近一条消息内容预览…', { fontSize: 12, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)])],
        },
        text('12:30', { fontSize: 11, fontColor: '#999' }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('alignItems', [enumA('VerticalAlign.Center')])],
    }),
  },
  {
    name: '商品列表项', icon: '🛒', category: '列表',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(10) })],
      children: [
        img(72, 72, [mod('borderRadius', [num(6)])]),
        {
          type: 'Column', ctorArgs: [obj({ space: num(4) })],
          children: [
            text('商品名称', { fontSize: 14 }),
            text('卖点描述一句话', { fontSize: 11, fontColor: '#999' }),
            {
              type: 'Row', ctorArgs: [],
              children: [
                text('¥ 99.00', { fontSize: 16, fontColor: '#e6432d' }),
                { type: 'Blank', ctorArgs: [], children: [], modifiers: [] },
                {
                  type: 'Button', ctorArgs: [str('购买')], children: [],
                  modifiers: [mod('type', [enumA('ButtonType.Capsule')]), mod('backgroundColor', [str('#e6432d')]), mod('fontColor', [str('#fff')]), mod('fontSize', [num(11)]), mod('height', [num(26)])],
                },
              ],
              modifiers: [mod('width', [str('100%')]), mod('alignItems', [enumA('VerticalAlign.Center')])],
            },
          ],
          modifiers: [mod('layoutWeight', [num(1)])],
        },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')])],
    }),
  },

  /* ---------------- 卡片 ---------------- */
  {
    name: '卡片', icon: '🗃️', category: '卡片',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(8) })],
      children: [
        { type: 'Image', ctorArgs: [str('placeholder.png')], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(120)]), mod('objectFit', [enumA('ImageFit.Cover')])] },
        text('卡片标题', { fontSize: 16 }),
        text('这是卡片的描述文字内容', { fontSize: 12, fontColor: '#999' }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('borderRadius', [num(8)])],
    }),
  },
  {
    name: '文章卡片', icon: '📰', category: '卡片',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(8) })],
      children: [
        { type: 'Image', ctorArgs: [str('placeholder.png')], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(140)]), mod('objectFit', [enumA('ImageFit.Cover')]), mod('borderRadius', [num(6)])] },
        text('文章标题写在这里', { fontSize: 16 }),
        text('摘要：一两句话概括文章的主要内容…', { fontSize: 12, fontColor: '#999' }),
        {
          type: 'Row', ctorArgs: [obj({ space: num(6) })],
          children: [
            img(20, 20, [mod('borderRadius', [num(10)])]),
            text('作者', { fontSize: 11, fontColor: '#999' }),
            { type: 'Blank', ctorArgs: [], children: [], modifiers: [] },
            text('3 分钟前', { fontSize: 11, fontColor: '#999' }),
          ],
          modifiers: [mod('width', [str('100%')]), mod('alignItems', [enumA('VerticalAlign.Center')])],
        },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('borderRadius', [num(8)])],
    }),
  },
  {
    name: '用户头部', icon: '🧑', category: '卡片',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(12) })],
      children: [
        img(60, 60, [mod('borderRadius', [num(30)])]),
        {
          type: 'Column', ctorArgs: [],
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
    name: '统计卡片', icon: '📊', category: '卡片',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(4) })],
      children: [
        text('1,234', { fontSize: 24 }),
        text('今日访问', { fontSize: 12, fontColor: '#999' }),
      ],
      modifiers: [mod('alignItems', [enumA('HorizontalAlign.Center')]), mod('padding', [num(16)]), mod('backgroundColor', [str('#fff')]), mod('borderRadius', [num(8)]), mod('layoutWeight', [num(1)])],
    }),
  },
  {
    name: '统计行', icon: '📈', category: '卡片',
    makeNode: () => {
      const stat = (v: string, label: string): IRNode => ({
        type: 'Column', ctorArgs: [obj({ space: num(2) })],
        children: [text(v, { fontSize: 20 }), text(label, { fontSize: 11, fontColor: '#999' })],
        modifiers: [mod('layoutWeight', [num(1)]), mod('alignItems', [enumA('HorizontalAlign.Center')])],
      })
      return {
        type: 'Row', ctorArgs: [],
        children: [stat('128', '文章'), stat('256', '粉丝'), stat('89', '关注')],
        modifiers: [mod('width', [str('100%')]), mod('padding', [num(16)]), mod('backgroundColor', [str('#fff')])],
      }
    },
  },

  /* ---------------- 表单 ---------------- */
  {
    name: '按钮组', icon: '🎛️', category: '表单',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(8) })],
      children: [
        { type: 'Button', ctorArgs: [str('取消')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('type', [enumA('ButtonType.Capsule')]), mod('backgroundColor', [str('#f0f0f0')]), mod('fontColor', [str('#666')])] },
        { type: 'Button', ctorArgs: [str('确定')], children: [], modifiers: [mod('layoutWeight', [num(1)]), mod('type', [enumA('ButtonType.Capsule')]), mod('backgroundColor', [str('#07c160')]), mod('fontColor', [str('#fff')])] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)])],
    }),
  },
  {
    name: '登录表单', icon: '🔐', category: '表单',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(12) })],
      children: [
        { type: 'TextInput', ctorArgs: [obj({ placeholder: str('账号') })], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(40)])] },
        { type: 'TextInput', ctorArgs: [obj({ placeholder: str('密码') })], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(40)])] },
        {
          type: 'Button', ctorArgs: [str('登 录')], children: [],
          modifiers: [mod('width', [str('100%')]), mod('type', [enumA('ButtonType.Capsule')]), mod('backgroundColor', [str('#3a6df0')]), mod('fontColor', [str('#fff')])],
        },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(16)])],
    }),
  },
  {
    name: '设置开关行', icon: '⚙️', category: '表单',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(8) })],
      children: [
        {
          type: 'Column', ctorArgs: [obj({ space: num(2) })],
          children: [
            text('消息通知', { fontSize: 14 }),
            text('接收新消息推送', { fontSize: 11, fontColor: '#999' }),
          ],
          modifiers: [mod('layoutWeight', [num(1)])],
        },
        { type: 'Toggle', ctorArgs: [obj({ type: enumA('ToggleType.Switch'), isOn: { t: 'bool', v: true } })], children: [], modifiers: [] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('alignItems', [enumA('VerticalAlign.Center')])],
    }),
  },
  {
    name: '滑杆行', icon: '🎚️', category: '表单',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(4) })],
      children: [
        {
          type: 'Row', ctorArgs: [],
          children: [
            text('音量', { fontSize: 13 }),
            { type: 'Blank', ctorArgs: [], children: [], modifiers: [] },
            text('30', { fontSize: 12, fontColor: '#999' }),
          ],
          modifiers: [mod('width', [str('100%')])],
        },
        { type: 'Slider', ctorArgs: [obj({ value: num(30), min: num(0), max: num(100), step: num(1) })], children: [], modifiers: [mod('width', [str('100%')])] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')])],
    }),
  },

  /* ---------------- 反馈 ---------------- */
  {
    name: '空状态', icon: '📭', category: '反馈',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(12) })],
      children: [
        { type: 'Text', ctorArgs: [str('📭')], children: [], modifiers: [mod('fontSize', [num(48)])] },
        text('暂无内容', { fontSize: 14, fontColor: '#999' }),
        { type: 'Button', ctorArgs: [str('去逛逛')], children: [], modifiers: [mod('type', [enumA('ButtonType.Capsule')])] },
      ],
      modifiers: [mod('width', [str('100%')]), mod('alignItems', [enumA('HorizontalAlign.Center')]), mod('padding', [num(32)])],
    }),
  },
  {
    name: '加载状态', icon: '⏳', category: '反馈',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(8) })],
      children: [
        { type: 'LoadingProgress', ctorArgs: [], children: [], modifiers: [mod('width', [num(32)]), mod('height', [num(32)]), mod('color', [str('#3a6df0')])] },
        text('加载中…', { fontSize: 12, fontColor: '#999' }),
      ],
      modifiers: [mod('width', [str('100%')]), mod('alignItems', [enumA('HorizontalAlign.Center')]), mod('padding', [num(24)])],
    }),
  },
  {
    name: '评分行', icon: '⭐', category: '反馈',
    makeNode: () => ({
      type: 'Row', ctorArgs: [obj({ space: num(8) })],
      children: [
        text('综合评分', { fontSize: 14 }),
        { type: 'Rating', ctorArgs: [obj({ rating: num(4), indicator: { t: 'bool', v: false } })], children: [], modifiers: [] },
        text('4.0', { fontSize: 12, fontColor: '#999' }),
      ],
      modifiers: [mod('padding', [num(12)]), mod('backgroundColor', [str('#fff')]), mod('alignItems', [enumA('VerticalAlign.Center')])],
    }),
  },

  /* ---------------- 媒体 ---------------- */
  {
    name: '视频卡片', icon: '🎬', category: '媒体',
    makeNode: () => ({
      type: 'Column', ctorArgs: [obj({ space: num(6) })],
      children: [
        { type: 'Video', ctorArgs: [obj({ src: str('placeholder.mp4') })], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(160)])] },
        {
          type: 'Row', ctorArgs: [obj({ space: num(6) })],
          children: [
            { type: 'Text', ctorArgs: [str('视频标题')], children: [], modifiers: [mod('fontSize', [num(14)]), mod('layoutWeight', [num(1)])] },
            text('▶ 1.2万', { fontSize: 11, fontColor: '#999' }),
          ],
          modifiers: [mod('width', [str('100%')]), pad(8, 8, 0, 8)],
        },
      ],
      modifiers: [mod('width', [str('100%')]), mod('backgroundColor', [str('#fff')]), mod('borderRadius', [num(8)])],
    }),
  },
  {
    name: '图片网格', icon: '🖼️', category: '媒体',
    makeNode: () => {
      const cell = (): IRNode => ({
        type: 'GridItem', ctorArgs: [],
        children: [{ type: 'Image', ctorArgs: [str('placeholder.png')], children: [], modifiers: [mod('width', [str('100%')]), mod('height', [num(100)]), mod('objectFit', [enumA('ImageFit.Cover')]), mod('borderRadius', [num(4)])] }],
        modifiers: [],
      })
      return {
        type: 'Grid', ctorArgs: [],
        children: [cell(), cell(), cell()],
        modifiers: [mod('columnsTemplate', [str('1fr 1fr 1fr')]), mod('rowsGap', [num(4)]), mod('columnsGap', [num(4)]), mod('width', [str('100%')]), mod('height', [num(108)])],
      }
    },
  },
]
