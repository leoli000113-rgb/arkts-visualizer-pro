import { useState } from 'react'
import { useStore } from '../store/store'
import { startNewDrag, startNewDragNode } from '../editor/dnd'
import { PALETTE_GROUPS } from '../registry'
import { TEMPLATE_CATEGORIES } from '../templates/templates'
import { LIBRARY, LIBRARY_CATEGORIES } from '../library/components'
import { TemplateThumb } from './TemplateThumb'

type SideTab = 'pages' | 'palette' | 'library' | 'templates'

/** 项目页签：页面/文件列表（@Entry 标 ⌂）+ 导入的媒体资源（可移除） */
function PagesPanel({ query }: { query: string }) {
  const files = useStore(s => s.files)
  const currentFile = useStore(s => s.currentFile)
  const media = useStore(s => s.media)
  const setCurrentFile = useStore(s => s.setCurrentFile)
  const removeMedia = useStore(s => s.removeMedia)
  const q = query.trim().toLowerCase()
  const keys = Object.keys(files).sort().filter(k => !q || k.toLowerCase().includes(q))
  if (Object.keys(files).length === 0) {
    return (
      <div className="palette">
        <div className="palette-empty">
          单文件模式。<br />
          点顶栏「导入项目」选择 ArkTS 工程目录后，此处列出全部页面与媒体资源；「导入媒体」可单独追加图片/视频。
        </div>
      </div>
    )
  }
  const mediaEntries = Object.entries(media).filter(([n]) => !q || n.toLowerCase().includes(q))
  return (
    <div className="palette">
      <div className="palette-scroll">
        <div className="palette-group">
          <div className="palette-group-label">页面 / 文件 ({keys.length})</div>
          <div className="page-list">
            {keys.map(k => {
              const name = k.split('/').pop()!.replace(/\.(ets|ts)$/, '')
              const entry = files[k].includes('@Entry')
              return (
                <div key={k} className={`page-item${k === currentFile ? ' active' : ''}`}
                  title={k} onClick={() => setCurrentFile(k)}>
                  <span className="page-item-icon">{entry ? '⌂' : '·'}</span>
                  <span className="page-item-name">{name}</span>
                  {k === currentFile && <span className="page-item-cur">当前</span>}
                </div>
              )
            })}
          </div>
        </div>
        {mediaEntries.length > 0 && (
          <div className="palette-group">
            <div className="palette-group-label">媒体资源 ({mediaEntries.length})</div>
            <div className="media-grid">
              {mediaEntries.map(([name, url]) => (
                <div key={name} className="media-cell" title={`$r('app.media.${name}')`}>
                  {url.startsWith('data:video')
                    ? <span className="media-video-icon">🎬</span>
                    : <img src={url} alt={name} draggable={false} />}
                  <span className="media-name">{name}</span>
                  <button className="media-del" title="从媒体表移除" onClick={() => removeMedia(name)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="palette-hint">⌂ = @Entry 入口页；点击文件名切换编辑/预览目标</div>
    </div>
  )
}

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
  // 分类命中保留整组，否则按组件名过滤
  const groups = LIBRARY_CATEGORIES
    .map((cat) => ({
      label: cat,
      items: cat.toLowerCase().includes(q)
        ? LIBRARY.filter((c) => c.category === cat)
        : LIBRARY.filter((c) => c.category === cat && c.name.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0)
  return (
    <div className="palette">
      <div className="palette-scroll">
        {groups.length === 0 && <div className="palette-empty">无匹配组件</div>}
        {groups.map((g) => (
          <div key={g.label} className="palette-group">
            <div className="palette-group-label">{g.label} ({g.items.length})</div>
            <div className="palette-items library-items">
              {g.items.map((c) => (
                <div key={c.name} className="palette-item library-item"
                  onPointerDown={(e) => { e.preventDefault(); startNewDragNode(c.makeNode()) }}
                >
                  <span className="lib-icon">{c.icon}</span>
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="palette-hint">复合组件 = 多个基础组件的组合，拖入画布/大纲树即生成一组 UI</div>
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

/** 导航面板：页签（页面/组件/组件库/模板）+ 搜索（大纲树为独立停靠面板，见 OutlineTree） */
export function SidePanel() {
  const [sideTab, setSideTab] = useState<SideTab>('palette')
  const [sideQuery, setSideQuery] = useState('')
  return (
    <div className="nav-panel">
      <div className="side-tabs">
        <button className={sideTab === 'pages' ? 'active' : ''} onClick={() => setSideTab('pages')}>页面</button>
        <button className={sideTab === 'palette' ? 'active' : ''} onClick={() => setSideTab('palette')}>组件</button>
        <button className={sideTab === 'library' ? 'active' : ''} onClick={() => setSideTab('library')}>组件库</button>
        <button className={sideTab === 'templates' ? 'active' : ''} onClick={() => setSideTab('templates')}>模板</button>
      </div>
      <div className="side-search">
        <input value={sideQuery} onChange={(e) => setSideQuery(e.target.value)} placeholder="搜索页面 / 组件 / 模板…" />
      </div>
      {sideTab === 'pages' && <PagesPanel query={sideQuery} />}
      {sideTab === 'palette' && <Palette query={sideQuery} />}
      {sideTab === 'library' && <LibraryPanel query={sideQuery} />}
      {sideTab === 'templates' && <TemplatePanel query={sideQuery} />}
    </div>
  )
}
