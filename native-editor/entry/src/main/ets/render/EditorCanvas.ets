/**
 * 编辑器画布：NodeContainer + NodeController 挂载 typeNode 动态树。
 * setTree() 触发 rebuild → makeNode 内重建整棵 FrameNode 树（旧树 disposeTree 释放）。
 * registry 记录 路径→FrameNode，供选中框几何查询；点选经 onTapNode 回调上抛。
 */

import { FrameNode, NodeController } from '@kit.ArkUI'
import { IRNode } from '../core/ir'
import { V } from '../core/exprEval'
import { buildFrame, errorFrame, RenderHooks } from './DynamicRenderer'

export interface RectInfo {
  x: number
  y: number
  w: number
  h: number
}

export class PreviewController extends NodeController {
  private ir: IRNode | null = null
  private scope: Map<string, V> | null = null
  private root: FrameNode | null = null
  private uiContext: UIContext | null = null
  readonly registry: Map<string, FrameNode> = new Map()
  readonly offsetAppliers: Map<string, (x: number, y: number) => void> = new Map()
  onTapNode: (path: string) => void = (p) => {}

  setTree(ir: IRNode | null, scope: Map<string, V> | null = null): void {
    this.ir = ir
    this.scope = scope
    this.rebuild()
  }

  makeNode(uiContext: UIContext): FrameNode | null {
    this.uiContext = uiContext
    if (this.root !== null) {
      this.root.disposeTree()
      this.root = null
    }
    this.registry.clear()
    this.offsetAppliers.clear()
    if (this.ir === null) return null
    const hooks: RenderHooks = {
      onTap: (p) => this.onTapNode(p),
      registry: this.registry,
      offsetAppliers: this.offsetAppliers,
    }
    // 根级兜底：任何渲染异常都落成错误块，画布永不白屏
    try {
      this.root = buildFrame(uiContext, this.ir, hooks, '', this.scope)
    } catch (e) {
      this.root = errorFrame(uiContext, e)
    }
    return this.root
  }

  /**
   * 选中节点的窗口坐标矩形（vp，含尺寸）；未挂载或路径失效返回 null。
   * 单位/语义坑（d.ts 明确 + 真机实测）：
   * - getMeasuredSize 返回 **px**，必须 px2vp，否则高密度设备上选中框大出 density 倍；
   * - getPositionToWindow 是布局位置，**不含 offset/translate**（绘制期位移），
   *   带 offset 的组件蓝框会停在原位——必须用 getPositionToWindowWithTransform。
   */
  queryRect(path: string): RectInfo | null {
    const n = this.registry.get(path)
    if (n === undefined || !n.isAttached()) return null
    const pos = n.getPositionToWindowWithTransform()
    const size = n.getMeasuredSize()
    const w = this.uiContext !== null ? this.uiContext.px2vp(size.width) : size.width
    const h = this.uiContext !== null ? this.uiContext.px2vp(size.height) : size.height
    return { x: pos.x, y: pos.y, w: w, h: h }
  }

  /** 拖拽中直接改写活节点 offset（不重建树）；节点已失效返回 false */
  applyOffset(path: string, x: number, y: number): boolean {
    const f = this.offsetAppliers.get(path)
    if (f === undefined) return false
    f(x, y)
    return true
  }

  disposeTree(): void {
    if (this.root !== null) {
      this.root.disposeTree()
      this.root = null
    }
    this.registry.clear()
    this.offsetAppliers.clear()
  }
}

@Component
export struct EditorCanvas {
  controller: PreviewController = new PreviewController()

  build() {
    NodeContainer(this.controller)
      .width('100%')
      .height('100%')
      .backgroundColor('#ffffff')
      .clip(true)
  }
}
