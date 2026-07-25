import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parse } from '../parser/parser'
import { serialize } from '../ir/serialize'
import { IRFile, IRNode } from '../ir/types'
import { Path, updateNodeAtPath, removeNodeAtPath, insertChildAtPath, getNodeAtPath, samePath } from '../ir/mutate'
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
  /** 辅助标记：是否在画布上显示 ƒ/if/ForEach 角标与 builder 标签（默认关，页面即所得） */
  showAids: boolean
  setShowAids: (v: boolean) => void
  setCode: (c: string) => void
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
        setCode: (c) => {
          try {
            const ir = parse(c)
            // 代码源变更（导入/手改/重置）视为新历史起点，清空两栈
            set({ code: c, ir, error: null, selectedPath: null, dropTarget: null, past: [], future: [] })
          } catch (e: any) {
            set({ code: c, ir: null, error: String(e?.message || e), selectedPath: null, dropTarget: null, past: [], future: [] })
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
      // 只持久化 code/deviceModel/fold：undo 栈、选中态等均不落盘
      partialize: (s) => ({ code: s.code, deviceModel: s.deviceModel, fold: s.fold, showAids: s.showAids }),
    },
  ),
)

export function initStore() {
  useStore.getState().setCode(useStore.getState().code)
}
