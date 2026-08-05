import { useEffect, useMemo, useRef, useState } from 'react'
import { parse } from '../parser/parser'
import { renderNode } from '../renderer/Renderer'
import { StatusBar, NavBar } from '../renderer/PhoneChrome'
import { getViewport } from '../devices/devices'
import { useStore } from '../store/store'

/**
 * 模板即时缩图：画布手机屏的等比微缩——
 * 以当前设备视口（vp × 0.6 CSS px）与系统栏设置渲染完整手机屏结构，
 * 再按卡片宽度整体 scale，保证缩略图与画布/真机的布局比例逐点一致
 * （旧实现固定 278px 宽，百分比尺寸/100% 高都按错误基准解析，与画布对不上）。
 * 只读预览（pointer-events: none），点击仍命中卡片本身。
 * 注意：不能用 .phone-screen 类——dnd 的 elOf 按该类限定画布范围，
 * 缩略图同用 renderNode 带 data-path，若同类名会抢先命中缩略图。
 */
export function TemplateThumb({ code }: { code: string }) {
  const ir = useMemo(() => {
    try { return parse(code) } catch { return null }
  }, [code])
  const deviceModel = useStore(s => s.deviceModel)
  const fold = useStore(s => s.fold)
  const systemBars = useStore(s => s.systemBars)
  const vp = getViewport(deviceModel, fold)
  const boxRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 0, x: 0, y: 0 })

  // 卡片尺寸随面板变化：按「宽、高双向取小」整体缩放（限高防长屏设备缩略图过长），
  // 偏移量按缩放后视觉尺寸居中——整屏等比完整可见，与画布比例逐点一致
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => {
      const scale = Math.min(el.clientWidth / vp.w_css, el.clientHeight / vp.h_css)
      setFit({
        scale,
        x: Math.max(0, (el.clientWidth - vp.w_css * scale) / 2),
        y: Math.max(0, (el.clientHeight - vp.h_css * scale) / 2),
      })
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [vp.w_css, vp.h_css])

  if (!ir) return null
  return (
    <div className="tmpl-thumb" ref={boxRef}>
      <div className="phone-static tmpl-thumb-scale"
        style={{
          width: vp.w_css, height: vp.h_css, fontSize: 9.6, lineHeight: 1.35, color: '#182431',
          left: fit.x, top: fit.y,
          transform: fit.scale > 0 ? `scale(${fit.scale})` : undefined,
        }}>
        {systemBars && <StatusBar />}
        <div className="app-area">
          {renderNode(ir.root, [], null, () => {}, null, false, { states: ir.states, aids: false })}
        </div>
        {systemBars && <NavBar />}
      </div>
    </div>
  )
}
