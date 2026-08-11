/**
 * AI 配置（API Key / Base URL / Model）：存 localStorage，随请求 header 发给代理。
 * 代理优先用 header（这里填的），退回环境变量。这样用户不碰 .env，在网站上填即可。
 */

export interface AiConfig {
  apiKey: string
  baseUrl: string // 留空 = 官方 api.anthropic.com
  model: string   // 留空 = 代理默认
}

const KEY = 'arkts-ai-config'

export function getAiConfig(): AiConfig {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '')
    return { apiKey: v.apiKey || '', baseUrl: v.baseUrl || '', model: v.model || '' }
  } catch { return { apiKey: '', baseUrl: '', model: '' } }
}

export function setAiConfig(c: AiConfig) {
  localStorage.setItem(KEY, JSON.stringify(c))
}

export function clearAiConfig() {
  localStorage.removeItem(KEY)
}

export function hasAiKey(): boolean {
  return !!getAiConfig().apiKey
}

/** 拼请求 header：只带非空字段，让代理退回默认。 */
export function aiHeaders(): Record<string, string> {
  const c = getAiConfig()
  const h: Record<string, string> = {}
  if (c.apiKey) h['X-AI-Key'] = c.apiKey
  if (c.baseUrl) h['X-AI-Base'] = c.baseUrl
  if (c.model) h['X-AI-Model'] = c.model
  return h
}
