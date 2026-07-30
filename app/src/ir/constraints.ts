import { IRNode } from './types'
import { SINGLE_CHILD_TYPES, specAcceptsChild, specCanAcceptMore } from '../registry'

/**
 * 拖放/粘贴约束：实现已迁至 registry（元件注册表），此处为薄转接层，
 * 保持既有 import 路径（editor/dnd、ir/validate.test 等）不变。
 */

/** 独子容器（ArkTS 编译约束：只能有一个子组件）：Scroll / TabContent */
export const SINGLE_CHILD = new Set(SINGLE_CHILD_TYPES)

/** 容器是否接受某类型子节点（无约束的容器接受任意类型） */
export function acceptsChild(containerType: string, childType: string): boolean {
  return specAcceptsChild(containerType, childType)
}

/** 独子容器是否还能再接受子节点（以目标父容器的当前子数判断） */
export function canAcceptMore(container: IRNode): boolean {
  return specCanAcceptMore(container)
}
