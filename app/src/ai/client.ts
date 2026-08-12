import { aiHeaders, getAiConfig } from './config'

const BASE = '/api'

/** 提取模型输出里第一个 ```ets 代码块；没有则把全文当代码（容错）。 */
export function extractEts(text: string): string {
  const m = text.match(/```(?:ets|typescript|ts|arkts)\s*\n([\s\S]*?)```/i)
  if (m) return m[1].replace(/\s+$/, '') + '\n'
  // 容错：如果文本里明显是 .ets（含 @Component / build()），整段返回
  if (/@Component|@Entry|struct\s+\w+|build\s*\(\s*\)/.test(text)) {
    return text.replace(/^[\s\S]*?(import)/, '$1').replace(/\s+$/, '') + '\n'
  }
  return ''
}

export interface StreamHandlers {
  onToken: (full: string, delta: string) => void
  onThinking?: (thinking: string) => void
  onDone: (full: string) => void
  onError: (msg: string) => void
}

/** 系统提示：让模型产出本工具可解析的 .ets（裁剪自 harmonyos-ui-generator skill 规则）。 */
const SYSTEM_CODEGEN = [
  '你是 ArkUI 代码生成器。只输出一个 ```ets 代码块，代码块外不要任何文字。',
  '禁止：解释、规划、致谢、提及任何文件名（如 PROJECT_OVERVIEW.md）、"让我先…"之类前言。第一条字符必须是 ```ets 的反引号。',
  '输出能被 ArkTS Visualizer 解析渲染的 .ets 文件（@Entry @Component struct + build()）。',
  '只用收录组件：Column/Row/Stack/Scroll/List/Grid/Tabs/Text/Button/Image/TextInput/Slider/Progress/Divider/Blank/Badge 等。',
  '单位 vp（不是 px）；颜色用 AARRGGBB 数值（0x80FF0000=半透明红，AA 在前）；Column/Row 交叉轴默认 Center，要撑满显式 width(\'100%\')。',
  'List 子节点必须 ListItem；Grid 子节点 GridItem；Tabs 子节点 TabContent；Scroll/TabContent/Badge 独子。',
  'Button 有子组件时不要传 label 构造参数。输出一个完整 .ets，只给代码不解释。',
].join('\n')

const SYSTEM_DESIGN = [
  '你是 ArkUI 代码生成器。把给定的设计稿 JSON 转成能被 ArkTS Visualizer 解析的 .ets 文件。',
  '组件映射：容器层 → Column/Row/Stack/Scroll/List/Grid；layoutMode HORIZONTAL→Row、VERTICAL→Column、NONE→Stack。',
  '属性转换：px → vp（÷3，dpi≈480）；fill/stroke 颜色 → AARRGGBB 数值（AA 在前）；cornerRadius → borderRadius；effects.shadow → shadow；itemSpacing → space。',
  '保真：单位 vp；Column/Row 交叉轴默认 Center，要撑满显式 width(\'100%\')；List 子节点 ListItem、Grid 子节点 GridItem、Tabs 子节点 TabContent；Scroll/TabContent/Badge 独子。',
  '输出一个完整 .ets（@Entry @Component struct + build()），代码块标 ets，只给代码不解释。',
].join('\n')

/**
 * 流式请求 + Anthropic SSE 解析。
 * 分离 thinking_delta（思考）与 text_delta（正文）：正文累积进 full 供提取，思考进 thinking 供展示。
 */
