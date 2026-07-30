import { useMemo } from 'react'
import { parse } from '../parser/parser'
import { renderNode } from '../renderer/Renderer'

/**
 * 模板即时缩图：用渲染器即时渲染模板 IR，缩放到卡片尺寸。
 * 只读预览（pointer-events: none），点击仍命中卡片本身。
 */
export function TemplateThumb({ code }: { code: string }) {
  const ir = useMemo(() => {
    try { return parse(code) } catch { return null }
  }, [code])
  if (!ir) return null
  return (
    <div className="tmpl-thumb">
      <div className="tmpl-thumb-scale">
        {renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids: false })}
      </div>
    </div>
  )
}
