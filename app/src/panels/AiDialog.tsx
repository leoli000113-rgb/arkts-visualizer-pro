import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { getViewport } from '../devices/devices'
import { streamGenerate, streamConvertDesign, extractEts, postCurrentCode, pushToDevice } from '../ai/client'
import { hasAiKey } from '../ai/config'
import { AiSettings } from './AiSettings'

type Mode = 'text' | 'design'

/**
 * AI 对话框：
 *  - 描述模式：自然语言 → .ets
 *  - 设计稿模式：粘贴 Figma/设计 JSON → .ets（客户端裁剪后送模型）
 * 生成成功 → setCode（画布同步）→ 自动 POST 当前代码给代理（native-editor 轮询拉取，真机闭环）
 */
export function AiDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('text')
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [thinking, setThinking] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const [deviceMsg, setDeviceMsg] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [configured, setConfigured] = useState(hasAiKey())
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  const deviceModel = useStore(s => s.deviceModel)
  const fold = useStore(s => s.fold)
  const vp = getViewport(deviceModel, fold)
  const device = { w: Math.round(vp.w_css / 0.6), h: Math.round(vp.h_css / 0.6) }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [streaming])

  async function send() {
    const prompt = input.trim()
    if (!prompt || busy) return
    if (!hasAiKey()) { setSettingsOpen(true); return }
    setBusy(true); setStreaming(''); setThinking(''); setError(null); setApplied(false); setDeviceMsg(null)
    const ac = new AbortController()
    abortRef.current = ac
    const handlers = {
      onToken: (full: string) => { setStreaming(full); setThinking('') },
      onThinking: (t: string) => setThinking(t),
      onDone: (full: string) => {
        setBusy(false); setThinking('')
        const code = extractEts(full)
        if (!code) { setError('模型未返回可识别的 .ets 代码块（可重试或换描述）。'); return }
        useStore.getState().setCode(code, { keepHistory: true })
        setApplied(true)
        // 自动推给代理：native-editor 轮询拉取，真机闭环（静默，失败不影响）
        postCurrentCode(code)
      },
      onError: (msg: string) => { setBusy(false); setError(msg) },
    }
    if (mode === 'text') await streamGenerate(prompt, device, handlers, ac.signal)
    else await streamConvertDesign(prompt, device, handlers, ac.signal)
  }

  function stop() { abortRef.current?.abort(); setBusy(false) }

  async function push() {
    const code = useStore.getState().code
    if (!code) return
    setDeviceMsg('推送中…')
    // 双保险：网络式（current-code，native-editor 轮询）+ 文件式（push-code）
    await postCurrentCode(code)
    const r = await pushToDevice(code)
    setDeviceMsg(r.ok ? '✓ 已推到真机（native-editor 在线即自动载入）' : `✗ ${r.error}`)
  }

  const placeholder = mode === 'text'
    ? '描述你想要的界面，例如：\n一个登录页：顶部 Logo 图标，中间账号/密码输入框，底部蓝色登录按钮，背景浅灰'
    : '粘贴设计稿 JSON（Figma 导出或设计工具 JSON）。客户端会先裁剪归一化，再让模型做组件映射/属性转换。\n例如：{"type":"FRAME","layoutMode":"VERTICAL","children":[...]}'

  return (
    <div className="ai-dialog">
      <div className="ai-dialog-head">
        <span>AI 生成 · {device.w}×{device.h}vp</span>
        <span>
          <button className="ai-dialog-x" title="AI 接口设置" onClick={() => setSettingsOpen(true)}>⚙</button>
          <button className="ai-dialog-x" title="关闭" onClick={onClose}>✕</button>
        </span>
      </div>
      <div className="ai-dialog-body">
        <div className="ai-mode-tabs">
          <button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>描述</button>
          <button className={mode === 'design' ? 'active' : ''} onClick={() => setMode('design')}>设计稿</button>
        </div>
        {!configured && (
          <div className="ai-error">未配置 API Key，点 <b onClick={() => setSettingsOpen(true)} style={{cursor:'pointer'}}>⚙ 设置</b> 填入。</div>
        )}
        {settingsOpen && <AiSettings onClose={() => { setSettingsOpen(false); setConfigured(hasAiKey()) }} />}
        <textarea
          className="ai-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          rows={mode === 'design' ? 6 : 4}
          disabled={busy}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }}
        />
        <div className="ai-actions">
          {busy
            ? <button className="ai-btn ai-btn-stop" onClick={stop}>■ 停止</button>
            : <button className="ai-btn" onClick={send} disabled={!input.trim()}>{mode === 'text' ? '生成' : '转换'} ↵</button>}
          <span className="ai-hint">Ctrl+Enter 发送 · 自动同步画布 + 推送真机</span>
        </div>
        {applied && (
          <div className="ai-actions">
            <button className="ai-btn ai-btn-device" onClick={push}>⇪ 推到真机</button>
            <span className="ai-hint">native-editor 在线即自动载入并在真机渲染</span>
          </div>
        )}
        {deviceMsg && <div className="ai-ok">{deviceMsg}</div>}
        {error && <div className="ai-error">⚠ {error}</div>}
        {applied && !streaming && <div className="ai-ok">✓ 已应用，画布已同步（Ctrl+Z 可回退）</div>}
        {busy && !streaming && !thinking && (
          <div className="ai-waiting">⏳ 已发送，等待模型响应（思考阶段可能 10~20s 才出第一个字）…</div>
        )}
        {thinking && !streaming && (
          <pre className="ai-stream ai-thinking">{thinking}{busy ? '▍' : ''}</pre>
        )}
        {streaming && (
          <pre className="ai-stream" ref={logRef}>{streaming}{busy ? '▍' : ''}</pre>
        )}
      </div>
    </div>
  )
}
