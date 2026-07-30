import { useStore } from '../store/store'
import { getNodeAtPath, samePath, setModifier, Path } from '../ir/mutate'
import { acceptsChild, canAcceptMore } from '../ir/constraints'
import { CONTAINER_TYPES } from '../registry'
import { IRNode } from '../ir/types'
import { createNode } from '../ir/defaults'

// 约束定义已迁至 registry（元件注册表）；此处再导出保持既有引用可用
export { acceptsChild, canAcceptMore, SINGLE_CHILD } from '../ir/constraints'

export type DropPos = 'before' | 'inside' | 'after'
export interface DropTarget { path: Path; pos: DropPos; parent: Path; index: number; at?: { x: number; y: number } }
interface Ctx {
  kind: 'new' | 'move'
  type?: string
  node?: IRNode
  path?: Path
  /** Alt+拖拽自由偏移：按下时的指针坐标、被拖节点原 offset 值与起始屏幕矩形（吸附用） */
  freeOffset?: { startX: number; startY: number; baseX: number; baseY: number; rect?: { left: number; top: number; w: number; h: number } }
}

/** 容器判定（中部落点 = inside）：由 registry 派生 */
const CONTAINERS = CONTAINER_TYPES

/** 屏幕像素 → vp 的换算系数（基准 1vp = 0.6 CSS px × 画布缩放） */
function pxPerVp(): number {
  return 0.6 * useStore.getState().zoom
}

let ctx: Ctx | null = null
let bound = false

/* ---- 拖拽跟手标签（ghost） ---- */
let ghost: HTMLDivElement | null = null
function showGhost(label: string) {
  hideGhost()
  ghost = document.createElement('div')
  ghost.className = 'drag-ghost'
  ghost.textContent = label
  document.body.appendChild(ghost)
}
function moveGhost(x: number, y: number) {
  if (ghost) { ghost.style.left = x + 'px'; ghost.style.top = y + 'px' }
}
function hideGhost() {
  ghost?.remove()
  ghost = null
}

/* ---- 对齐吸附参考线 ---- */
const SNAP_VP = 3
const SNAP_PX = () => SNAP_VP * pxPerVp()

let guideEls: HTMLDivElement[] = []
function clearGuides() {
  for (const el of guideEls) el.remove()
  guideEls = []
}
function drawGuides(box: DOMRect, vx?: number, hy?: number) {
  clearGuides()
  if (vx !== undefined) {
    const el = document.createElement('div')
    el.className = 'snap-guide-v'
    el.style.left = vx + 'px'
    el.style.top = box.top + 'px'
    el.style.height = box.height + 'px'
    document.body.appendChild(el)
    guideEls.push(el)
  }
  if (hy !== undefined) {
    const el = document.createElement('div')
    el.className = 'snap-guide-h'
    el.style.top = hy + 'px'
    el.style.left = box.left + 'px'
    el.style.width = box.width + 'px'
    document.body.appendChild(el)
    guideEls.push(el)
  }
}

/** 画布元素按 path 查找（data-path 由 renderer 写入，root 为空串） */
function elOf(path: Path): HTMLElement | null {
  return document.querySelector(`[data-path="${path.join('.')}"]`)
}

/** 候选对齐线（屏幕 px）：容器边缘/中线 + 各兄弟矩形的左中右 / 上中下 */
function candidateLines(containerBox: DOMRect, siblingBoxes: DOMRect[]): { vx: number[]; hy: number[] } {
  const vx = [containerBox.left, containerBox.left + containerBox.width / 2, containerBox.right]
  const hy = [containerBox.top, containerBox.top + containerBox.height / 2, containerBox.bottom]
  for (const b of siblingBoxes) {
    vx.push(b.left, b.left + b.width / 2, b.right)
    hy.push(b.top, b.top + b.height / 2, b.bottom)
  }
  return { vx, hy }
}

function snapVal(v: number, candidates: number[], thr: number): { v: number; line?: number } {
  let bestD = Infinity
  let line: number | undefined
  for (const c of candidates) {
    const d = Math.abs(v - c)
    if (d <= thr && d < bestD) { bestD = d; line = c }
  }
  return line === undefined ? { v } : { v: line, line }
}

/** 矩形三边（起/中/止）逐一尝试吸附，取偏差最小者 */
function snapEdges(start: number, size: number, candidates: number[], thr: number): { delta: number; line?: number } {
  let best: { delta: number; line?: number } = { delta: 0 }
  let bestD = Infinity
  for (const p of [start, start + size / 2, start + size]) {
    const r = snapVal(p, candidates, thr)
    if (r.line !== undefined && Math.abs(r.v - p) < bestD) {
      bestD = Math.abs(r.v - p)
      best = { delta: r.v - p, line: r.line }
    }
  }
  return best
}

