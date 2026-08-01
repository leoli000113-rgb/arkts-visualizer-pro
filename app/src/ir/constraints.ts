import { IRNode } from './types'
import type { Path } from './mutate'
import { SINGLE_CHILD_TYPES, CONTAINER_TYPES, specAcceptsChild, specCanAcceptMore } from '../registry'

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

/**
 * 独子容器（Scroll/TabContent/Badge）已满且独子是容器时下钻到最内层容器：
 * 拖拽落点重定向（computeDrop）、大纲树「＋」插入与粘贴模式点击容器共用。
 */
export function descendFullSingleChild(node: IRNode, path: Path): { node: IRNode; path: Path } {
  let cur = node
  let p = path
  while (!canAcceptMore(cur) && cur.children.length === 1 && CONTAINER_TYPES.has(cur.children[0].type)) {
    cur = cur.children[0]
    p = [...p, 0]
  }
  return { node: cur, path: p }
}