async function streamRequest(payload: Record<string, unknown>, h: StreamHandlers, signal?: AbortSignal): Promise<void> {
  const cfgModel = getAiConfig().model
  let res: Response
  try {
    res = await fetch(`${BASE}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiHeaders() },
      body: JSON.stringify({ ...(cfgModel ? { model: cfgModel } : {}), max_tokens: 8192, ...payload }),
      signal,
    })
  } catch (e) {
    return h.onError(`无法连接 ai-proxy（${e instanceof Error ? e.message : e}）。请确认 ai-proxy 已启动：cd ai-proxy && node server.js`)
  }
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '')
    return h.onError(`代理返回 ${res.status}：${t.slice(0, 300) || res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''
  let thinking = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const evt = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const dataLine = evt.split('\n').find(l => l.startsWith('data:'))
        if (!dataLine) continue
        const json = dataLine.slice(5).trim()
        if (!json || json === '[DONE]') continue
        try {
          const obj = JSON.parse(json)
          const d = obj.delta
          if (d) {
            if (typeof d.text === 'string' && d.text) { full += d.text; h.onToken(full, d.text) }
            else if (typeof d.thinking === 'string' && d.thinking) { thinking += d.thinking; h.onThinking?.(thinking) }
          }
          if (obj.type === 'message_stop') { h.onDone(full); return }
        } catch { /* 非 JSON 行忽略 */ }
      }
    }
    h.onDone(full)
  } catch (e) {
    if (signal?.aborted) return
    h.onError(e instanceof Error ? e.message : String(e))
  }
}

/** 自然语言 → .ets（流式）。 */
export async function streamGenerate(userPrompt: string, device: { w: number; h: number }, h: StreamHandlers, signal?: AbortSignal): Promise<void> {
  const userMsg =
    `页面：${userPrompt}\n` +
    `设备视口：${device.w} × ${device.h} vp\n` +
    `要求：用合适的容器组合实现高保真布局，自包含完整 .ets，只输出代码块。`
  return streamRequest({ system: SYSTEM_CODEGEN, messages: [{ role: 'user', content: userMsg }] }, h, signal)
}

/** 设计稿 JSON → .ets（流式，先客户端裁剪）。 */
export async function streamConvertDesign(designJson: string, device: { w: number; h: number }, h: StreamHandlers, signal?: AbortSignal): Promise<void> {
  const userMsg =
    `设备视口：${device.w} × ${device.h} vp\n` +
    `设计稿（已裁剪 JSON）：\n${trimDesignJson(designJson)}\n\n` +
    `按映射规则转成 .ets，只输出代码块。`
  return streamRequest({ system: SYSTEM_DESIGN, messages: [{ role: 'user', content: userMsg }] }, h, signal)
}

