import { useStore } from '../store/store'
import { getNodeAtPath, samePath, setModifier, Path } from '../ir/mutate'
import { acceptsChild, canAcceptMore, descendFullSingleChild } from '../ir/constraints'
import { CONTAINER_TYPES } from '../registry'
import { IRNode } from '../ir/types'
import { createNode } from '../ir/defaults'
import { pxPerVp } from './scale'
import { keyOf } from '../renderer/shared'
import { sendDragStart, sendDragDelta, sendDragEnd } from '../ai/ws'

// 约束定义已迁至 registry（元件注册表）；此处再导出保持既有引用可用
export { acceptsChild, canAcceptMore, SINGLE_CHILD, descendFullSingleChild } from '../ir/constraints'
// px↔vp 换算口径统一在 ./scale（基于 effZoom）；再导出保持既有引用可用
export { pxPerVp } from './scale'

export type DropPos = 'before' | 'inside' | 'after'
export interface DropTarget { path: Path; pos: DropPos; parent: Path; index: number; at?: { x: number; y: number } }
interface Ctx {
  kind: 'new' | 'move'
  type?: string
  node?: IRNode
  path?: Path
  /** Alt+拖拽自由偏移：按下时的指针坐标、被拖节点原 offset 值与起始屏幕矩形（吸附用）。
   *  lastOx/lastOy = 上次发往设备的绝对 offset（vp）；真机托管模式下按增量 delta 推送，
   *  设备端累加 applyOffset，故每次 move 只发 (ox - lastOx) 的差量，避免重复累加。 */
  freeOffset?: { startX: number; startY: number; baseX: number; baseY: number; rect?: { left: number; top: number; w: number; h: number }; lastOx?: number; lastOy?: number }
}

/** 容器判定（中部落点 = inside）：由 registry 派生 */
const CONTAINERS = CONTAINER_TYPES

let ctx: Ctx | null = null
let bound = false

/* ---- 拖拽跟手标签（ghost） ---- */
let ghost: HTMLDivElement | null = null
function showGhost(label: string) {
  hideGhost()
  if (typeof document === 'undefined') return // SSR/测试环境无 DOM
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

/** 画布元素按 path 查找（data-path 由 renderer 写入，root 为空串）。
 *  必须限定 .phone-screen 范围：模板缩略图（TemplateThumb）也用 renderNode 渲染，
 *  带同样的 data-path——不限定范围会命中缩略图，导致拖拽吸附/落点解析到错误元素。 */
function elOf(path: Path): HTMLElement | null {
  return document.querySelector(`.phone-screen [data-path="${path.join('.')}"]`)
}

/** 真机画布模式：WS 连上且设备已回发几何图 → 主画布是 MJPEG+overlay，无 [data-path] DOM。
 *  此时落点/吸附改用 store.geo（path→{x,y,w,h}，canvas 相对 vp）合成屏幕矩形。 */
function realCanvas(): boolean {
  const s = useStore.getState()
  return s.wsOnline && s.geo.size > 0
}

/** .phone-screen 的屏幕矩形（geo→屏幕坐标换算原点）。 */
function phoneScreenRect(): DOMRect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('.phone-screen')
  return el ? el.getBoundingClientRect() : null
}

/** geo 条目（canvas 相对 vp）→ 屏幕像素 DOMRect。与原 DOM getBoundingClientRect 等价：
 *  1vp = 0.6 css × effZoom = pxPerVp()，故 left = phoneScreen.left + geo.x * pxPerVp()。 */
