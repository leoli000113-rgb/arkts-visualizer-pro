import { useStore } from '../store/store'
import { getModifier, getNodeAtPath, setModifier, Path } from '../ir/mutate'
import { pxPerVp } from '../editor/scale'

interface Drag {
  path: Path
  dim: 'width' | 'height' | 'both'
  startX: number
  startY: number
  startW: number
  startH: number
}

let drag: Drag | null = null

const numArg = (node: ReturnType<typeof getNodeAtPath>, name: string): number | undefined => {
  const m = node ? getModifier(node, name) : undefined
  return m && m.args[0].t === 'num' ? m.args[0].v : undefined
}

export function startResize(path: Path, dim: 'width' | 'height' | 'both', e: React.PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const store = useStore.getState()
  if (!store.ir) return
  const node = getNodeAtPath(store.ir.root, path)
  if (!node) return
  const w = numArg(node, 'width')
  const h = numArg(node, 'height')
  if ((dim === 'width' || dim === 'both') && w == null) return
  if ((dim === 'height' || dim === 'both') && h == null) return
  drag = { path, dim, startX: e.clientX, startY: e.clientY, startW: w ?? 0, startH: h ?? 0 }
  // 整个拖拽手势合并为一步撤销：手势开始压一次历史，move 期间不再压
  store.pushHistory()
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  // 窗外松开/系统取消/失焦兜底收尾，避免拖拽态卡死
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('blur', onUp)
}

const toVp = (start: number, deltaCss: number) =>
  Math.max(0, Math.round((start + deltaCss / pxPerVp()) * 10) / 10)

function onMove(e: PointerEvent) {
  if (!drag) return
  const d = drag
  useStore.getState().mutateNode(d.path, n => {
    let out = n
    if (d.dim === 'width' || d.dim === 'both') {
      out = setModifier(out, 'width', [{ t: 'num', v: toVp(d.startW, e.clientX - d.startX) }])
    }
    if (d.dim === 'height' || d.dim === 'both') {
      out = setModifier(out, 'height', [{ t: 'num', v: toVp(d.startH, e.clientY - d.startY) }])
    }
    return out
  }, { history: false })
}

function onUp() {
  drag = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  window.removeEventListener('blur', onUp)
}

