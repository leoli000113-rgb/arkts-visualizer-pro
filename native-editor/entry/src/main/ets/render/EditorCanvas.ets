/**
 * 编辑器画布：NodeContainer + NodeController 挂载 typeNode 动态树。
 * setTree() 触发 rebuild → makeNode 内重建整棵 FrameNode 树（旧树 disposeTree 释放）。
 * registry 记录 路径→FrameNode，供选中框几何查询；点选经 onTapNode 回调上抛。
 */

import { FrameNode, NodeController } from '@kit.ArkUI'
import { IRNode } from '../core/ir'
import { V } from '../core/exprEval'
import { buildFrame, RenderHooks } from './DynamicRenderer'

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
  readonly registry: Map<string, FrameNode> = new Map()
  onTapNode: (path: string) => void = (p) => {}

  setTree(ir: IRNode | null, scope: Map<string, V> | null = null): void {
    this.ir = ir
    this.scope = scope
    this.rebuild()
  }

  makeNode(uiContext: UIContext): FrameNode | null {
    if (this.root !== null) {
      this.root.disposeTree()
      this.root = null
    }
    this.registry.clear()
    if (this.ir === null) return null
    const hooks: RenderHooks = { onTap: (p) => this.onTapNode(p), registry: this.registry }
    this.root = buildFrame(uiContext, this.ir, hooks, '', this.scope)
    return this.root
  }

  /** 选中节点的窗口坐标矩形（含尺寸）；未挂载或路径失效返回 null */
  queryRect(path: string): RectInfo | null {
    const n = this.registry.get(path)
    if (n === undefined || !n.isAttached()) return null
    const pos = n.getPositionToWindow()
    const size = n.getMeasuredSize()
    return { x: pos.x, y: pos.y, w: size.width, h: size.height }
  }

  disposeTree(): void {
    if (this.root !== null) {
      this.root.disposeTree()
      this.root = null
    }
    this.registry.clear()
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
