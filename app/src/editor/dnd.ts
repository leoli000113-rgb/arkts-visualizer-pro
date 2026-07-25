import { useStore } from '../store/store'
import { getNodeAtPath, samePath, setModifier, Path } from '../ir/mutate'
import { IRNode } from '../ir/types'
import { createNode } from '../ir/defaults'

export type DropPos = 'before' | 'inside' | 'after'
export interface DropTarget { path: Path; pos: DropPos; parent: Path; index: number; at?: { x: number; y: number } }
interface Ctx {
  kind: 'new' | 'move'
  type?: string
  node?: IRNode
  path?: Path
  /** Alt+拖拽自由偏移：按下时的指针坐标与被拖节点原 offset 值 */
  freeOffset?: { startX: number; startY: number; baseX: number; baseY: number }
}

const CONTAINERS = new Set([
  'Column', 'Row', 'Stack', 'RelativeContainer', 'Flex',
  'Scroll', 'List', 'Grid', 'Tabs', 'TabContent', 'If', 'ForEach', 'BuilderCall',
])

/** 子类型约束：这些容器只接受特定子组件，违反时落点不显示、落下无效 */
const CHILD_CONSTRAINTS: Record<string, ReadonlySet<string>> = {
  List: new Set(['ListItem']),
  Grid: new Set(['GridItem']),
  Tabs: new Set(['TabContent']),
}

/** 独子容器（ArkTS 编译约束：只能有一个子组件）：Scroll / TabContent */
export const SINGLE_CHILD = new Set(['Scroll', 'TabContent'])

/** 容器是否接受某类型子节点（无约束的容器接受任意类型） */
export function acceptsChild(containerType: string, childType: string): boolean {
  const allowed = CHILD_CONSTRAINTS[containerType]
  return !allowed || allowed.has(childType)
}

/** 独子容器是否还能再接受子节点（以目标父容器的当前子数判断） */
export function canAcceptMore(container: IRNode): boolean {
  return !SINGLE_CHILD.has(container.type) || container.children.length === 0
}

let ctx: Ctx | null = null
let bound = false

