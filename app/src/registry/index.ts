import { IRNode } from '../ir/types'
import { SPECS } from './specs'
import { Category, ComponentSpec } from './types'

export type { Category, ComponentSpec, FieldSpec } from './types'

const BY_TYPE = new Map<string, ComponentSpec>(SPECS.map(s => [s.type, s]))

/** 按类型取注册声明；未注册返回 undefined（自定义组件/Unknown 等） */
export function getSpec(type: string): ComponentSpec | undefined {
  return BY_TYPE.get(type)
}

/** 组件面板分组（保持既有顺序：布局/容器/基础/表单，结构类不进面板） */
const CATEGORY_ORDER: Category[] = ['布局', '容器', '基础', '表单', '反馈']

export const PALETTE_GROUPS: { label: string; items: string[] }[] =
  CATEGORY_ORDER
    .map(c => ({ label: c as string, items: SPECS.filter(s => s.palette && s.category === c).map(s => s.type) }))
    .filter(g => g.items.length > 0)

/** 容器类型集合（dnd 中部落点判定 inside 用；含结构容器 If/ForEach/BuilderCall） */
export const CONTAINER_TYPES: ReadonlySet<string> = new Set(SPECS.filter(s => s.container).map(s => s.type))

/** 独子容器（Scroll/TabContent） */
export const SINGLE_CHILD_TYPES: ReadonlySet<string> = new Set(SPECS.filter(s => s.singleChild).map(s => s.type))

/** 容器是否接受某类型子节点（无 accepts 白名单的容器接受任意类型） */
export function specAcceptsChild(containerType: string, childType: string): boolean {
  const allowed = BY_TYPE.get(containerType)?.accepts
  return !allowed || allowed.includes(childType)
}

/** 独子容器是否还能再接受子节点 */
export function specCanAcceptMore(container: IRNode): boolean {
  return !SINGLE_CHILD_TYPES.has(container.type) || container.children.length === 0
}

/** 结构节点（If/Else/ForEach/BuilderCall）：修饰符不参与序列化 */
export function isStructural(type: string): boolean {
  return !!BY_TYPE.get(type)?.structural
}

/** 拖入画布时的默认节点（未注册类型返回裸节点） */
export function makeDefaultNode(type: string): IRNode {
  const spec = BY_TYPE.get(type)
  if (spec?.makeDefault) return spec.makeDefault()
  return { type, ctorArgs: [], children: [], modifiers: [] }
}

/** 大纲树节点摘要（未注册/无摘要函数返回 ''） */
export function nodeSummary(node: IRNode): string {
  return BY_TYPE.get(node.type)?.summary?.(node) ?? ''
}
