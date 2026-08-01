import { ArgVal, IRNode, Modifier } from './types'

export type Path = number[]

export function getNodeAtPath(root: IRNode, path: Path): IRNode | undefined {
  let cur: IRNode | undefined = root
  for (const i of path) {
    if (!cur || i < 0 || i >= cur.children.length) return undefined
    cur = cur.children[i]
  }
  return cur
}

export function updateNodeAtPath(root: IRNode, path: Path, fn: (n: IRNode) => IRNode): IRNode {
  if (path.length === 0) return fn(root)
  const [head, ...rest] = path
  const children = root.children.map((c, i) => i === head ? updateNodeAtPath(c, rest, fn) : c)
  return { ...root, children }
}

export function removeNodeAtPath(root: IRNode, path: Path): IRNode {
  if (path.length === 0) return root
  const parentPath = path.slice(0, -1)
  const idx = path[path.length - 1]
  return updateNodeAtPath(root, parentPath, n => ({ ...n, children: n.children.filter((_, i) => i !== idx) }))
}

export function insertChildAtPath(root: IRNode, path: Path, child: IRNode, index: number): IRNode {
  return updateNodeAtPath(root, path, n => {
    const children = n.children.slice()
    const at = Math.max(0, Math.min(children.length, index))
    children.splice(at, 0, child)
    return { ...n, children }
  })
}

export function getModifier(node: IRNode, name: string): Modifier | undefined {
  return node.modifiers.find(m => m.name === name)
}

export function setModifier(node: IRNode, name: string, args: ArgVal[]): IRNode {
  const exists = node.modifiers.some(m => m.name === name)
  const modifiers = exists
    ? node.modifiers.map(m => m.name === name ? { ...m, args } : m)
    : [...node.modifiers, { name, args } as Modifier]
  return { ...node, modifiers }
}

export function removeModifier(node: IRNode, name: string): IRNode {
  return { ...node, modifiers: node.modifiers.filter(m => m.name !== name) }
}

export function numModifier(node: IRNode, name: string): number | undefined {
  const m = getModifier(node, name)
  return m && m.args[0].t === 'num' ? m.args[0].v : undefined
}

export function samePath(a: Path, b: Path): boolean {
  if (a.length !== b.length) return false
  return a.every((x, i) => x === b[i])
}
