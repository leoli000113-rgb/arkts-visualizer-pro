import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parse } from '../parser/parser'
import { serialize } from '../ir/serialize'
import { IRFile, IRNode } from '../ir/types'
import { Path, updateNodeAtPath, removeNodeAtPath, insertChildAtPath, getNodeAtPath, samePath } from '../ir/mutate'
import { acceptsChild, canAcceptMore } from '../ir/constraints'
import { extractStyles, StyleTables } from '../renderer/styleTable'
import { extractComponents, buildersOf, BuilderDef } from '../renderer/components'
import sampleSrc from '../assets/sample.ets?raw'
import type { DropTarget } from '../editor/dnd'

const HISTORY_CAP = 50

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
  /** 节点剪贴簿（Ctrl+C/X/V，深拷贝 IRNode，不持久化） */
  clipboard: IRNode | null
  copyNode: (path: Path) => void
  cutNode: (path: Path) => void
  pasteNode: () => void
  /** @Styles/@Extend 定义表（随 setCode 派生；UI 编辑不动 members，无需随 mutate 重算） */
  stylesTable: StyleTables
  /** 同文件自定义组件表（随 setCode 从 postamble 派生） */
  components: Record<string, IRFile>
  /** @Builder 定义表（随 setCode 派生，带参调用点只读替换渲染用） */
  builders: Record<string, BuilderDef>
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
        clipboard: null,
        stylesTable: { styles: {}, extends: {} },
        components: {},
        builders: {},
        copyNode: (path) => {
          const s = get()
          if (!s.ir) return
          const node = getNodeAtPath(s.ir.root, path)
          if (node) set({ clipboard: JSON.parse(JSON.stringify(node)) })
        },
        cutNode: (path) => {
          if (path.length === 0) return
          get().copyNode(path)
          get().removeNode(path)
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
          try {
            const ir = parse(c)
            // 代码源变更（导入/手改/重置）视为新历史起点，清空两栈；
            // keepHistory（模板套用）则把当前页压入历史，可 Ctrl+Z 撤回
            const cur = get().ir
            const keep = !!opts?.keepHistory && !!cur
            set({
              code: c, ir, error: null, selectedPath: null, dropTarget: null,
              stylesTable: extractStyles(ir),
              components: extractComponents(ir),
              builders: buildersOf(ir),
              past: keep ? [...get().past, cur!].slice(-HISTORY_CAP) : [],
              future: [],
            })
          } catch (e: any) {
            // 解析失败保留最后一次成功的 IR：画布不闪白，错误由代码窗横幅展示原因
            set({ code: c, error: String(e?.message || e), selectedPath: null, dropTarget: null, past: [], future: [] })
          }
        },
        setDevice: (m) => set({ deviceModel: m }),
        setFold: (f) => set({ fold: f }),
        setSelected: (p) => set({ selectedPath: p }),
        setDropTarget: (d) => {
          const cur = get().dropTarget
          if (cur && d && samePath(cur.path, d.path) && cur.pos === d.pos &&
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
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: null })
        },
        insertChild: (parent, child, index) => {
          const s = get()
          if (!s.ir) return
          const parentNode = getNodeAtPath(s.ir.root, parent)
          const oldLen = parentNode ? parentNode.children.length : 0
          const root = insertChildAtPath(s.ir.root, parent, child, index)
          const ir = { ...s.ir, root }
          const at = Math.max(0, Math.min(index, oldLen))
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: [...parent, at], dropTarget: null })
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
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: [...toParent, at], dropTarget: null })
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
          set({ ...pushPast(), ir, code: serialize(ir), selectedPath: [...parentPath, to] })
        },
        wrapNode: (path, containerType) => {
          const s = get()
          if (!s.ir) return
          const node = getNodeAtPath(s.ir.root, path)
          if (!node) return
          const wrapper: IRNode = { type: containerType, ctorArgs: [], children: [node], modifiers: [] }
          const root = updateNodeAtPath(s.ir.root, path, () => wrapper)
          const ir = { ...s.ir, root }
          set({ ...pushPast(), ir, code: serialize(ir) })
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
          })
        },
        bumpDeviceVersion: () => set({ deviceVersion: get().deviceVersion + 1 }),
        resetToSample: () => get().setCode(sampleSrc),
      }
    },
    {
      name: 'arkts-viz-v1',
      // 只持久化 code/deviceModel/fold/zoom：undo 栈、选中态、剪贴簿等均不落盘
      partialize: (s) => ({ code: s.code, deviceModel: s.deviceModel, fold: s.fold, showAids: s.showAids, zoom: s.zoom }),
    },
  ),
)

export function initStore() {
  useStore.getState().setCode(useStore.getState().code)
}