function attach() {
  if (bound) return
  bound = true
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
function detach() {
  bound = false
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}

export function startNewDrag(type: string) {
  ctx = { kind: 'new', type }
  attach()
}
export function startNewDragNode(node: IRNode) {
  ctx = { kind: 'new', node }
  attach()
}
export function startMoveDrag(path: Path, altKey = false) {
  ctx = { kind: 'move', path }
  if (altKey) {
    // Alt+拖拽 = 自由偏移（.offset），不改动结构：读取当前 offset 作为基准
    const s = useStore.getState()
    const node = s.ir ? getNodeAtPath(s.ir.root, path) : undefined
    const off = node?.modifiers.find(m => m.name === 'offset')?.args[0]
    const obj = off && off.t === 'obj' ? off.v : undefined
    const bx = obj?.x && obj.x.t === 'num' ? obj.x.v : 0
    const by = obj?.y && obj.y.t === 'num' ? obj.y.v : 0
    ctx.freeOffset = { startX: 0, startY: 0, baseX: bx, baseY: by }
    s.pushHistory() // 整个手势合并为一步撤销
  }
  attach()
}
export function endDrag() {
  ctx = null
  detach()
  useStore.getState().setDropTarget(null)
}

let pending: { path: Path; x: number; y: number } | null = null
let pendingBound = false

function attachPending() {
  if (pendingBound) return
  pendingBound = true
  window.addEventListener('pointermove', onMaybeMove)
  window.addEventListener('pointerup', onMaybeUp)
}
function detachPending() {
  pendingBound = false
  window.removeEventListener('pointermove', onMaybeMove)
  window.removeEventListener('pointerup', onMaybeUp)
}

export function beginMaybeMove(path: Path, e: React.PointerEvent) {
  e.stopPropagation()
  pending = { path, x: e.clientX, y: e.clientY }
  attachPending()
}

function onMaybeMove(e: PointerEvent) {
  if (!pending) return
  const dx = e.clientX - pending.x
  const dy = e.clientY - pending.y
  if (dx * dx + dy * dy < 25) return
  const path = pending.path
  const alt = e.altKey
  const sx = pending.x
  const sy = pending.y
  pending = null
  detachPending()
  startMoveDrag(path, alt)
  if (ctx?.freeOffset) { ctx.freeOffset.startX = sx; ctx.freeOffset.startY = sy }
}
function onMaybeUp() {
  pending = null
  detachPending()
}

/** 计算落点（画布与大纲树共用）：bands 判定 before/inside/after 并做约束校验 */
function computeDrop(root: IRNode, path: Path, ratio: number, box: DOMRect, clientX: number, clientY: number): DropTarget | null {
  const node = getNodeAtPath(root, path)
  if (!node) return null
  const parentPath = path.slice(0, -1)
  const parent = parentPath.length ? getNodeAtPath(root, parentPath) : null
  const band = 0.3
  let pos: DropPos
  if (path.length === 0) pos = 'inside'
  else if (CONTAINERS.has(node.type)) pos = ratio < band ? 'before' : ratio > 1 - band ? 'after' : 'inside'
  else pos = ratio < 0.5 ? 'before' : 'after'
  const parent_ = pos === 'inside' ? path : parentPath
  const last = path.length ? path[path.length - 1] : 0
  const idx = pos === 'inside' ? node.children.length : pos === 'before' ? last : last + 1
  // 子类型约束 + 独子约束（同父搬运不增加子数，跳过独子检查）
  const containerNode = pos === 'inside' ? node : parent
  if (containerNode) {
    const childType = draggedType(root)
    if (childType && !acceptsChild(containerNode.type, childType)) return null
    const sameParentMove = ctx?.kind === 'move' && !!ctx.path && samePath(ctx.path.slice(0, -1), parent_)
    if (!sameParentMove && !canAcceptMore(containerNode)) return null
  }
  // Stack 自由定位：inside 落点记录指针坐标（vp），落下时写入子节点 .position({x,y})
  let at: { x: number; y: number } | undefined
  if (pos === 'inside' && node.type === 'Stack') {
    at = { x: Math.round((clientX - box.left) / 0.6), y: Math.round((clientY - box.top) / 0.6) }
  }
  return { path, pos, parent: parent_, index: idx, at }
}

function onMove(e: PointerEvent) {
  if (!ctx) return
  const s = useStore.getState()
  if (!s.ir) return
  // Alt+拖拽自由偏移：实时改写 .offset({x,y})（vp，1 位小数），不产生落点
  if (ctx.freeOffset && ctx.path) {
    const fo = ctx.freeOffset
    const ox = Math.round((fo.baseX + (e.clientX - fo.startX) / 0.6) * 10) / 10
    const oy = Math.round((fo.baseY + (e.clientY - fo.startY) / 0.6) * 10) / 10
    s.mutateNode(ctx.path, n2 => setModifier(n2, 'offset', [{ t: 'obj', v: { x: { t: 'num', v: ox }, y: { t: 'num', v: oy } } }]), { history: false })
    return
  }
  const els = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
  // 大纲树落点：行上 30%/30% 分带（Row 父按水平、其余按垂直——树内一律垂直分带）
  const treeRow = els.find(x => typeof x.hasAttribute === 'function' && x.hasAttribute('data-tree-path'))
  if (treeRow) {
    const pathStr = treeRow.getAttribute('data-tree-path') || ''
    const path: Path = pathStr === '' ? [] : pathStr.split('.').map(Number)
    const box = treeRow.getBoundingClientRect()
    const ratio = (e.clientY - box.top) / (box.height || 1)
    s.setDropTarget(computeDrop(s.ir.root, path, ratio, box, e.clientX, e.clientY))
    return
  }
  // 画布落点
  const el = els.find(x => typeof x.hasAttribute === 'function' && x.hasAttribute('data-path'))
  if (!el) { s.setDropTarget(null); return }
  const pathStr = el.getAttribute('data-path') || ''
  const path: Path = pathStr === '' ? [] : pathStr.split('.').map(Number)
  const node = getNodeAtPath(s.ir.root, path)
  if (!node) { s.setDropTarget(null); return }
  const parentPath = path.slice(0, -1)
  const parent = parentPath.length ? getNodeAtPath(s.ir.root, parentPath) : null
  const box = el.getBoundingClientRect()
  const w = box.width || 1
  const h = box.height || 1
  const rx = (e.clientX - box.left) / w
  const ry = (e.clientY - box.top) / h
  const horizontal = parent?.type === 'Row'
  const ratio = horizontal ? rx : ry
  s.setDropTarget(computeDrop(s.ir.root, path, ratio, box, e.clientX, e.clientY))
}

function onUp() {
  if (!ctx) { detach(); return }
  performDrop()
}

function isMoveValid(from: Path, toParent: Path): boolean {
  if (from.length === 0) return false
  if (toParent.length >= from.length && from.every((x, i) => x === toParent[i])) return false
  return true
}

/** 当前拖拽载荷的组件类型（新增=面板类型；搬运=被拖节点类型） */
function draggedType(root: IRNode): string | null {
  if (!ctx) return null
  if (ctx.kind === 'new') {
    if (ctx.node) return ctx.node.type
    return ctx.type ?? null
  }
  if (ctx.path) return getNodeAtPath(root, ctx.path)?.type ?? null
  return null
}

function performDrop() {
  const c = ctx
  const s = useStore.getState()
  if (!c || !s.ir || !s.dropTarget) { endDrag(); return }
  const t = s.dropTarget
  const sameParentMove = c.kind === 'move' && !!c.path && samePath(c.path.slice(0, -1), t.parent)
  // 落点可能因 IR 变更而过期，落下前再校验一次；同父搬运不增加子数，跳过独子检查
  const toParentNode = getNodeAtPath(s.ir.root, t.parent)
  const childType = draggedType(s.ir.root)
  if (!toParentNode || (childType && !acceptsChild(toParentNode.type, childType))) { endDrag(); return }
  if (!sameParentMove && !canAcceptMore(toParentNode)) { endDrag(); return }
  // Stack 自由定位：position({x,y}) 修饰符
  const posMod = (n: IRNode): IRNode => t.at
    ? setModifier(n, 'position', [{ t: 'obj', v: { x: { t: 'num', v: t.at.x }, y: { t: 'num', v: t.at.y } } }])
    : n
  if (c.kind === 'new' && (c.type || c.node)) {
    const node = c.node ? c.node : createNode(c.type!)
    s.insertChild(t.parent, posMod(node), t.index)
  } else if (c.kind === 'move' && c.path) {
    if (!isMoveValid(c.path, t.parent)) { endDrag(); return }
    if (t.at && sameParentMove) {
      // 同 Stack 内拖动 = 纯改位置，不重排
      s.mutateNode(c.path, posMod)
    } else {
      s.moveNode(c.path, t.parent, t.index)
      if (t.at) {
        // 跨容器落入 Stack：搬移后补 position（history:false，并入上一步撤销）
        const sp = useStore.getState().selectedPath
        if (sp) s.mutateNode(sp, posMod, { history: false })
      }
    }
  }
  endDrag()
}
