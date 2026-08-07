/**
 * IR 树编辑操作（纯逻辑，可单测）：路径定位 / 修饰符增删改 / 位移 / 删除 / 复制
 * 路径 = 从根出发的子下标数组（如 [0,2,1]），序列化键 '0.2.1'。
 */

import { ArgVal, IRNode, Modifier } from './ir'

export type Path = number[]

export function pathKey(p: Path): string {
  return p.join('.')
}

export function keyToPath(k: string): Path {
  if (k === '') return []
  return k.split('.').map(s => parseInt(s, 10))
}

export function nodeAtPath(root: IRNode, path: Path): IRNode | null {
  let cur: IRNode = root
  for (const i of path) {
    if (i < 0 || i >= cur.children.length) return null
    cur = cur.children[i]
  }
  return cur
}

/** 父节点 + 在父中的下标；根节点返回 null */
export function parentOf(root: IRNode, path: Path): { parent: IRNode, index: number } | null {
  if (path.length === 0) return null
  const parent = nodeAtPath(root, path.slice(0, path.length - 1))
  if (parent === null) return null
  return { parent, index: path[path.length - 1] }
}

export function findModifier(node: IRNode, name: string): Modifier | null {
  for (const m of node.modifiers) {
    if (m.name === name) return m
  }
  return null
}

/** 设置/替换修饰符；args 为空时移除该修饰符 */
export function setModifier(node: IRNode, name: string, args: ArgVal[]): void {
  const rest: Modifier[] = []
  for (const m of node.modifiers) {
    if (m.name !== name) rest.push(m)
  }
  node.modifiers = rest
  if (args.length > 0) node.modifiers.push({ name, args })
}

export function removeModifier(node: IRNode, name: string): void {
  setModifier(node, name, [])
}

/** 设置单数值修饰符（width/fontSize/opacity/...） */
export function setNumModifier(node: IRNode, name: string, v: number): void {
  setModifier(node, name, [{ t: 'num', v }])
}

/** 设置颜色修饰符：'#rrggbb' 字符串；非法输入忽略 */
export function setColorModifier(node: IRNode, name: string, v: string): void {
  const t = v.trim()
  if (!/^#[0-9a-fA-F]{3,8}$/.test(t)) return
  setModifier(node, name, [{ t: 'str', v: t }])
}

/** 设置长度修饰符：纯数字 → num(vp)，含 % 或单位 → str */
export function setLengthModifier(node: IRNode, name: string, v: string): void {
  const t = v.trim()
  if (t === '') { removeModifier(node, name); return }
  if (/^-?[0-9]+(\.[0-9]+)?$/.test(t)) { setNumModifier(node, name, parseFloat(t)); return }
  setModifier(node, name, [{ t: 'str', v: t }])
}

/** 设置文本构造参数（Text/Button 的第一个字符串参数） */
export function setTextArg(node: IRNode, v: string): void {
  node.ctorArgs = [{ t: 'str', v }]
}

export function readTextArg(node: IRNode): string | null {
  const a = node.ctorArgs[0]
  return a !== undefined && a.t === 'str' ? a.v : null
}

/** 读取单数值修饰符的当前值（属性面板回显用） */
export function readNumModifier(node: IRNode, name: string): number | null {
  const m = findModifier(node, name)
  const a = m !== null ? m.args[0] : undefined
  return a !== undefined && a.t === 'num' ? a.v : null
}

export function readStrModifier(node: IRNode, name: string): string | null {
  const m = findModifier(node, name)
  const a = m !== null ? m.args[0] : undefined
  return a !== undefined && a.t === 'str' ? a.v : null
}

/**
 * 位移：优先改 offset（无则创建 {x:0,y:0}），x/y 累加 dx/dy。
 * 返回是否成功（目标节点存在）。
 */
export function moveBy(node: IRNode, dx: number, dy: number): boolean {
  let m = findModifier(node, 'offset')
  if (m === null) {
    m = { name: 'offset', args: [{ t: 'obj', v: { x: { t: 'num', v: 0 }, y: { t: 'num', v: 0 } } }] }
    node.modifiers.push(m)
  }
  const a = m.args[0]
  if (a === undefined || a.t !== 'obj') return false
  const x = a.v['x']
  const y = a.v['y']
  if (x !== undefined && x.t === 'num') x.v += dx
  else a.v['x'] = { t: 'num', v: dx }
  if (y !== undefined && y.t === 'num') y.v += dy
  else a.v['y'] = { t: 'num', v: dy }
  return true
}

/** 删除路径节点；根不可删。返回是否删除成功 */
export function deleteAtPath(root: IRNode, path: Path): boolean {
  const pi = parentOf(root, path)
  if (pi === null) return false
  pi.parent.children.splice(pi.index, 1)
  return true
}

export function cloneNode(n: IRNode): IRNode {
  return JSON.parse(JSON.stringify(n)) as IRNode
}

/** 复制路径节点为其后一个兄弟；根不可复制。返回新节点路径或 null */
export function duplicateAtPath(root: IRNode, path: Path): Path | null {
  const pi = parentOf(root, path)
  if (pi === null) return null
  pi.parent.children.splice(pi.index + 1, 0, cloneNode(pi.parent.children[pi.index]))
  const np = path.slice(0, path.length - 1)
  np.push(pi.index + 1)
  return np
}

/**
 * 智能插入（组件库添加）：选中容器 → 追加为其最后一个子节点；
 * 选中叶子组件 → 插到其父容器中、紧随选中项之后。返回新节点路径。
 */
export function insertAuto(root: IRNode, selPath: Path, node: IRNode, containers: Set<string>): Path | null {
  const sel = nodeAtPath(root, selPath)
  if (sel !== null && containers.has(sel.type)) {
    sel.children.push(node)
    const p = selPath.slice()
    p.push(sel.children.length - 1)
    return p
  }
  const pi = parentOf(root, selPath)
  if (pi !== null) {
    pi.parent.children.splice(pi.index + 1, 0, node)
    const p = selPath.slice(0, selPath.length - 1)
    p.push(pi.index + 1)
    return p
  }
  return null
}
