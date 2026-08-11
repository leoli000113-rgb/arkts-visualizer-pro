import { useState, useEffect } from 'react'
import { getAiConfig, setAiConfig, clearAiConfig } from '../ai/config'
import { testConnection } from '../ai/client'

/**
 * AI 设置弹窗：在网站上填 API Key / Base URL / Model，存 localStorage。
 * 不需要碰 ai-proxy/.env。每次请求随 header 发给代理。
 */
export function AiSettings({ onClose }: { onClose: () => void }) {
  const cur = getAiConfig()
  const [apiKey, setApiKey] = useState(cur.apiKey)
  const [baseUrl, setBaseUrl] = useState(cur.baseUrl)
  const [model, setModel] = useState(cur.model)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [defaults, setDefaults] = useState<{ defaultBase?: string; model?: string; hasKey?: boolean } | null>(null)

  // 拉取代理默认（环境变量里的 base/model），提示用户何时可不填
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setDefaults).catch(() => {})
  }, [])

  function save() {
    setAiConfig({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() })
    setResult({ ok: true, msg: '已保存。' })
  }

  function clear() {
    clearAiConfig()
    setApiKey(''); setBaseUrl(''); setModel('')
    setResult({ ok: true, msg: '已清除。' })
  }

  async function test() {
    setTesting(true); setResult(null)
    // 先保存当前输入再测，这样测试用的是刚填的值
    setAiConfig({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() })
    const r = await testConnection()
    setTesting(false)
    setResult(r.ok ? { ok: true, msg: '✓ 连接成功，模型可用。' } : { ok: false, msg: `✗ ${r.error || '失败'}` })
  }

  return (
    <div className="ai-modal-mask" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <div className="ai-dialog-head">
          <span>AI 接口设置</span>
          <button className="ai-dialog-x" title="关闭" onClick={onClose}>✕</button>
        </div>
        <div className="ai-settings-body">
          <label className="ai-field">
            <span>API Key</span>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-...（Claude Code 用的同一个 key）" autoComplete="off" />
          </label>
          <label className="ai-field">
            <span>Base URL <em>（可选）</em></span>
            <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="留空用代理默认" />
            {defaults?.defaultBase && (
              <span className="ai-field-hint">留空 = 代理环境变量默认：<code>{defaults.defaultBase}</code></span>
            )}
          </label>
          <label className="ai-field">
            <span>Model <em>（可选）</em></span>
            <input type="text" value={model} onChange={e => setModel(e.target.value)}
              placeholder="留空用代理默认" />
            {defaults?.model && (
              <span className="ai-field-hint">留空 = <code>{defaults.model}</code></span>
            )}
          </label>
          <div className="ai-settings-actions">
            <button className="ai-btn" onClick={save}>保存</button>
            <button className="ai-btn" onClick={test} disabled={testing}>{testing ? '测试中…' : '测试连接'}</button>
            <button className="ai-btn ai-btn-stop" onClick={clear}>清除</button>
          </div>
          {result && <div className={result.ok ? 'ai-ok' : 'ai-error'}>{result.msg}</div>}
          <p className="ai-settings-note">
            密钥只存在本机浏览器 localStorage，每次请求经 ai-proxy 转发到上游。
            走自定义网关时务必填 Base URL。
          </p>
        </div>
      </div>
    </div>
  )
}
