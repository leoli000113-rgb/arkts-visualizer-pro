import { ArgVal, IRNode } from './types'

const num = (v: number): ArgVal => ({ t: 'num', v })
const str = (v: string): ArgVal => ({ t: 'str', v })
const bool = (v: boolean): ArgVal => ({ t: 'bool', v })
const enumA = (v: string): ArgVal => ({ t: 'enum', v })
const obj = (v: Record<string, ArgVal>): ArgVal => ({ t: 'obj', v })

const mod = (name: string, args: ArgVal[]) => ({ name, args })
const text = (v: string): IRNode => ({
  type: 'Text', ctorArgs: [str(v)], children: [], modifiers: [mod('fontSize', [num(14)])],
})

export function createNode(type: string): IRNode {
  const base: IRNode = { type, ctorArgs: [], children: [], modifiers: [] }
  switch (type) {
    case 'Text':
      return { ...base, ctorArgs: [str('Text')], modifiers: [mod('fontSize', [num(16)])] }
    case 'Button':
      return { ...base, ctorArgs: [str('Button')], modifiers: [mod('type', [enumA('ButtonType.Capsule')])] }
    case 'Image':
      return {
        ...base, ctorArgs: [str('placeholder.png')],
        modifiers: [mod('width', [num(80)]), mod('height', [num(60)])],
      }
    case 'Column':
      return { ...base, ctorArgs: [obj({ space: num(8) })] }
    case 'Row':
      return { ...base, ctorArgs: [obj({ space: num(8) })] }
    case 'Stack':
      return { ...base, modifiers: [mod('width', [num(120)]), mod('height', [num(120)])] }
    case 'RelativeContainer':
      return { ...base, modifiers: [mod('width', [str('100%')]), mod('height', [num(120)])] }
    case 'Flex':
      return {
        ...base,
        ctorArgs: [obj({ direction: enumA('FlexDirection.Row'), wrap: enumA('FlexWrap.NoWrap') })],
        modifiers: [mod('width', [str('100%')])],
      }
    case 'Scroll':
      // ArkTS Scroll 独子约束：默认内置一个 Column，后续拖入都进 Column
      return {
        ...base,
        modifiers: [mod('width', [str('100%')]), mod('height', [num(200)])],
        children: [{ type: 'Column', ctorArgs: [obj({ space: num(8) })], children: [text('滚动内容')], modifiers: [mod('padding', [num(12)])] }],
      }
    case 'List':
      return {
        ...base,
        ctorArgs: [obj({ space: num(8) })],
        modifiers: [mod('width', [str('100%')]), mod('height', [num(160)])],
        children: [createNode('ListItem'), createNode('ListItem')],
      }
    case 'ListItem':
      return { ...base, children: [text('列表项')] }
    case 'Grid':
      return {
        ...base,
        modifiers: [
          mod('columnsTemplate', [str('1fr 1fr')]),
          mod('rowsGap', [num(8)]), mod('columnsGap', [num(8)]),
          mod('width', [str('100%')]), mod('height', [num(160)]),
        ],
        children: [createNode('GridItem'), createNode('GridItem'), createNode('GridItem'), createNode('GridItem')],
      }
    case 'GridItem':
      return { ...base, children: [text('项')] }
    case 'Tabs':
      return {
        ...base,
        modifiers: [mod('width', [str('100%')]), mod('height', [num(200)])],
        children: [createTabContent('标签 1'), createTabContent('标签 2')],
      }
    case 'TabContent':
      return createTabContent('标签')
    case 'TextInput':
      return {
        ...base,
        ctorArgs: [obj({ placeholder: str('请输入文本') })],
        modifiers: [mod('width', [str('100%')])],
      }
    case 'Toggle':
      return { ...base, ctorArgs: [obj({ type: enumA('ToggleType.Switch'), isOn: bool(false) })] }
    case 'Slider':
      return {
        ...base,
        ctorArgs: [obj({ value: num(30), min: num(0), max: num(100), step: num(1) })],
        modifiers: [mod('width', [str('100%')])],
      }
    case 'Checkbox':
      return { ...base, ctorArgs: [obj({ name: str('agree'), group: str('g1') })] }
    case 'Radio':
      return { ...base, ctorArgs: [obj({ value: str('0'), group: str('radioGroup') })] }
    case 'Progress':
      return {
        ...base,
        ctorArgs: [obj({ value: num(45), total: num(100), type: enumA('ProgressType.Linear') })],
        modifiers: [mod('width', [str('100%')])],
      }
    case 'Video':
      return {
        ...base,
        ctorArgs: [obj({ src: str('placeholder.mp4') })],
        modifiers: [mod('width', [str('100%')]), mod('height', [num(120)])],
      }
    default:
      return base
  }
}

function createTabContent(label: string): IRNode {
  return {
    type: 'TabContent',
    ctorArgs: [],
    children: [{ type: 'Column', ctorArgs: [], children: [text(label + '内容')], modifiers: [mod('padding', [num(12)])] }],
    modifiers: [mod('tabBar', [str(label)])],
  }
}
