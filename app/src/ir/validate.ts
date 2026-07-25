import { IRNode } from './types'

/**
 * ArkTS 结构约束校验（对齐 hvigor 编译错误，如「Scroll can have only one child component」）。
 * 返回人类可读的问题列表；空数组 = 无结构风险。
 */
export function validateIr(root: IRNode): string[] {
  const problems: string[] = []
  /** 注释/表达式节点不参与结构约束判定 */
  const skip = (c: IRNode) => c.type === 'Comment' || c.type === 'Expr'
  const walk = (n: IRNode, parent: IRNode | null, trail: string) => {
    const here = trail ? `${trail} > ${n.type}` : n.type
    const kids = n.children.filter(c => !skip(c))
    if ((n.type === 'Scroll' || n.type === 'TabContent') && kids.length > 1) {
      problems.push(`${here}：${n.type} 只能有一个子组件（当前 ${kids.length} 个），编译会报错`)
    }
    if (n.type === 'List') {
      for (const c of kids) {
        if (c.type !== 'ListItem' && c.type !== 'ForEach') problems.push(`${here}：List 的直接子组件必须是 ListItem（发现 ${c.type}）`)
      }
    }
    if (n.type === 'Grid') {
      for (const c of kids) {
        if (c.type !== 'GridItem' && c.type !== 'ForEach') problems.push(`${here}：Grid 的直接子组件必须是 GridItem（发现 ${c.type}）`)
      }
    }
    if (n.type === 'Tabs') {
      for (const c of kids) {
        if (c.type !== 'TabContent') problems.push(`${here}：Tabs 的直接子组件必须是 TabContent（发现 ${c.type}）`)
      }
    }
    if (n.type === 'ListItem' && parent && parent.type !== 'List' && parent.type !== 'ForEach') {
      problems.push(`${here}：ListItem 只能作为 List 的子组件`)
    }
    if (n.type === 'GridItem' && parent && parent.type !== 'Grid' && parent.type !== 'ForEach') {
      problems.push(`${here}：GridItem 只能作为 Grid 的子组件`)
    }
    if (n.type === 'TabContent' && parent && parent.type !== 'Tabs') {
      problems.push(`${here}：TabContent 只能作为 Tabs 的子组件`)
    }
    n.children.forEach(c => walk(c, n, here))
  }
  walk(root, null, '')
  return problems
}
