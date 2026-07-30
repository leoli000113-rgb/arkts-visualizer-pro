import { useState } from 'react'
import { useStore } from '../store/store'
import { startNewDrag, startNewDragNode } from '../editor/dnd'
import { OutlineTree } from '../editor/OutlineTree'
import { PALETTE_GROUPS } from '../registry'
import { TEMPLATE_CATEGORIES } from '../templates/templates'
import { LIBRARY } from '../library/components'
import { TemplateThumb } from './TemplateThumb'

type SideTab = 'palette' | 'library' | 'templates'

function Palette({ query }: { query: string }) {
  const q = query.trim().toLowerCase()
  const groups = PALETTE_GROUPS
    .map((g) => ({
      ...g,
      // 组名命中则保留整组，否则按组件名过滤
      items: g.label.toLowerCase().includes(q) ? g.items : g.items.filter((t) => t.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0)
  return (
    <div className="palette">
      <div className="palette-scroll">
        {groups.length === 0 && <div className="palette-empty">无匹配组件</div>}
        {groups.map((g) => (
          <div key={g.label} className="palette-group">
            <div className="palette-group-label">{g.label}</div>
            <div className="palette-items">
              {g.items.map((t) => (
                <div key={t} className="palette-item"
                  onPointerDown={(e) => { e.preventDefault(); startNewDrag(t) }}
                >{t}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="palette-hint">拖入画布：边缘 30% = 前/后插入；中部 = 放入容器</div>
    </div>
  )
}

function LibraryPanel({ query }: { query: string }) {
  const q = query.trim().toLowerCase()
  const items = LIBRARY.filter((c) => c.name.toLowerCase().includes(q))
  return (
    <div className="palette">
      <div className="palette-scroll">
        <div className="palette-group">
          <div className="palette-group-label">复合组件</div>
          <div className="palette-items library-items">
            {items.length === 0 && <div className="palette-empty">无匹配组件</div>}
            {items.map((c) => (
              <div key={c.name} className="palette-item library-item"
                onPointerDown={(e) => { e.preventDefault(); startNewDragNode(c.makeNode()) }}
              >
                <span className="lib-icon">{c.icon}</span>
                <span>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="palette-hint">复合组件 = 多个基础组件的组合，拖入即生成一组 UI</div>
    </div>
  )
}

function TemplatePanel({ query }: { query: string }) {
  const { setCode } = useStore()
  const q = query.trim().toLowerCase()
  const cats = TEMPLATE_CATEGORIES
    .map((cat) => ({
      ...cat,
      templates: cat.templates.filter((t) =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    }))
    .filter((cat) => cat.templates.length > 0)
  return (
    <div className="palette">
      <div className="palette-scroll">
        {cats.length === 0 && <div className="palette-empty">无匹配模板</div>}
        {cats.map((cat) => (
          <div key={cat.label} className="palette-group">
            <div className="palette-group-label">{cat.icon} {cat.label} ({cat.templates.length})</div>
            <div className="template-list">
              {cat.templates.map((t) => (
                <div key={t.name} className="template-card"
                  onClick={() => setCode(t.code, { keepHistory: true })}
                >
                  <TemplateThumb code={t.code} />
                  <div className="tmpl-info">
                    <div className="tmpl-name">{t.icon} {t.name}</div>
                    <div className="tmpl-desc">{t.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="palette-hint">点击模板 → 替换当前页面（可 Ctrl+Z 撤销）</div>
    </div>
  )
}

/** 左侧栏：页签（组件/组件库/模板）+ 搜索 + 大纲树 */
export function SidePanel() {
  const [sideTab, setSideTab] = useState<SideTab>('palette')
  const [sideQuery, setSideQuery] = useState('')
  return (
    <div className="side-col">
      <div className="side-tabs">
        <button className={sideTab === 'palette' ? 'active' : ''} onClick={() => setSideTab('palette')}>组件</button>
        <button className={sideTab === 'library' ? 'active' : ''} onClick={() => setSideTab('library')}>组件库</button>
        <button className={sideTab === 'templates' ? 'active' : ''} onClick={() => setSideTab('templates')}>模板</button>
      </div>
      <div className="side-search">
        <input value={sideQuery} onChange={(e) => setSideQuery(e.target.value)} placeholder="搜索组件 / 模板…" />
      </div>
      {sideTab === 'palette' && <Palette query={sideQuery} />}
      {sideTab === 'library' && <LibraryPanel query={sideQuery} />}
      {sideTab === 'templates' && <TemplatePanel query={sideQuery} />}
      <div className="outline-panel">
        <div className="label">大纲树</div>
        <OutlineTree />
      </div>
    </div>
  )
}
