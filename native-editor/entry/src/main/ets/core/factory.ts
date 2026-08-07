/**
 * 组件库新节点工厂（纯逻辑）：给定组件类型，生成带合理默认修饰符的 IRNode。
 * 空容器给个底色和内边距，让画布上看得见摸得着。
 */

import { IRNode, Modifier, ArgVal } from './ir'

function base(type: string, modifiers: Modifier[]): IRNode {
  return { type, ctorArgs: [], children: [], modifiers }
}

function num(v: number): ArgVal {
  return { t: 'num', v }
}

function str(v: string): ArgVal {
  return { t: 'str', v }
}

export function newNodeFor(type: string): IRNode {
  switch (type) {
    case 'Text': {
      const n = base('Text', [{ name: 'fontSize', args: [num(16)] }])
      n.ctorArgs = [str('文本')]
      return n
    }
    case 'Button': {
      const n = base('Button', [])
      n.ctorArgs = [str('按钮')]
      return n
    }
    case 'Image':
      return base('Image', [
        { name: 'width', args: [num(120)] },
        { name: 'height', args: [num(120)] },
        { name: 'backgroundColor', args: [str('#e3e5e8')] },
      ])
    case 'TextInput': {
      const n = base('TextInput', [])
      n.ctorArgs = [{ t: 'obj', v: { placeholder: str('请输入') } }]
      return n
    }
    case 'Column':
    case 'Row':
    case 'Stack':
      return base(type, [
        { name: 'padding', args: [num(8)] },
        { name: 'backgroundColor', args: [str('#f0f0f0')] },
      ])
    case 'Scroll':
    case 'List':
      return base(type, [
        { name: 'width', args: [str('100%')] },
        { name: 'height', args: [num(200)] },
        { name: 'backgroundColor', args: [str('#f0f0f0')] },
      ])
    case 'Grid':
      return base('Grid', [
        { name: 'width', args: [str('100%')] },
        { name: 'height', args: [num(200)] },
        { name: 'columnsTemplate', args: [str('1fr 1fr')] },
        { name: 'backgroundColor', args: [str('#f0f0f0')] },
      ])
    case 'Swiper':
      return base('Swiper', [
        { name: 'width', args: [str('100%')] },
        { name: 'height', args: [num(160)] },
        { name: 'backgroundColor', args: [str('#f0f0f0')] },
      ])
    case 'Divider':
      return base('Divider', [])
    default:
      return base(type, [])
  }
}

/** 可作为库组件添加目标的容器类型 */
export const CONTAINER_TYPES = new Set([
  'Column', 'Row', 'Stack', 'Flex', 'Scroll', 'List', 'Grid', 'Swiper',
  'RelativeContainer', 'ListItem', 'GridItem', 'Button', 'If', 'Else',
])