function attach() {
  if (bound) return
  bound = true
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  // 窗外松开/系统取消/窗口失焦时兜底收尾，避免拖拽态与落点指示卡死（「蓝屏」根因）
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('blur', onCancel)
  window.addEventListener('keydown', onEsc)
}
function detach() {
  bound = false
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
  window.removeEventListener('blur', onCancel)
  window.removeEventListener('keydown', onEsc)
}

/** 取消当前手势：不落下、清 ghost/参考线/落点（Esc/失焦/pointercancel 共用） */
function onCancel() {
  if (!ctx) return
  endDrag()
}
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') onCancel()
}

export function startNewDrag(type: string) {
  ctx = { kind: 'new', type }
  showGhost(type)
  attach()
}
export function startNewDragNode(node: IRNode) {
  ctx = { kind: 'new', node }
  showGhost(node.type)
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
    // 起始屏幕矩形（含基准 offset）：吸附以它为基准平移
    const r = elOf(path)?.getBoundingClientRect()
    if (r) ctx.freeOffset.rect = { left: r.left, top: r.top, w: r.width, h: r.height }
    s.pushHistory() // 整个手势合并为一步撤销
  }
  const t = useStore.getState().ir ? getNodeAtPath(useStore.getState().ir!.root, path)?.type : undefined
  showGhost((t ?? '组件') + (altKey ? ' · 偏移' : ''))
  attach()
}
export function endDrag() {
  ctx = null
  detach()
  hideGhost()
  clearGuides()
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

/** 计算落点（画布与大纲树共用）：bands 判定 before/inside/after 并做约束校验；snap 仅画布开启（Stack 指针吸附） */
function computeDrop(root: IRNode, path: Path, ratio: number, box: DOMRect, clientX: number, clientY: number, snap: boolean): DropTarget | null {
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
    const k = pxPerVp()
    let px = clientX
    let py = clientY
    if (snap) {
      // 指针吸附到兄弟/容器的边缘与中线（±SNAP_VP），并绘制参考线
      const sibBoxes = node.children
        .map((_, i) => elOf([...path, i]))
        .filter((el): el is HTMLElement => !!el)
        .map(el => el.getBoundingClientRect())
      const cand = candidateLines(box, sibBoxes)
      const sx = snapVal(clientX, cand.vx, SNAP_PX())
      const sy = snapVal(clientY, cand.hy, SNAP_PX())
      if (sx.line !== undefined || sy.line !== undefined) drawGuides(box, sx.line, sy.line)
      px = sx.v
      py = sy.v
    }
    at = { x: Math.round((px - box.left) / k), y: Math.round((py - box.top) / k) }
  }
  return { path, pos, parent: parent_, index: idx, at }
}

function onMove(e: PointerEvent) {
  if (!ctx) return
  moveGhost(e.clientX, e.clientY)
  clearGuides()
  const s = useStore.getState()
  if (!s.ir) return
  // Alt+拖拽自由偏移：实时改写 .offset({x,y})（vp，1 位小数），不产生落点
  if (ctx.freeOffset && ctx.path) {
    const dragPath = ctx.path
    const fo = ctx.freeOffset
    let ox = Math.round((fo.baseX + (e.clientX - fo.startX) / pxPerVp()) * 10) / 10
    let oy = Math.round((fo.baseY + (e.clientY - fo.startY) / pxPerVp()) * 10) / 10
    // 吸附：被拖矩形（起始矩形 + 位移）的边缘/中线对齐兄弟与父容器
    if (fo.rect) {
      const k = pxPerVp()
      const parentPath = dragPath.slice(0, -1)
      const parentEl = elOf(parentPath)
      const parentNode = getNodeAtPath(s.ir.root, parentPath)
      if (parentEl && parentNode) {
        const sibBoxes = parentNode.children
          .map((_, i) => [...parentPath, i])
          .filter(p => !samePath(p, dragPath))
          .map(p => elOf(p))
          .filter((el): el is HTMLElement => !!el)
          .map(el => el.getBoundingClientRect())
        const cand = candidateLines(parentEl.getBoundingClientRect(), sibBoxes)
        const wantL = fo.rect.left + (ox - fo.baseX) * k
        const wantT = fo.rect.top + (oy - fo.baseY) * k
        const sx = snapEdges(wantL, fo.rect.w, cand.vx, SNAP_PX())
        const sy = snapEdges(wantT, fo.rect.h, cand.hy, SNAP_PX())
        if (sx.line !== undefined) ox = Math.round((ox + sx.delta / k) * 10) / 10
        if (sy.line !== undefined) oy = Math.round((oy + sy.delta / k) * 10) / 10
        if (sx.line !== undefined || sy.line !== undefined) drawGuides(parentEl.getBoundingClientRect(), sx.line, sy.line)
      }
    }
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
    s.setDropTarget(computeDrop(s.ir.root, path, ratio, box, e.clientX, e.clientY, false))
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
  s.setDropTarget(computeDrop(s.ir.root, path, ratio, box, e.clientX, e.clientY, true))
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
