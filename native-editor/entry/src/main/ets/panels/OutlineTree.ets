/**
 * 大纲树：IR 树 → 扁平行（缩进/折叠/选中/删除/复制）。
 * 行的计算是纯函数 flattenOutline，父组件在数据变化后重算并传入。
 */

import { IRNode } from '../core/ir'
import { rawOf } from '../render/argConvert'

export interface OutlineRow {
  path: string
  depth: number
  label: string
  dim: boolean
  hasChildren: boolean
  collapsed: boolean
}

function labelOf(n: IRNode): string {
  const a0 = n.ctorArgs[0]
  const s = a0 !== undefined && a0.t === 'str' ? a0.v : null
  if (s !== null && s !== '') return `${n.type}  ${s.length > 10 ? s.slice(0, 10) + '…' : s}`
  const r = rawOf(a0)
  if (n.type === 'If') return r !== null ? `if ${r}` : 'If'
  if (n.type === 'Comment') return r !== null ? (r.length > 18 ? r.slice(0, 18) + '…' : r) : '//'
  if (n.type === 'Expr') return r !== null ? (r.length > 18 ? r.slice(0, 18) + '…' : r) : 'expr'
  return n.type
}

export function flattenOutline(root: IRNode, collapsed: Set<string>): OutlineRow[] {
  const rows: OutlineRow[] = []
  const walk = (n: IRNode, path: string, depth: number): void => {
    const has = n.children.length > 0
    const isCollapsed = collapsed.has(path)
    rows.push({
      path, depth,
      label: labelOf(n),
      dim: n.type === 'Comment' || n.type === 'Expr',
      hasChildren: has,
      collapsed: isCollapsed,
    })
    if (has && !isCollapsed) {
      for (let i = 0; i < n.children.length; i++) {
        walk(n.children[i], path === '' ? String(i) : `${path}.${i}`, depth + 1)
      }
    }
  }
  walk(root, '', 0)
  return rows
}

@Component
export struct OutlineTree {
  @Prop rows: OutlineRow[] = []
  @Prop selPath: string = ''
  @Prop ver: number = 0
  onSelect: (path: string) => void = (p) => {}
  onToggle: (path: string) => void = (p) => {}
  onDelete: (path: string) => void = (p) => {}
  onDuplicate: (path: string) => void = (p) => {}

  build() {
    List() {
      ForEach(this.rows, (r: OutlineRow) => {
        ListItem() {
          Row() {
            Text(r.collapsed ? '▸' : (r.hasChildren ? '▾' : '·'))
              .fontSize(10)
              .fontColor('#888888')
              .width(14)
              .textAlign(TextAlign.Center)
              .onClick(() => { if (r.hasChildren) this.onToggle(r.path) })
            Text(r.label)
              .fontSize(12)
              .fontColor(r.dim ? '#999999' : (r.path === this.selPath ? '#0A59F7' : '#333333'))
              .fontWeight(r.path === this.selPath ? FontWeight.Bold : FontWeight.Normal)
              .layoutWeight(1)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            if (r.path !== '') {
              Text('复')
                .fontSize(11)
                .fontColor('#666666')
                .padding({ left: 6, right: 6 })
                .onClick(() => this.onDuplicate(r.path))
              Text('删')
                .fontSize(11)
                .fontColor('#cc0000')
                .padding({ left: 6, right: 6 })
                .onClick(() => this.onDelete(r.path))
            }
          }
          .width('100%')
          .padding({ left: r.depth * 12 + 2, top: 5, bottom: 5, right: 4 })
          .backgroundColor(r.path === this.selPath ? '#e3edff' : '#00000000')
          .onClick(() => this.onSelect(r.path))
        }
      // key 带数据版本：树内容变化时强制整行重建，避免 List 按 path 复用导致的行内容错乱
      }, (r: OutlineRow) => `${this.ver}:${r.path}`)
    }
    .width('100%')
    .height('100%')
  }
}