function geoRectOf(path: Path): DOMRect | null {
  const r = useStore.getState().geo.get(keyOf(path))
  if (!r) return null
  const ps = phoneScreenRect()
  if (!ps) return null
  const k = pxPerVp()
  const left = ps.left + r.x * k
  const top = ps.top + r.y * k
  const w = r.w * k
  const h = r.h * k
  return { left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

/** 统一取节点屏幕矩形：真机画布走 geo，DOM 画布走 elOf。各调用点据此自动双模工作。 */
function rectOf(path: Path): DOMRect | null {
  if (realCanvas()) return geoRectOf(path)
  const el = elOf(path)
  return el ? el.getBoundingClientRect() : null
}

/** geo key（可能带 ForEach #k 后缀）→ 干净 IR Path。root 空串 → []。 */
function pathFromGeoKey(k: string): Path {
  const clean = k.split('#')[0]
  if (clean === '') return []
  return clean.split('.').map(Number)
}

/** 真机画布命中测试：屏幕坐标 → 画布相对 vp → 取包含点且面积最小的 geo 条目（最深节点）。
 *  返回 {path, box}，box 为该条目的屏幕矩形（供 computeDrop 分带/吸附）。 */
function hitTestGeo(x: number, y: number): { path: Path; box: DOMRect } | null {
  const geo = useStore.getState().geo
  const ps = phoneScreenRect()
  if (!ps) return null
  const k = pxPerVp()
  const vx = (x - ps.left) / k
  const vy = (y - ps.top) / k
  let bestKey: string | null = null
  let bestArea = Infinity
  for (const [key, r] of geo) {
    if (vx < r.x || vx > r.x + r.w || vy < r.y || vy > r.y + r.h) continue
    const a = r.w * r.h
    if (a < bestArea) { bestArea = a; bestKey = key }
  }
  if (bestKey === null) return null
  const r = geo.get(bestKey)!
  const left = ps.left + r.x * k
  const top = ps.top + r.y * k
  const w = r.w * k
  const h = r.h * k
  const box: DOMRect = { left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top, toJSON: () => ({}) } as DOMRect
  return { path: pathFromGeoKey(bestKey), box }
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
  if (bound || typeof window === 'undefined') return // SSR/测试环境无 window
  bound = true
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  // 窗外松开/系统取消/窗口失焦时兜底收尾，避免拖拽态与落点指示卡死（「蓝屏」根因）
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('blur', onCancel)
  window.addEventListener('keydown', onEsc)
}
function detach() {
  if (typeof window === 'undefined') { bound = false; return }
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
  // 真机托管拖拽被取消：设备仍处 dragging 态、applyOffset 已偏移，必须发 drag-end
  // 让设备复位（丢弃本次偏移，本地 IR 不提交——与 DOM 模式取消语义一致）
  if (ctx.freeOffset && realCanvas()) sendDragEnd()
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
    ctx.freeOffset = { startX: 0, startY: 0, baseX: bx, baseY: by, lastOx: bx, lastOy: by }
    // 起始屏幕矩形（含基准 offset）：吸附以它为基准平移
    const r = rectOf(path)
    if (r) ctx.freeOffset.rect = { left: r.left, top: r.top, w: r.width, h: r.height }
    s.pushHistory() // 整个手势合并为一步撤销
    // 真机托管：发 drag-start，设备 snapshot+readOffset 取基准、置 dragging；
    // 之后每次 move 发增量 delta（设备 applyOffset 热写视觉），松手时本地一次性提交。
    if (realCanvas()) sendDragStart(keyOf(path), keyOf(path))
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

let pending: { path: Path; x: number; y: number; fromTree: boolean } | null = null
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

export function beginMaybeMove(path: Path, e: React.PointerEvent, fromTree = false) {
  e.stopPropagation()
  if (e.button !== 0) return // 仅左键可拖：右键按下留给上下文菜单，避免右键滑动误起拖拽
  pending = { path, x: e.clientX, y: e.clientY, fromTree }
  attachPending()
}

function onMaybeMove(e: PointerEvent) {
  if (!pending) return
  try {
    onMaybeMoveInner(e)
  } catch (err) {
    // 预备拖拽阶段异常也必须清 pending，否则每次移动都重复抛错、手势卡死
    console.error('[dnd] onMaybeMove', err)
    pending = null
    detachPending()
  }
}
/**
 * 拖拽起手势的目标与模式判定（纯函数，可测）：
 * 画布「位置调整」模式下，按下点命中的其实是最内层子组件——只要落点在 nudge 目标子树内
 * （含目标本身），拖拽目标就提升到 nudge 节点并走偏移模式，否则微调父组件会变成拖动子组件。
 */
export function resolveDragStart(path: Path, fromTree: boolean, nudge: Path | null, altKey: boolean): { dragPath: Path; alt: boolean } {
  const inNudge = !fromTree && !!nudge &&
    nudge.length <= path.length && nudge.every((v, i) => v === path[i])
  return { dragPath: inNudge ? nudge! : path, alt: altKey || inNudge }
}

function onMaybeMoveInner(e: PointerEvent) {
  if (!pending) return
  if (e.buttons === 0) { pending = null; detachPending(); return } // 错过了 pointerup → 取消预备拖拽
  const dx = e.clientX - pending.x
  const dy = e.clientY - pending.y
  if (dx * dx + dy * dy < 25) return
  const { path, fromTree } = pending
  // 画布「位置调整」模式（右键菜单开启）：拖拽该节点只改 .offset，不动结构；
  // 大纲树发起的拖拽保持结构化移动（树是结构编辑中枢）
  const { dragPath, alt } = resolveDragStart(path, fromTree, useStore.getState().nudgePath, e.altKey)
  const sx = pending.x
  const sy = pending.y
  pending = null
  detachPending()
  startMoveDrag(dragPath, alt)
  if (ctx?.freeOffset) { ctx.freeOffset.startX = sx; ctx.freeOffset.startY = sy }
}
function onMaybeUp() {
  pending = null
  detachPending()
}

/**
 * 计算落点（画布与大纲树共用）。
 * 大纲树（canvas=false）：行上 20%/20% 比例带判定 before/inside/after（中部 60% 进容器）。
 * 画布（canvas=true）：容器的 before/after 收窄为 ~10px 像素边带（沿分带轴），其余一律
 * 按 inside 解析（独子容器自动下钻，插入位取指针越过的最近子节点之后）——
 * 大容器（Scroll 等）内容不填满盒时，30% 比例带会把「想放进容器」误判成「放到容器外」。
 * 画布 before/after 被约束拒绝时回退按 inside 解析（如 Scroll 内层 Column 的上下沿）。
 * axisSize = 分带轴上的盒尺寸 px（画布调用方按父容器主轴传入，Row 父取宽、其余取高）。
 */
export function computeDrop(root: IRNode, path: Path, ratio: number, box: DOMRect, clientX: number, clientY: number, canvas: boolean, axisSize?: number): DropTarget | null {
  const node = getNodeAtPath(root, path)
  if (!node) return null
  const parentPath = path.slice(0, -1)
  // parentPath=[] 时父级即根节点自身：顶层 before/after = 根内插入，同样要过约束
  const parent = getNodeAtPath(root, parentPath) ?? null
  let pos: DropPos
  if (path.length === 0) pos = 'inside'
  else if (CONTAINERS.has(node.type)) {
    if (!canvas) {
      // 大纲树：before/after 收窄为 20% 边带，中部 60% 一律 inside——
      // 拖「进」容器是树内最高频意图，边带只留给故意的兄弟插入
      pos = ratio < 0.2 ? 'before' : ratio > 0.8 ? 'after' : 'inside'
    } else {
      const size = axisSize ?? box.height ?? 1
      const off = Math.min(Math.max(ratio, 0), 1) * size
      const edge = Math.max(6, Math.min(12, size * 0.1))
      pos = off < edge ? 'before' : off > size - edge ? 'after' : 'inside'
    }
  } else {
    pos = ratio < 0.5 ? 'before' : 'after'
  }

  /** pos → 目标父容器与插入下标（inside：独子下钻 + 画布最近子位置） */
  const resolve = (p: DropPos): { targetPath: Path; container: IRNode | null; index: number } => {
    if (p === 'inside') {
      const d = descendFullSingleChild(node, path)
      let index = d.node.children.length
      // Stack 以 .position 定位，新子节点固定压栈顶；其余容器按指针位置就近插入
      if (canvas && d.node.type !== 'Stack') index = nearestChildIndex(d.node, d.path, clientX, clientY)
      return { targetPath: d.path, container: d.node, index }
    }
    const last = path[path.length - 1]
    return { targetPath: parentPath, container: parent, index: p === 'before' ? last : last + 1 }
  }
  /** 子类型约束 + 独子约束（同父搬运不增加子数，跳过独子检查） */
  const legal = (container: IRNode | null, targetPath: Path): boolean => {
    if (!container) return false
    const childType = draggedType(root)
    if (childType && !acceptsChild(container.type, childType)) return false
    const sameParentMove = ctx?.kind === 'move' && !!ctx.path && samePath(ctx.path.slice(0, -1), targetPath)
    if (!sameParentMove && !canAcceptMore(container)) return false
    return true
  }

  let r = resolve(pos)
  // 画布宽容回退：before/after 被约束拒绝（如 Scroll 内层 Column 的上下沿）时改按 inside
  if (canvas && pos !== 'inside' && !legal(r.container, r.targetPath)) {
    pos = 'inside'
    r = resolve(pos)
  }
  if (!legal(r.container, r.targetPath)) return null
  const targetPath = r.targetPath
  const containerNode = r.container

  // Stack 自由定位：inside 落点记录指针坐标（vp），落下时写入子节点 .position({x,y})
  let at: { x: number; y: number } | undefined
  if (pos === 'inside' && containerNode?.type === 'Stack') {
    // 重定向后目标可能不是原行：取最终目标的屏幕矩形计算坐标
    const tbox = samePath(targetPath, path) ? box : rectOf(targetPath) ?? undefined
    if (tbox) {
      const k = pxPerVp()
      let px = clientX
      let py = clientY
      if (canvas) {
        // 指针吸附到兄弟/容器的边缘与中线（±SNAP_VP），并绘制参考线
        const sibBoxes = containerNode.children
          .map((_, i) => rectOf([...targetPath, i]))
          .filter((r): r is DOMRect => !!r)
        const cand = candidateLines(tbox, sibBoxes)
        const sx = snapVal(clientX, cand.vx, SNAP_PX())
        const sy = snapVal(clientY, cand.hy, SNAP_PX())
        if (sx.line !== undefined || sy.line !== undefined) drawGuides(tbox, sx.line, sy.line)
        px = sx.v
        py = sy.v
      }
      at = { x: Math.round((px - tbox.left) / k), y: Math.round((py - tbox.top) / k) }
    }
  }
  // 落点高亮跟随最终目标：重定向进内层容器时，高亮内层行而非 Scroll 行
  return { path: pos === 'inside' ? targetPath : path, pos, parent: targetPath, index: r.index, at }
}

/**
 * 画布 inside 落点的精确插入位：沿容器主轴（Row 取 x，其余取 y），
 * 插在指针越过的最后一个可见子节点之后。未渲染/隐藏子节点（If 假分支、非当前 Tab）跳过。
 */
function nearestChildIndex(container: IRNode, path: Path, x: number, y: number): number {
  if (typeof document === 'undefined') return container.children.length // SSR/测试环境无 DOM
  const horizontal = container.type === 'Row'
  let idx = 0
  for (let i = 0; i < container.children.length; i++) {
    const r = rectOf([...path, i])
    if (!r || (r.width === 0 && r.height === 0)) continue
    const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2
    if ((horizontal ? x : y) >= mid) idx = i + 1
  }
  return idx
}

function onMove(e: PointerEvent) {
  if (!ctx) return
  // 兜底：错过了 pointerup（窗外松开/系统吞事件等）→ 按钮已弹起却仍在拖拽态，
  // 直接收尾。这是「蓝色落点层卡满屏（蓝屏）」的主要残留路径。
  if (e.buttons === 0) { endDrag(); return }
  try {
    onMoveInner(e)
  } catch (err) {
    // 拖拽中任何异常都必须收尾：否则 ctx/ghost/落点指示残留 = 蓝屏卡死
    console.error('[dnd] onMove', err)
    endDrag()
  }
}

/** 树面板空白区（行间隙/末尾空白/缩进留白）拖入时吸附到最近行——避免「拖到树上却没反应」 */
function nearestTreeRow(x: number, y: number): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const outline = document.querySelector('.outline')
  if (!outline) return null
  const ob = outline.getBoundingClientRect()
  if (x < ob.left || x > ob.right || y < ob.top || y > ob.bottom) return null
  let best: HTMLElement | null = null
  let bestD = Infinity
  for (const row of Array.from(outline.querySelectorAll<HTMLElement>('[data-tree-path]'))) {
    const r = row.getBoundingClientRect()
    if (r.height === 0) continue
    const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
    if (d < bestD) { bestD = d; best = row }
  }
  return best
}

/** 拖拽接近大纲树视口上/下沿时自动滚动（深层容器不用松手换滚轮） */
function autoScrollOutline(row: HTMLElement, y: number) {
  const outline = row.closest('.outline')
  if (!outline) return
  const r = outline.getBoundingClientRect()
  const M = 28
  if (y < r.top + M) outline.scrollTop -= Math.ceil((r.top + M - y) / 4)
  else if (y > r.bottom - M) outline.scrollTop += Math.ceil((y - (r.bottom - M)) / 4)
}

function onMoveInner(e: PointerEvent) {
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
      const parentBox = rectOf(parentPath)
      const parentNode = getNodeAtPath(s.ir.root, parentPath)
      if (parentBox && parentNode) {
        const sibBoxes = parentNode.children
          .map((_, i) => [...parentPath, i])
          .filter(p => !samePath(p, dragPath))
          .map(p => rectOf(p))
          .filter((r): r is DOMRect => !!r)
        const cand = candidateLines(parentBox, sibBoxes)
        const wantL = fo.rect.left + (ox - fo.baseX) * k
        const wantT = fo.rect.top + (oy - fo.baseY) * k
        const sx = snapEdges(wantL, fo.rect.w, cand.vx, SNAP_PX())
        const sy = snapEdges(wantT, fo.rect.h, cand.hy, SNAP_PX())
        if (sx.line !== undefined) ox = Math.round((ox + sx.delta / k) * 10) / 10
        if (sy.line !== undefined) oy = Math.round((oy + sy.delta / k) * 10) / 10
        if (sx.line !== undefined || sy.line !== undefined) drawGuides(parentBox, sx.line, sy.line)
      }
    }
    if (realCanvas()) {
      // 真机托管：设备 applyOffset 按增量热写视觉，本地 IR 暂不落盘（松手一次性提交，
      // 否则防抖 code 推送会与 applyOffset 双驱动、画面抖动）。只发增量 delta。
      if (fo.lastOx !== undefined && fo.lastOy !== undefined) {
        const dx = ox - fo.lastOx
        const dy = oy - fo.lastOy
        fo.lastOx = ox
        fo.lastOy = oy
        sendDragDelta(dx, dy)
      }
      return
    }
    // DOM 画布：实时改写 .offset（每帧 mutate，松手时已是终态）
    s.mutateNode(ctx.path, n2 => setModifier(n2, 'offset', [{ t: 'obj', v: { x: { t: 'num', v: ox }, y: { t: 'num', v: oy } } }]), { history: false })
    return
  }
  const els = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
  // 大纲树落点：行上 20%/20% 分带；未命中行但指针在树面板内时吸附最近行并边缘自动滚动
  let treeRow = els.find(x => typeof x.hasAttribute === 'function' && x.hasAttribute('data-tree-path')) as HTMLElement | undefined
  if (!treeRow) treeRow = nearestTreeRow(e.clientX, e.clientY) ?? undefined
  if (treeRow) {
    autoScrollOutline(treeRow, e.clientY)
    const pathStr = treeRow.getAttribute('data-tree-path') || ''
    const path: Path = pathStr === '' ? [] : pathStr.split('.').map(Number)
    const box = treeRow.getBoundingClientRect()
    const ratio = (e.clientY - box.top) / (box.height || 1)
    s.setDropTarget(computeDrop(s.ir.root, path, ratio, box, e.clientX, e.clientY, false))
    return
  }
  // 画布落点：真机画布走 geo 命中（无 [data-path] DOM），DOM 画布走 elementsFromPoint。
  // 两路都限定画布范围：模板缩略图同样带 data-path/命中区，拖到模板/组件面板上时不能误解析。
  if (realCanvas()) {
    const hit = hitTestGeo(e.clientX, e.clientY)
    if (!hit) { s.setDropTarget(null); return }
    const path = hit.path
    const node = getNodeAtPath(s.ir.root, path)
    if (!node) { s.setDropTarget(null); return }
    const parentPath = path.slice(0, -1)
    const parent = parentPath.length ? getNodeAtPath(s.ir.root, parentPath) : null
    const box = hit.box
    const w = box.width || 1
    const h = box.height || 1
    const rx = (e.clientX - box.left) / w
    const ry = (e.clientY - box.top) / h
    const horizontal = parent?.type === 'Row'
    const ratio = horizontal ? rx : ry
    s.setDropTarget(computeDrop(s.ir.root, path, ratio, box, e.clientX, e.clientY, true, horizontal ? box.width : box.height))
    return
  }
  const el = els.find(x => typeof x.hasAttribute === 'function' && x.hasAttribute('data-path') && x.closest('.phone-screen'))
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
  s.setDropTarget(computeDrop(s.ir.root, path, ratio, box, e.clientX, e.clientY, true, horizontal ? box.width : box.height))
}