/** AI 连通性测试：返回 { ok, error? } */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  let r: Response
  try {
    r = await fetch(`${BASE}/ai/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiHeaders() },
      body: '{}',
    })
  } catch (e) {
    return { ok: false, error: `无法连接 ai-proxy（${e instanceof Error ? e.message : e}）。请确认已运行：cd ai-proxy && node server.js` }
  }
  const text = await r.text().catch(() => '')
  if (!text) {
    return { ok: false, error: `代理返回空响应（HTTP ${r.status}）。ai-proxy 未启动或非最新版——运行 cd ai-proxy && node server.js 重启；并确认 vite dev 也重启过（首次需加载 /api 代理配置）。` }
  }
  try {
    return JSON.parse(text) as { ok: boolean; error?: string }
  } catch {
    return { ok: false, error: `代理返回非 JSON（HTTP ${r.status}）：${text.slice(0, 200)}` }
  }
}

/** 把最新 .ets 发给代理（native-editor 轮询拉取，实现真机闭环）。 */
export async function postCurrentCode(code: string): Promise<void> {
  try {
    await fetch(`${BASE}/code/current`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: code,
    })
  } catch { /* 静默：不影响主流程 */ }
}

/**
 * 设计稿 JSON 裁剪：归一化为 {type, children, box, style} 最小集，
 * 删掉 id/prototyping/pluginData 等噪声字段，控制喂给模型的 token。
 * 解析失败回退原文（让模型自行处理）。
 */
export function trimDesignJson(raw: string): string {
  try {
    const obj = JSON.parse(raw)
    const seen: WeakSet<object> = new Set()
    function norm(n: unknown): unknown {
      if (!n || typeof n !== 'object') return n
      if (seen.has(n as object)) return null
      seen.add(n as object)
      const node = n as Record<string, unknown>
      const type = (node.type ?? node.name ?? node.kind ?? node.component ?? '?') as string
      const out: Record<string, unknown> = { type: String(type).slice(0, 40) }
      const b = node.boundingBox ?? node.absoluteBoundingBox ?? node.frame ?? node.box ?? node.layout
      if (b && typeof b === 'object') out.box = b
      else if (node.width !== undefined) out.box = { w: node.width, h: node.height }
      const s: Record<string, unknown> = {}
      for (const k of ['fills', 'fill', 'background', 'backgroundColor', 'strokes', 'cornerRadius', 'borderRadius', 'effects', 'opacity', 'layoutMode', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'padding', 'itemSpacing']) {
        if (node[k] !== undefined) s[k] = node[k]
      }
      if (Object.keys(s).length) out.style = s
      if (node.characters !== undefined) out.text = String(node.characters).slice(0, 120)
      if (Array.isArray(node.children)) {
        const kids = node.children.map(norm).filter(Boolean)
        if (kids.length) out.children = kids
      }
      return out
    }
    return JSON.stringify(norm(obj))
  } catch {
    return raw
  }
}

/** 把 .ets 推到设备文件（Phase 2 文件式兜底，需 native-editor 文件监听）。 */
export async function pushToDevice(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${BASE}/hdc/push-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: code,
    })
    return await r.json()
  } catch (e) {
    return { ok: false, error: `无法连接 ai-proxy（${e instanceof Error ? e.message : e}）` }
  }
}

/** hdc 状态探测 */
export async function hdcStatus(): Promise<{ ok: boolean; hdc?: string; targets?: string[]; error?: string }> {
  let r: Response
  try {
    r = await fetch(`${BASE}/hdc/status`)
  } catch (e) {
    // Vite 代理 ECONNREFUSED → fetch 直接抛（代理目标端口没监听 = ai-proxy 没启动）
    return { ok: false, error: `无法连接 ai-proxy（${e instanceof Error ? e.message : e}）。请确认已运行：cd ai-proxy && node server.js` }
  }
  // 代理目标不在线时，Vite 返回空响应体（HTTP 504/502）；此时不能直接 .json()，
  // 否则前端抛 "Unexpected end of JSON input"，真机预览只显示一条看不懂的报错。
  const text = await r.text().catch(() => '')
  if (!text) {
    return { ok: false, error: `代理返回空响应（HTTP ${r.status}）。ai-proxy 未启动——运行 cd ai-proxy && node server.js 重启；并确认 vite dev 也重启过（首次需加载 /api 代理配置）。` }
  }
  try {
    return JSON.parse(text) as { ok: boolean; hdc?: string; targets?: string[]; error?: string }
  } catch {
    return { ok: false, error: `代理返回非 JSON（HTTP ${r.status}）：${text.slice(0, 200)}` }
  }
}

/** 拉起真机 native-editor 并建立反向端口转发（设备 127.0.0.1:5174 → 宿主 ai-proxy）。 */
export async function launchNativeEditor(): Promise<{ ok: boolean; forwarded?: boolean; launched?: boolean; error?: string }> {
  let r: Response
  try {
    r = await fetch(`${BASE}/hdc/launch`, { method: 'POST' })
  } catch (e) {
    return { ok: false, error: `无法连接 ai-proxy（${e instanceof Error ? e.message : e}）` }
  }
  const text = await r.text().catch(() => '')
  if (!text) return { ok: false, error: `代理返回空响应（HTTP ${r.status}）` }
  try {
    return JSON.parse(text) as { ok: boolean; forwarded?: boolean; launched?: boolean; error?: string }
  } catch {
    return { ok: false, error: `代理返回非 JSON（HTTP ${r.status}）：${text.slice(0, 200)}` }
  }
}

/** 真机流 URL（MJPEG，<img src> 直消费） */
export const hdcStreamUrl = `${BASE}/hdc/stream`
