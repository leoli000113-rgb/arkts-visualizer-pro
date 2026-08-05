import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { parse } from '../parser/parser'
import { serialize } from '../ir/serialize'
import { IRFile, IRNode } from '../ir/types'
import { Path, updateNodeAtPath, removeNodeAtPath, insertChildAtPath, getNodeAtPath, samePath, getModifier, setModifier } from '../ir/mutate'
import { acceptsChild, canAcceptMore, descendFullSingleChild } from '../ir/constraints'
import { CONTAINER_TYPES } from '../registry'
import { extractStyles, StyleTables } from '../renderer/styleTable'
import { buildersOf, BuilderDef } from '../renderer/components'
import { extractMethodRoutes, RouteAction } from '../renderer/shared'
import { buildComponents, pickStartFile, routeTarget } from '../project/project'
import sampleSrc from '../assets/sample.ets?raw'
import type { DropTarget } from '../editor/dnd'

const HISTORY_CAP = 50

/** 可停靠面板与停靠边：面板可停靠到左/右/底三边，主尺寸可拖拽调整（顶部停靠已下线） */
export type DockSide = 'left' | 'right' | 'bottom'
export type PanelId = 'nav' | 'props' | 'code'

const DEFAULT_DOCKS: Record<PanelId, DockSide> = { nav: 'left', props: 'right', code: 'right' }
/** 停靠区尺寸 px：左/右 = 区宽，下 = 区高 */
const DEFAULT_ZONE: Record<DockSide, number> = { left: 240, right: 460, bottom: 260 }
/** 面板主尺寸 px：停靠左/右时 = 面板高度，停靠下时 = 面板宽度；0 = 与同窗面板 flex 均分 */
const DEFAULT_PANEL_SIZE: Record<PanelId, number> = { nav: 0, props: 0, code: 0 }
/** 大纲树条默认宽度 px：独立固定条，贴着左停靠区右侧（不参与四边停靠） */
const DEFAULT_OUTLINE_WIDTH = 260

