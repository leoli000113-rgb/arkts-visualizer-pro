import { IRNode } from './types'
import { makeDefaultNode } from '../registry'

/**
 * 默认节点工厂：实现已迁至 registry/specs.ts（元件注册表），
 * 此处保持 createNode API 不变（dnd、store 测试等既有调用点无需修改）。
 */
export function createNode(type: string): IRNode {
  return makeDefaultNode(type)
}
