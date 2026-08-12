import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { getViewport } from '../devices/devices'
import { hdcStatus, hdcStreamUrl, launchNativeEditor } from '../ai/client'
import { sendCode } from '../ai/ws'

/**
 * 真机 ArkUI 预览：把当前编辑的 .ets 推给 ai-proxy，设备上 native-editor 用真 ArkUI
 * 引擎（typeNode）全屏渲染，MJPEG 截图回传——DevEco Previewer 式高保真，不再是「转网页版近似」。
 * 代码经 WS 推送（<300ms，替代 1.5s 轮询）；WS 未连上时 sendCode 自动降级 HTTP 轮询。
 */
export function DevicePreview({ onClose }: { onClose: () => void }) {
  const deviceModel = useStore(s => s.deviceModel)
  const fold = useStore(s => s.fold)
  const code = useStore(s => s.code)
  const wsOnline = useStore(s => s.wsOnline)
  const geoSize = useStore(s => s.geo.size)
  const vp = getViewport(deviceModel, fold)
  const [status, setStatus] = useState<{ ok: boolean; targets?: string[]; error?: string } | null>(null)
  const [launchMsg, setLaunchMsg] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const pushTimer = useRef<number>(0)

  const hasDevice = !!status?.targets?.length
  // 主画布已切真机模式（WS 连上 + 几何图回发）→ 不再在本面板开 MJPEG，
  // 避免 ai-proxy 每连接独立 capture 循环、双流竞写同一截图文件导致花屏。
  const mainCanvasLive = wsOnline && geoSize > 0

  // 探测设备 + 拉起 native-editor（rport 反向转发 + aa start 到前台）。
  // WS 连接在 App.tsx 启动时已建立（幂等），这里只负责拉设备到前台。
  useEffect(() => {
    let cancelled = false
    hdcStatus().then(async (s) => {
      if (cancelled) return
      setStatus(s)
      if (!s?.targets?.length) return
      const lp = await launchNativeEditor()
      if (cancelled) return
      setLaunchMsg(lp.launched
        ? `已拉起 native-editor${lp.forwarded ? '' : '（端口转发未就绪，画面可能不刷新）'}`
        : `拉起失败：${lp.error || '未知'}`)
    })
    return () => { cancelled = true }
  }, [retry])

  // 代码变化：防抖 250ms 经 WS 推给设备（WS 未连上时 sendCode 内部降级 HTTP 轮询）。
  // 250ms = 在「打字连贯不卡顿」与「设备重渲染节流」间折中；设备 rebuild ~100ms，
  // 防抖过短会让快速改属性时设备 thrash。截图去重在 ai-proxy StreamHub 兜底。
  useEffect(() => {
    if (!hasDevice) return
    window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => sendCode(code), 250)
    return () => window.clearTimeout(pushTimer.current)
  }, [code, hasDevice])

  // 预览框比例优先跟真实截图尺寸，截图没拿到时退回设备视口比例
  const ratio = imgSize ? imgSize.h / imgSize.w : vp.h_css / vp.w_css
  const w = 220
  const h = Math.round(w * ratio)

  return (
    <div className="device-preview">
      <div className="ai-dialog-head">
        <span>真机 ArkUI 预览{hasDevice ? ` · ${status!.targets![0]}` : ''}</span>
        <button className="ai-dialog-x" title="关闭" onClick={onClose}>✕</button>
      </div>
      <div className="device-preview-body">
        {status === null
          ? <div className="device-hint">探测 hdc…</div>
          : hasDevice
            ? (
              mainCanvasLive ? (
                <div className="device-hint">
                  <p>✅ 真机已在<b>主画布</b>渲染（MJPEG + 命中叠加）。</p>
                  <p className="device-hint-sm">改代码 → 防抖 500ms 推送 → 设备 &lt;300ms 重渲染，画布像素跟着变。<br />点画布组件即可选中（P2 只读）；拖拽/落点 P3/P4 接入。</p>
                  <button className="ai-btn" onClick={() => setRetry(r => r + 1)}>↻ 重新拉起</button>
                </div>
              ) : (
                <div className="device-screen-frame" style={{ width: w, height: h }}>
                  {/* MJPEG multipart/x-mixed-replace：<img> 直消费，浏览器原生支持。
                      画面是 native-editor 全屏预览模式渲染的当前代码——真 ArkUI 保真渲染。 */}
                  <img key={retry} src={hdcStreamUrl} alt="device stream"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    onLoad={e => {
                      const t = e.currentTarget
                      if (t.naturalWidth && t.naturalHeight) setImgSize({ w: t.naturalWidth, h: t.naturalHeight })
                    }}
                    onError={() => setRetry(r => r + 1)} />
                </div>
              )
            )
            : (
              <div className="device-hint">
                <p>未检测到设备/模拟器。</p>
                <p className="device-hint-sm">连接设备后点刷新，或运行：</p>
                <code>hdc list targets</code>
                <p className="device-hint-sm">需已安装 native-editor HAP 且 ai-proxy 运行中（<code>cd ai-proxy && node server.js</code>）。</p>
                <button className="ai-btn" onClick={() => setRetry(r => r + 1)}>↻ 刷新</button>
                {status.error && <p className="device-hint-sm err">⚠ {status.error}</p>}
              </div>
            )}
        {launchMsg && <p className="device-hint-sm">{launchMsg}</p>}
      </div>
    </div>
  )
}