function onUp() {
  if (!ctx) { detach(); return }
  try {
    // 真机托管偏移拖拽收尾：拖拽期间只发 delta（设备 applyOffset 热写视觉），
    // 此刻把最终 offset 一次性提交到本地 IR → 防抖推送 → 设备 clean 重渲染对齐；
    // history:false 并入 startMoveDrag 已 push 的快照 = 一步撤销。再发 drag-end 复位设备。
    if (ctx.freeOffset && ctx.path && realCanvas()) {
      const fo = ctx.freeOffset
      const ox = fo.lastOx ?? fo.baseX
      const oy = fo.lastOy ?? fo.baseY
      sendDragEnd()
      useStore.getState().mutateNode(ctx.path, n2 => setModifier(n2, 'offset', [{ t: 'obj', v: { x: { t: 'num', v: ox }, y: { t: 'num', v: oy } } }]), { history: false })
      endDrag()
      return
    }
    performDrop()
  } catch (err) {
    // 落下失败（序列化/约束等异常）也必须收尾，避免拖拽态卡死
    console.error('[dnd] performDrop', err)
    endDrag()
  }
}

function isMoveValid(from: Path, toParent: Path): boolean {
  if (from.length === 0) return false
  if (toParent.length >= from.length && from.every((x, i) => x === toParent[i])) return false
  return true
}

/** 当前拖拽载荷的组件类型（新增=面板类型；搬运=被拖节点类型） */
function draggedType(root: IRNode): string | null {  if (!ctx) return null
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