/** localStorage 安全包装：媒体 dataURL 撑爆配额时静默失败（内存态不受影响，刷新后重导即可） */
const safeStorage = {
  getItem: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* 配额满：放弃落盘 */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

interface StoreState {
  code: string
  ir: IRFile | null
  error: string | null
  deviceModel: string
  fold: 'unfolded' | 'folded'
  selectedPath: Path | null
  dropTarget: DropTarget | null
  /** 撤销/重做快照栈（仅存 IRFile，不持久化） */
  past: IRFile[]
  future: IRFile[]
  /** 设备档案变更计数：saveDeviceOverride/resetDeviceOverrides 后 +1 触发重渲 */
  deviceVersion: number
  /** 画布缩放倍率（0.2–2，持久化）；渲染内部仍以 1vp = 0.6 CSS px 为基准，缩放靠 CSS transform */
  zoom: number
  setZoom: (z: number) => void
  /** 画布实际生效缩放（= fitMode 时自适应值，否则 = zoom）：由 App 计算后同步，
   *  拖拽/调尺寸的 px↔vp 换算必须用它，否则自适应模式下位移与显示不成比例（不持久化） */
  effZoom: number
  setEffZoom: (z: number) => void
  /** 节点剪贴簿（Ctrl+C/X/V，深拷贝 IRNode，不持久化） */
  clipboard: IRNode | null
  copyNode: (path: Path) => void
  cutNode: (path: Path) => void
  pasteNode: () => void
  /** 粘贴模式：复制/剪切后开启，点击容器放入内部、点击组件放到其后（可连续多处），Esc 退出（不持久化） */
  pasteArmed: boolean
  setPasteArmed: (v: boolean) => void
  /** 粘贴模式点击落地：容器放入内部末尾（独子已满自动下钻内层），其余放到该节点之后 */
  pasteAt: (target: Path) => void
  /** 画布「位置调整」模式目标节点：右键菜单开启后，画布拖拽它只改 .offset 不动结构（不持久化） */
  nudgePath: Path | null
  setNudge: (p: Path | null) => void
  /** 位置调整模式下方向键微调：按当前 .offset 增减（vp），连按合并为一步撤销 */
  nudgeBy: (dx: number, dy: number) => void
  /** @Styles/@Extend 定义表（随 setCode 派生；UI 编辑不动 members，无需随 mutate 重算） */
  stylesTable: StyleTables
  /** 同文件自定义组件表（随 setCode 从 postamble 派生） */
  components: Record<string, IRFile>
  /** @Builder 定义表（随 setCode 派生，带参调用点只读替换渲染用） */
  builders: Record<string, BuilderDef>
  /** 项目模式：整项目导入后的文件表（path → 源码）；空表 = 单文件模式 */
  files: Record<string, string>
  /** 当前编辑/预览的文件（files 表键）；null = 单文件模式 */
  currentFile: string | null
  /** 导入的媒体资源（文件名去扩展名 → dataURL），$r('app.media.x')/路径引用按此键解析 */
  media: Record<string, string>
  /** 项目 resources element 资源表（color.json / string.json） */
  resColors: Record<string, string>
  resStrings: Record<string, string>
  /** 交互预览导航栈（页面历史，router.back 回退用） */
  navStack: string[]
  /** 交互预览模式：点击命中 router 导航的组件执行页面跳转而非选中 */
  interactive: boolean
  /** 自适应窗口：画布缩放自动适配可用空间（手动缩放时自动关闭） */
  fitMode: boolean
  /** 系统栏：画布显示手机状态栏与底部导航条，应用区避开安全区（默认开，持久化） */
  systemBars: boolean
  setSystemBars: (v: boolean) => void
  /** 面板停靠边（面板首部右键切换） */
  layoutDocks: Record<PanelId, DockSide>
  /** 面板主尺寸 px：左/右停靠 = 高度，底停靠 = 宽度；0 = flex 均分 */
  panelSize: Record<PanelId, number>
  /** 停靠区尺寸 px：左/右 = 区宽，下 = 区高（区缘把手拖拽） */
  zoneSize: Record<DockSide, number>
  /** 大纲树条宽度 px（固定全高条，贴着左停靠区右侧，持久化） */
  outlineWidth: number
  setOutlineWidth: (px: number) => void
  /** 大纲树条收合状态：true = 收成窄条（首部 « 按钮切换，默认 false 展开，持久化） */
  outlineCollapsed: boolean
  setOutlineCollapsed: (v: boolean) => void
  setPanelDock: (p: PanelId, d: DockSide) => void
  setPanelSize: (p: PanelId, px: number) => void
  setZoneSize: (d: DockSide, px: number) => void
  resetLayout: () => void
  /** 面板首部右键菜单（选停靠边）；null = 关闭 */
  dockMenu: { x: number; y: number; panel: PanelId } | null
  openDockMenu: (x: number, y: number, panel: PanelId) => void
  closeDockMenu: () => void
  /** 当前文件方法名 → router 动作表（随 setCode 派生，onClick 间接导航解析用） */
  methodRoutes: Record<string, RouteAction>
  setInteractive: (v: boolean) => void
  setFitMode: (v: boolean) => void
  /** 整项目导入：替换全部文件/媒体/资源表并跳到起始页 */
  importProject: (files: Record<string, string>, media: Record<string, string>, colors: Record<string, string>, strings: Record<string, string>) => void
  /** 追加导入媒体（合并进媒体表） */
  importMedia: (entries: Record<string, string>) => void
  removeMedia: (name: string) => void
  /** 切换当前文件：先把当前 code 写回 files 再载入目标（撤销历史清空） */
  setCurrentFile: (path: string, opts?: { push?: boolean }) => void
  /** 交互预览导航：router.pushUrl(url) → 解析目标文件并压栈切换 */
  navigateTo: (url: string) => void
  /** 交互预览导航：router.back() → 弹出栈顶回退 */
  navigateBack: () => void
  /** 单文件导入：退出项目模式（清空文件/媒体/资源/导航栈）并载入该文件 */
  loadSingleFile: (code: string) => void
  /** 辅助标记：是否在画布上显示 ƒ/if/ForEach 角标与 builder 标签（默认关，页面即所得） */
  showAids: boolean
  setShowAids: (v: boolean) => void
  setCode: (c: string, opts?: { keepHistory?: boolean }) => void
  setDevice: (m: string) => void
  setFold: (f: 'unfolded' | 'folded') => void
  setSelected: (p: Path | null) => void
  setDropTarget: (d: DropTarget | null) => void
  mutateNode: (path: Path, fn: (n: IRNode) => IRNode, opts?: { history?: boolean }) => void
  /** 连续手势（如拖拽改尺寸）开始时压入一次历史，手势内的 mutateNode 传 history:false 合并为一步撤销 */
  pushHistory: () => void
  removeNode: (path: Path) => void
  insertChild: (parent: Path, child: IRNode, index: number) => void
  moveNode: (from: Path, toParent: Path, index: number) => void
  /** 右键菜单：null = 关闭；否则为打开位置与目标节点 */
  contextMenu: { x: number; y: number; path: Path } | null
  openContextMenu: (x: number, y: number, path: Path) => void
  closeContextMenu: () => void
  /** 在自身之后创建该节点的深拷贝副本 */
  duplicateNode: (path: Path) => void
  /** 同级间上移/下移一位 */
  moveSibling: (path: Path, dir: -1 | 1) => void
  /** 用指定容器（Row/Column/Stack）包裹该节点 */
  wrapNode: (path: Path, containerType: string) => void
  undo: () => void
  redo: () => void
  bumpDeviceVersion: () => void
  resetToSample: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      /** 结构变更前压入当前 IR 快照并清空 future（cap 50 步） */
      const pushPast = (): Pick<StoreState, 'past' | 'future'> => {
        const s = get()
        return { past: s.ir ? [...s.past, s.ir].slice(-HISTORY_CAP) : s.past, future: [] }
      }
      /** 方向键微调的去抖时间戳（nudgeBy 用，800ms 内连按合并撤销） */
      let lastArrowNudge = 0
      return {
        code: sampleSrc,
        ir: null,
        error: null,
        deviceModel: 'Mate 80 Pro Max',
        fold: 'unfolded',
        selectedPath: null,
        dropTarget: null,
        past: [],
        future: [],
        deviceVersion: 0,
        showAids: false,
        setShowAids: (v) => set({ showAids: v }),
        zoom: 1,
        setZoom: (z) => set({ zoom: Math.min(2, Math.max(0.2, Math.round(z * 100) / 100)) }),
        effZoom: 1,
        setEffZoom: (z) => { if (z > 0 && get().effZoom !== z) set({ effZoom: z }) },
        clipboard: null,
        pasteArmed: false,
        setPasteArmed: (v) => set({ pasteArmed: v }),
        nudgePath: null,
        setNudge: (p) => set({ nudgePath: p }),
        nudgeBy: (dx, dy) => {
          const s = get()
          if (!s.ir || !s.nudgePath) return
          const node = getNodeAtPath(s.ir.root, s.nudgePath)
          if (!node) return
          const off = getModifier(node, 'offset')?.args[0]
          const obj = off && off.t === 'obj' ? off.v : undefined
          const bx = obj?.x && obj.x.t === 'num' ? obj.x.v : 0
          const by = obj?.y && obj.y.t === 'num' ? obj.y.v : 0
          // 连按（<800ms）合并为一步撤销，避免方向键微调刷爆撤销栈
          const now = Date.now()
          const history = now - lastArrowNudge > 800
          lastArrowNudge = now
          s.mutateNode(s.nudgePath, n => setModifier(n, 'offset', [{ t: 'obj', v: { x: { t: 'num', v: bx + dx }, y: { t: 'num', v: by + dy } } }]), { history })
        },
        stylesTable: { styles: {}, extends: {} },
        components: {},
        builders: {},
        files: {},
        currentFile: null,
        media: {},
        resColors: {},
        resStrings: {},
        navStack: [],
        interactive: false,
        fitMode: true,
        systemBars: true,
        setSystemBars: (v) => set({ systemBars: v }),
        layoutDocks: { ...DEFAULT_DOCKS },
        panelSize: { ...DEFAULT_PANEL_SIZE },
        zoneSize: { ...DEFAULT_ZONE },
        outlineWidth: DEFAULT_OUTLINE_WIDTH,
        setOutlineWidth: (px) => set({ outlineWidth: Math.round(Math.min(560, Math.max(160, px))) }),
        outlineCollapsed: false,
        setOutlineCollapsed: (v) => set({ outlineCollapsed: v }),
        setPanelDock: (p, d) => set({ layoutDocks: { ...get().layoutDocks, [p]: d } }),
        setPanelSize: (p, px) => set({ panelSize: { ...get().panelSize, [p]: Math.round(px) } }),
        setZoneSize: (d, px) => set({ zoneSize: { ...get().zoneSize, [d]: Math.round(px) } }),
        resetLayout: () => set({
          layoutDocks: { ...DEFAULT_DOCKS },
          panelSize: { ...DEFAULT_PANEL_SIZE },
          zoneSize: { ...DEFAULT_ZONE },
        }),
        dockMenu: null,
        openDockMenu: (x, y, panel) => set({ dockMenu: { x, y, panel } }),
        closeDockMenu: () => set({ dockMenu: null }),
        methodRoutes: {},
        setInteractive: (v) => set({ interactive: v }),
        setFitMode: (v) => set({ fitMode: v }),
        importProject: (files, media, colors, strings) => {
          const start = pickStartFile(files)
          set({
            files, media, resColors: colors, resStrings: strings,
            currentFile: start, navStack: [], selectedPath: null, dropTarget: null,
            past: [], future: [], clipboard: null,
          })
          if (start) get().setCode(files[start])
        },
        importMedia: (entries) => set({ media: { ...get().media, ...entries } }),
        removeMedia: (name) => {
          const m = { ...get().media }
          delete m[name]
          set({ media: m })
        },
        setCurrentFile: (path, opts) => {
          const s = get()
          if (!s.files[path]) return
          // 写回当前页（结构编辑/手改的最新 code 在 code 字段，files 里的可能是旧拷贝）
          const files = s.currentFile ? { ...s.files, [s.currentFile]: s.code } : s.files
          const navStack = opts?.push && s.currentFile ? [...s.navStack, s.currentFile].slice(-20) : s.navStack
          set({ files, currentFile: path, navStack })
          get().setCode(files[path])
        },
        navigateTo: (url) => {
          const s = get()
          const target = routeTarget(url, s.files)
          if (!target || target === s.currentFile) return
          s.setCurrentFile(target, { push: true })
        },
        navigateBack: () => {
          const s = get()
          if (!s.navStack.length) return
          const prev = s.navStack[s.navStack.length - 1]
          set({ navStack: s.navStack.slice(0, -1) })
          get().setCurrentFile(prev)
        },
        loadSingleFile: (code) => {
          set({ files: {}, currentFile: null, media: {}, resColors: {}, resStrings: {}, navStack: [], methodRoutes: {} })
          get().setCode(code)
        },
        copyNode: (path) => {
          const s = get()
          if (!s.ir) return
          const node = getNodeAtPath(s.ir.root, path)
          // 复制即进入粘贴模式：之后点击容器/组件即可粘贴，可连续多处
          if (node) set({ clipboard: JSON.parse(JSON.stringify(node)), pasteArmed: true })
        },
        cutNode: (path) => {
          if (path.length === 0) return
          get().copyNode(path)
          get().removeNode(path)
        },
        pasteAt: (target) => {
          const s = get()
          if (!s.ir || !s.clipboard) return
          const clip: IRNode = JSON.parse(JSON.stringify(s.clipboard))
          const node = getNodeAtPath(s.ir.root, target)
          if (!node) return
          // 容器：放入内部末尾（独子已满自动下钻内层容器）
          if (CONTAINER_TYPES.has(node.type)) {
            const d = descendFullSingleChild(node, target)
            if (acceptsChild(d.node.type, clip.type) && canAcceptMore(d.node)) {
              s.insertChild(d.path, clip, d.node.children.length)
              return
            }
          }
          // 叶子（或容器不接收）：放到该节点之后
          if (target.length === 0) {
            if (acceptsChild(s.ir.root.type, clip.type) && canAcceptMore(s.ir.root)) {
              s.insertChild([], clip, s.ir.root.children.length)
            }
            return
          }
          const pp = target.slice(0, -1)
          const pnode = getNodeAtPath(s.ir.root, pp)
          if (pnode && acceptsChild(pnode.type, clip.type) && canAcceptMore(pnode)) {
            s.insertChild(pp, clip, target[target.length - 1] + 1)
          }
        },
        pasteNode: () => {
          const s = get()
          if (!s.ir || !s.clipboard) return
          const clip: IRNode = JSON.parse(JSON.stringify(s.clipboard))
          const sel = s.selectedPath
          const selNode = sel ? getNodeAtPath(s.ir.root, sel) : undefined
          let parent: Path = []
          let index = s.ir.root.children.length
          if (selNode && acceptsChild(selNode.type, clip.type) && canAcceptMore(selNode)) {
            // 选中容器可接收（含根容器）→ 放入其末尾
            parent = sel!
            index = selNode.children.length
          } else if (sel && sel.length > 0) {
            // 否则尝试插入到选中节点之后
            const pp = sel.slice(0, -1)
            const pnode = getNodeAtPath(s.ir.root, pp)
            if (!pnode || !acceptsChild(pnode.type, clip.type) || !canAcceptMore(pnode)) return
            parent = pp
            index = sel[sel.length - 1] + 1
          } else if (selNode) {
            return // 根被选中但不能接收该类型
          } else if (!acceptsChild(s.ir.root.type, clip.type) || !canAcceptMore(s.ir.root)) {
            return // 无选中：放入根末尾，需满足子类型/独子约束
          }
          s.insertChild(parent, clip, index)
        },
        setCode: (c, opts) => {
          // 项目模式下把最新 code 写回 files 表（切换页面/持久化都以 files 为准）
          const cf = get().currentFile
          const files = cf ? { ...get().files, [cf]: c } : get().files
          try {
            const ir = parse(c)
            // 代码源变更（导入/手改/重置）视为新历史起点，清空两栈；
            // keepHistory（模板套用）则把当前页压入历史，可 Ctrl+Z 撤回
            const cur = get().ir
            const keep = !!opts?.keepHistory && !!cur
            set({
              code: c, ir, error: null, selectedPath: null, dropTarget: null, nudgePath: null, pasteArmed: false,
              files,
              stylesTable: extractStyles(ir),
              // 同文件组件 + import 解析到的跨文件组件（解析缓存保证编辑当前页时不重解整个工程）
              components: buildComponents(cf ?? '', ir, files),
              builders: buildersOf(ir),
              methodRoutes: extractMethodRoutes(ir),
              past: keep ? [...get().past, cur!].slice(-HISTORY_CAP) : [],
              future: [],
            })
          } catch (e: any) {
            // 解析失败保留最后一次成功的 IR：画布不闪白，错误由代码窗横幅展示原因
            set({ code: c, error: String(e?.message || e), selectedPath: null, dropTarget: null, nudgePath: null, pasteArmed: false, past: [], future: [], files, methodRoutes: {} })
          }
        },
        setDevice: (m) => set({ deviceModel: m }),
        setFold: (f) => set({ fold: f }),
        setSelected: (p) => set({ selectedPath: p }),
        setDropTarget: (d) => {
          const cur = get().dropTarget
          // 注意必须比对 index：画布「最近子位置」插入会让同一 path+pos 的 index 随指针变化
          if (cur && d && samePath(cur.path, d.path) && cur.pos === d.pos && cur.index === d.index &&
            cur.at?.x === d.at?.x && cur.at?.y === d.at?.y) return
          set({ dropTarget: d })
        },
        mutateNode: (path, fn, opts) => {
          const s = get()
          if (!s.ir) return
          const root = updateNodeAtPath(s.ir.root, path, fn)
          const ir = { ...s.ir, root }
          set({ ...(opts?.history === false ? {} : pushPast()), ir, code: serialize(ir) })
        },
        pushHistory: () => set(pushPast()),
        removeNode: (path) => {
          const s = get()
          if (!s.ir) return
          const root = removeNodeAtPath(s.ir.root, path)
          const ir = { ...s.ir, root }
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: null, nudgePath: null })
        },
        insertChild: (parent, child, index) => {
          const s = get()
          if (!s.ir) return
          const parentNode = getNodeAtPath(s.ir.root, parent)
          const oldLen = parentNode ? parentNode.children.length : 0
          const root = insertChildAtPath(s.ir.root, parent, child, index)
          const ir = { ...s.ir, root }
          const at = Math.max(0, Math.min(index, oldLen))
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: [...parent, at], dropTarget: null, nudgePath: null })
        },
        moveNode: (from, toParent, index) => {
          const s = get()
          if (!s.ir) return
          const node = getNodeAtPath(s.ir.root, from)
          if (!node) return
          const removed = removeNodeAtPath(s.ir.root, from)
          let idx = index
          const fromParent = from.slice(0, -1)
          const fromIdx = from[from.length - 1]
          if (samePath(fromParent, toParent) && fromIdx < idx) idx--
          const toParentNode = getNodeAtPath(removed, toParent)
          const oldLen = toParentNode ? toParentNode.children.length : 0
          const root = insertChildAtPath(removed, toParent, node, idx)
          const ir = { ...s.ir, root }
          const at = Math.max(0, Math.min(idx, oldLen))
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: [...toParent, at], dropTarget: null, nudgePath: null })
        },
        contextMenu: null,
        openContextMenu: (x, y, path) => set({ contextMenu: { x, y, path } }),
        closeContextMenu: () => set({ contextMenu: null }),
        duplicateNode: (path) => {
          const s = get()
          if (!s.ir || path.length === 0) return
          const node = getNodeAtPath(s.ir.root, path)
          if (!node) return
          const clone: IRNode = JSON.parse(JSON.stringify(node))
          get().insertChild(path.slice(0, -1), clone, path[path.length - 1] + 1)
        },
        moveSibling: (path, dir) => {
          const s = get()
          if (!s.ir || path.length === 0) return
          const parentPath = path.slice(0, -1)
          const idx = path[path.length - 1]
          const parent = getNodeAtPath(s.ir.root, parentPath)
          if (!parent) return
          const to = idx + dir
          if (to < 0 || to >= parent.children.length) return
          const root = updateNodeAtPath(s.ir.root, parentPath, p => {
            const children = p.children.slice()
            ;[children[idx], children[to]] = [children[to], children[idx]]
            return { ...p, children }
          })
          const ir = { ...s.ir, root }
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: [...parentPath, to], nudgePath: null })
        },
        wrapNode: (path, containerType) => {
          const s = get()
          if (!s.ir) return
          const node = getNodeAtPath(s.ir.root, path)
          if (!node) return
          const wrapper: IRNode = { type: containerType, ctorArgs: [], children: [node], modifiers: [] }
          const root = updateNodeAtPath(s.ir.root, path, () => wrapper)
          const ir = { ...s.ir, root }
          set({ ...pushPast(), ir, code: serialize(ir), nudgePath: null })
        },
        undo: () => {
          const s = get()
          if (!s.ir || s.past.length === 0) return
          const prev = s.past[s.past.length - 1]
          set({
            past: s.past.slice(0, -1),
            future: [s.ir, ...s.future].slice(0, HISTORY_CAP),
            ir: prev,
            code: serialize(prev),
            selectedPath: null,
            dropTarget: null,
            nudgePath: null,
            pasteArmed: false,
          })
        },
        redo: () => {
          const s = get()
          if (!s.ir || s.future.length === 0) return
          const next = s.future[0]
          set({
            future: s.future.slice(1),
            past: [...s.past, s.ir].slice(-HISTORY_CAP),
            ir: next,
            code: serialize(next),
            selectedPath: null,
            dropTarget: null,
            nudgePath: null,
            pasteArmed: false,
          })
        },
        bumpDeviceVersion: () => set({ deviceVersion: get().deviceVersion + 1 }),
        resetToSample: () => {
          // 退出项目模式：清空文件/媒体/资源/导航栈，回到内置单文件样例
          set({ files: {}, currentFile: null, media: {}, resColors: {}, resStrings: {}, navStack: [], methodRoutes: {} })
          get().setCode(sampleSrc)
        },
      }
    },
    {
      name: 'arkts-viz-v1',
      storage: createJSONStorage(() => safeStorage),
      // v2：大纲树移出停靠系统（改为贴左区右侧的固定全高条），顶部停靠下线。
      // 规范化持久化布局：三面板仅允许 left/right/bottom（top 等非法值回默认），
      // 丢弃 outline 面板键与 top 区尺寸；用户自定义过的合法布局保持不变。
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as {
          layoutDocks?: Record<string, string>
          panelSize?: Record<string, number>
          zoneSize?: Record<string, number>
        }
        if (version < 2 && s) {
          const def: Record<PanelId, DockSide> = { nav: 'left', props: 'right', code: 'right' }
          const docks = s.layoutDocks ?? {}
          const norm = {} as Record<PanelId, DockSide>
          for (const p of ['nav', 'props', 'code'] as PanelId[]) {
            const d = docks[p]
            norm[p] = d === 'left' || d === 'right' || d === 'bottom' ? d : def[p]
          }
          s.layoutDocks = norm
          if (s.panelSize) {
            const ps = s.panelSize
            s.panelSize = { nav: ps.nav ?? 0, props: ps.props ?? 0, code: ps.code ?? 0 }
          }
          if (s.zoneSize) {
            const zs = s.zoneSize
            s.zoneSize = { left: zs.left ?? 240, right: zs.right ?? 460, bottom: zs.bottom ?? 260 }
          }
        }
        return persisted as never
      },
      // 持久化 code/设备/项目文件与媒体资源：undo 栈、选中态、剪贴簿等均不落盘
      partialize: (s) => ({
        code: s.code, deviceModel: s.deviceModel, fold: s.fold, showAids: s.showAids, zoom: s.zoom,
        files: s.files, currentFile: s.currentFile, media: s.media,
        resColors: s.resColors, resStrings: s.resStrings,
        navStack: s.navStack, interactive: s.interactive, fitMode: s.fitMode,
        systemBars: s.systemBars,
        layoutDocks: s.layoutDocks, panelSize: s.panelSize, zoneSize: s.zoneSize,
        outlineWidth: s.outlineWidth, outlineCollapsed: s.outlineCollapsed,
      }),
    },
  ),
)

export function initStore() {
  useStore.getState().setCode(useStore.getState().code)
}
