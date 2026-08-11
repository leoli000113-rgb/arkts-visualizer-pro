import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { getViewport } from '../devices/devices'
import { hdcStatus, hdcStreamUrl } from '../ai/client'

/**
 * 真机预览：把跑着的鸿蒙模拟器/真机屏幕（hdc 截图流）投到画布旁。
 * 高保真来源——真机 ArkUI 布局引擎，1:1。无设备时降级提示。
 */
export function DevicePreview({ onClose }: { onClose: () => void }) {
  const deviceModel = useStore(s => s.deviceModel)
  const fold = useStore(s => s.fold)
  const vp = getViewport(deviceModel, fold)
  const [status, setStatus] = useState<{ ok: boolean; targets?: string[]; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => { hdcStatus().then(setStatus) }, [retry])

  const hasDevice = !!status?.targets?.length
  // 宽高比跟随当前设备视口
  const ratio = vp.h_css / vp.w_css
  const w = 220
  const h = Math.round(w * ratio)

  return (
    <div className="device-preview">
      <div className="ai-dialog-head">
        <span>真机预览{hasDevice ? ` · ${status!.targets![0]}` : ''}</span>
        <button className="ai-dialog-x" title="关闭" onClick={onClose}>✕</button>
      </div>
      <div className="device-preview-body">
        {status === null
          ? <div className="device-hint">探测 hdc…</div>
          : hasDevice
            ? (
              <div className="device-screen-frame" style={{ width: w, height: h }}>
                {/* MJPEG multipart/x-mixed-replace：<img> 直消费，浏览器原生支持 */}
                <img key={retry} src={hdcStreamUrl} alt="device stream"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  onError={() => setRetry(r => r + 1)} />
              </div>
            )
            : (
              <div className="device-hint">
                <p>未检测到设备/模拟器。</p>
                <p className="device-hint-sm">连接设备后点刷新，或运行：</p>
                <code>hdc list targets</code>
                <p className="device-hint-sm">需先启动 ai-proxy，且 DevEco 模拟器/真机在线。</p>
                <button className="ai-btn" onClick={() => setRetry(r => r + 1)}>↻ 刷新</button>
                {status.error && <p className="device-hint-sm err">⚠ {status.error}</p>}
              </div>
            )}
      </div>
    </div>
  )
}
