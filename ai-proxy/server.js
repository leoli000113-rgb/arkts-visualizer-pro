/**
 * ArkTS Visualizer AI 代理服务（零依赖纯 Node）
 *
 * 职责：
 *  1. POST /api/ai          —— 转发 Claude Messages API（SSE 流式），密钥只在服务端
 *  2. GET  /api/hdc/status   —— 探测 hdc 与连接的设备
 *  3. GET  /api/hdc/stream   —— 把真机/模拟器屏幕以 MJPEG 推流到画布
 *  4. POST /api/hdc/push-code —— 把 .ets 写到设备（Phase 2：native-editor 轮询该文件）
 *  5. GET  /api/health
 *
 * 运行：node server.js   （端口默认 5174，见 .env）
 * 密钥从环境变量 ANTHROPIC_API_KEY 读取，绝不返回给前端。
 */
import http from 'node:http'
import https from 'node:https'
import { WebSocketServer } from 'ws'
import { spawn, execFile } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------- 配置（.env 文件 + 环境变量；环境变量优先） ----------
function loadEnv() {
  const p = join(__dirname, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}
loadEnv()

const PORT = Number(process.env.PORT) || 5174
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173'
const API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
const HDC_FPS = Math.min(15, Math.max(1, Number(process.env.HDC_FPS) || 6))

// 上游 base url：官方默认 api.anthropic.com。
// 每次请求可被 header X-AI-Base 覆盖（来自网站 UI 填的配置）。
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')

// 把 base url 解析成 { mod, hostname, port, path }，支持 http/https 与自定义端口。
function resolveUpstream(base) {
  const b = (base || BASE_URL).replace(/\/+$/, '')
  const u = new URL(b.endsWith('/v1') ? `${b}/messages` : `${b}/v1/messages`)
  const mod = u.protocol === 'http:' ? http : https
  return {
    mod,
    hostname: u.hostname,
    port: u.port ? Number(u.port) : (u.protocol === 'http:' ? 80 : 443),
    path: u.pathname + u.search,
  }
}

// ---------- hdc 路径探测 ----------
function resolveHdc() {
  if (process.env.HDC_BIN) return process.env.HDC_BIN
  const cands = [
    'C:/Program Files/Huawei/DevEco Studio/sdk/default/openharmony/toolchains/hdc.exe',
    'C:/Program Files/Huawei/DevEco Studio/sdk/default/openharmony/toolchains/hdc',
    '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',
  ]
  for (const c of cands) if (existsSync(c)) return c
  return 'hdc' // 退回 PATH
}
const HDC = resolveHdc()
// Windows 上 execFile(spawn) 对带空格的路径需要直接传字符串作 file + shell:false；
// 这里统一用 spawn(shell:false) + 全路径，Windows 下需 .exe 后缀已含在 cands 里。

function hdc(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(HDC, args, { shell: false, windowsVerbatimArguments: true, ...opts })
    let out = '', err = ''
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { err += d })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `hdc exit ${code}`)))
  })
}

// ---------- 工具 ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = ''
    req.on('data', d => { buf += d; if (buf.length > 4 * 1024 * 1024) reject(new Error('body too large')) })
    req.on('end', () => resolve(buf))
    req.on('error', reject)
  })
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AI-Key, X-AI-Base, X-AI-Model')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

// ---------- 路由 ----------
// 当前代码（真机闭环：Web POST 最新 .ets，native-editor 轮询 GET 拉取）。
// 内存态；进程重启即清空。native-editor 用 ts 判断是否变化。
let currentCode = ''
let currentTs = 0
const server = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end() }
  cors(res)

  if (path === '/api/health') return sendJson(res, 200, { ok: true, model: MODEL, hasKey: !!API_KEY, defaultBase: BASE_URL, hdc: HDC })

  // ---- Claude 转发（SSE 流式） ----
  if (path === '/api/ai' && req.method === 'POST') {
    // 配置优先级：请求 header（网站 UI 填的） > 请求 body > 环境变量
    // 注意 body.model 不能盖过 header —— 前端历史代码可能硬编码了 claude-sonnet-5，
    // 必须让用户在 UI 填的真实模型（header）优先生效，否则会报 model does not exist。
    const key = req.headers['x-ai-key'] || API_KEY
    const base = req.headers['x-ai-base'] || BASE_URL
    const hdrModel = req.headers['x-ai-model']
    const model = hdrModel || MODEL
    if (!key) return sendJson(res, 500, { error: '未配置 API Key：在网站「AI 设置」里填，或服务端设 ANTHROPIC_API_KEY' })
    let body
    try { body = JSON.parse(await readBody(req)) } catch { return sendJson(res, 400, { error: '请求体不是合法 JSON' }) }
    const payload = {
      model: hdrModel || body.model || model,
      max_tokens: body.max_tokens || 4096,
      stream: true,
      messages: body.messages || [],
      ...(body.system ? { system: body.system } : {}),
    }
    const u = resolveUpstream(base)
    const upstream = u.mod.request({
      hostname: u.hostname,
      port: u.port,
      path: u.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream',
      },
    }, up => {
      // 上游非 2xx：透传状态码，前端按 !res.ok 走 onError。
      res.writeHead(up.statusCode, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      })
      // 不用裸 up.pipe(res)：DashScope 的 SSE 在 message_stop 后可能不关 TCP（HTTP keep-alive），
      // 导致 res 永不 end、连接泄漏堆积、最终拖死代理事件循环。
      // 这里改为缓冲扫描：边透传边检测终止信号（message_stop / [DONE] / error event），
      // 一旦命中就主动 res.end()，保证响应必然收尾。
      let stopped = false
      let tail = ''
      let nbytes = 0
      const STOP_RE = /"type"\s*:\s*"message_stop"|\[DONE\]|"type"\s*:\s*"error"/
      up.on('data', chunk => {
        if (stopped) return
        nbytes += chunk.length
        const s = chunk.toString('utf8')
        res.write(chunk)
        const scan = tail.length > 200 ? tail.slice(-200) : tail
        if (STOP_RE.test(scan + s)) {
          stopped = true
          console.log(`[ai-proxy] ai stop-signal hit, bytes=${nbytes}`)
          try { res.end() } catch {}
          try { up.destroy() } catch {}
        } else {
          tail = (scan + s).slice(-300)
        }
      })
      up.on('end', () => { console.log(`[ai-proxy] ai up:end bytes=${nbytes} stopped=${stopped}`); try { res.end() } catch {} })
      up.on('error', e => { console.log(`[ai-proxy] ai up:error ${e.message}`); try { res.end() } catch {} })
      up.on('aborted', () => { console.log(`[ai-proxy] ai up:aborted`); try { res.end() } catch {} })
      up.on('close', () => { console.log(`[ai-proxy] ai up:close`); try { if (!stopped) res.end() } catch {} })
    })
    // 客户端断开（浏览器点停止 / curl 超时）必须销毁上游连接，
    // 否则 DashScope 思考流会继续吐 max_tokens 字符到死 res，泄漏长连接把代理拖死。
    let clientClosed = false
    const abortUpstream = () => {
      if (clientClosed) return
      clientClosed = true
      console.log('[ai-proxy] ai req:close → destroy upstream')
      try { upstream.destroy() } catch {}
    }
    req.on('close', abortUpstream)
    req.on('aborted', abortUpstream)
    upstream.on('error', e => {
      console.log(`[ai-proxy] ai upstream:error ${e.message}`)
      try { req.removeListener('close', abortUpstream) } catch {}
      if (!res.headersSent) sendJson(res, 502, { error: `上游错误：${e.message}` })
      else { try { res.end() } catch {} }
    })
    upstream.write(JSON.stringify(payload))
    return upstream.end()
  }

  // ---- AI 连通性测试（非流式，max_tokens=1）----
  if (path === '/api/ai/test' && req.method === 'POST') {
    const key = req.headers['x-ai-key'] || API_KEY
    const base = req.headers['x-ai-base'] || BASE_URL
    const model = req.headers['x-ai-model'] || MODEL
    if (!key) return sendJson(res, 200, { ok: false, error: '未配置 API Key' })
    const u = resolveUpstream(base)
    const payload = { model, max_tokens: 1, stream: false, messages: [{ role: 'user', content: 'ping' }] }
    let responded = false
    const respond = (obj) => { if (responded) return; responded = true; sendJson(res, 200, obj) }
    console.log(`[ai-proxy] test → ${u.mod === http ? 'http' : 'https'}://${u.hostname}:${u.port}${u.path} model=${model}`)
    const r = u.mod.request({
      hostname: u.hostname, port: u.port, path: u.path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    }, up => {
      let data = ''
      up.on('data', d => { data += d })
      up.on('end', () => {
        const ok = up.statusCode && up.statusCode < 400
        let err = ''
        if (!ok) {
          try { const j = JSON.parse(data); err = j.error?.message || j.error || j.message || data }
          catch { err = data.slice(0, 300) }
        }
        console.log(`[ai-proxy] test ← status=${up.statusCode} ok=${ok} ${err ? 'err=' + err.slice(0, 120) : ''}`)
        respond({ ok, status: up.statusCode, model, error: err })
      })
    })
    r.on('error', e => { console.log(`[ai-proxy] test ✗ ${e.message}`); respond({ ok: false, error: `上游连接失败：${e.message}（检查 Base URL 是否正确）` }) })
    r.setTimeout(15000, () => { console.log('[ai-proxy] test 超时'); r.destroy(); respond({ ok: false, error: '上游响应超时（>15s）：Base URL 不通或网关太慢' }) })
    r.write(JSON.stringify(payload))
    return r.end()
  }

  // ---- 当前代码（真机闭环）----
  if (path === '/api/code/current' && req.method === 'POST') {
    try {
      currentCode = await readBody(req)
      currentTs = Date.now()
      return sendJson(res, 200, { ok: true, ts: currentTs, len: currentCode.length })
    } catch (e) { return sendJson(res, 500, { ok: false, error: String(e.message || e) }) }
  }
  if (path === '/api/code/current' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, ts: currentTs, code: currentCode })
  }

  // ---- hdc 状态 ----
  if (path === '/api/hdc/status' && req.method === 'GET') {
    try {
      const out = await hdc(['list', 'targets'])
      const targets = out.split(/\r?\n/).map(s => s.trim()).filter(s => s && s !== '[Empty]' && !s.toLowerCase().includes('empty'))
      return sendJson(res, 200, { ok: true, hdc: HDC, targets })
    } catch (e) { return sendJson(res, 200, { ok: false, hdc: HDC, error: String(e.message || e) }) }
  }

  // ---- hdc 屏幕流（MJPEG） ----
  if (path === '/api/hdc/stream' && req.method === 'GET') {
    const boundary = 'arktsboundary'
    res.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
    })
    let closed = false
    req.on('close', () => { closed = true })
    // 设备端 snapshot_display 要求后缀 .jpeg（.png 会被拒：suffix must be .jpeg）；
    // 用 .jpeg 全链路，MJPEG 帧也标 image/jpeg。
    const DEV_SNAP = '/data/local/tmp/_proxy_snap.jpeg'
    const framePath = join(tmpdir(), 'arkts_proxy_snap.jpeg')
    const waitMs = Math.max(80, Math.round(1000 / HDC_FPS))
    async function capture() {
      // 先清掉可能的残留文件，避免 recv 到旧帧
      try { await hdc(['shell', 'rm', '-f', DEV_SNAP], { timeout: 2000 }) } catch {}
      // snapshot_display 优先（现代 HarmonyOS 标配）；失败回退 screencap（老系统）
      try {
        await hdc(['shell', 'snapshot_display', '-f', DEV_SNAP], { timeout: 4000 })
      } catch {
        await hdc(['shell', 'screencap', '-p', DEV_SNAP], { timeout: 4000 })
      }
      await hdc(['file', 'recv', DEV_SNAP, framePath], { timeout: 4000 })
      const buf = readFileSync(framePath)
      if (!buf || buf.length < 100) throw new Error('截图为空或过小')
      res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`)
      res.write(buf)
      res.write('\r\n')
    }
    async function loop() {
      while (!closed) {
        try { await capture() }
        catch (e) {
          // 设备掉线/截图失败：写一帧错误提示文字图（保持连接，前端可见降级）
          const msg = `ArkTS 真机流：${String(e.message || e).slice(0, 80)}`
          res.write(`--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${msg}\r\n`)
        }
        await new Promise(r => setTimeout(r, waitMs))
      }
    }
    loop().catch(() => { try { res.end() } catch {} })
    return
  }

  // ---- hdc 推送代码（Phase 2 钩子）----
  if (path === '/api/hdc/push-code' && req.method === 'POST') {
    try {
      const raw = await readBody(req)
      const dir = join(tmpdir(), 'arkts_proxy')
      mkdirSync(dir, { recursive: true })
      const local = join(dir, 'last.ets')
      writeFileSync(local, raw, 'utf8')
      const remote = '/data/local/tmp/arkts_proxy/last.ets'
      await hdc(['shell', 'mkdir', '-p', '/data/local/tmp/arkts_proxy'])
      await hdc(['file', 'send', local, remote])
      return sendJson(res, 200, { ok: true, remote })
    } catch (e) { return sendJson(res, 500, { ok: false, error: String(e.message || e) }) }
  }

  // ---- hdc 拉起 native-editor + 反向端口转发 ----
  // 让设备轮询宿主 ai-proxy：rport 使设备 127.0.0.1:5174 → 宿主 5174（IP 无关，
  // USB/WiFi 通用，换网不破；等价 adb reverse）。然后 aa start 把 native-editor 拉到前台。
  if (path === '/api/hdc/launch' && req.method === 'POST') {
    const out = { ok: true, forwarded: false, launched: false, error: '' }
    // rport 已存在会非零退出，忽略——fport ls 能确认转发在不在即可
    try { await hdc(['rport', 'tcp:5174', 'tcp:5174'], { timeout: 4000 }); out.forwarded = true }
    catch (e) { out.error += `rport: ${String(e.message || e).slice(0, 120)}; ` }
    try { await hdc(['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'com.leoli.arktseditor'], { timeout: 5000 }); out.launched = true }
    catch (e) { out.error += `aa start: ${String(e.message || e).slice(0, 120)}` }
    return sendJson(res, 200, out)
  }

  return sendJson(res, 404, { error: 'not found' })
  } catch (e) {
    // 全局错误陷阱：任何隐藏抛错都带原因返回，便于前端定位（不再空 500）
    console.error('[ai-proxy] unhandled error:', e)
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: '代理内部错误：' + (e && e.message ? e.message : String(e)) })
    else { try { res.end() } catch {} }
  }
})

server.listen(PORT, () => {
  console.log(`[ai-proxy] http://localhost:${PORT}  upstream=${BASE_URL}  model=${MODEL}  key=${API_KEY ? '✓' : '✗（未配置）'}  hdc=${HDC}`)
  console.log(`[ai-proxy] 前端来源 ${ORIGIN}`)
})

// ---------- WebSocket hub：浏览器 ↔ 设备 低延迟控制通道 ----------
// 像素仍走 MJPEG HTTP（/api/hdc/stream）；WS 只过控制（code/drag-*/capture）与几何（geometry/rendered）。
// query ?role=device|browser 标识身份；message 按 type 路由转发到对端。
const wss = new WebSocketServer({ server, path: '/api/ws' })
let browserWs = null
let deviceWs = null
const TO_BROWSER = new Set(['geometry', 'rendered'])       // device → browser
const TO_DEVICE = new Set(['code', 'drag-start', 'drag-delta', 'drag-end', 'capture']) // browser → device
wss.on('connection', (ws, req) => {
  const u = new URL(req.url, `http://localhost:${PORT}`)
  const role = u.searchParams.get('role')
  if (role === 'device') { deviceWs = ws; console.log('[ai-proxy] ws: device connected') }
  else { browserWs = ws; console.log('[ai-proxy] ws: browser connected') }
  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }
    if (msg.type === 'hello') { if (msg.role === 'device') deviceWs = ws; else browserWs = ws; return }
    const s = data.toString()
    if (TO_BROWSER.has(msg.type)) { try { if (browserWs) browserWs.send(s) } catch {} return }
    if (TO_DEVICE.has(msg.type)) { try { if (deviceWs) deviceWs.send(s) } catch {} return }
    // 未知 type：静默丢弃（不转发，避免环路）
  })
  ws.on('close', () => {
    if (ws === browserWs) browserWs = null
    if (ws === deviceWs) deviceWs = null
    console.log(`[ai-proxy] ws closed (browser=${browserWs ? 1 : 0} device=${deviceWs ? 1 : 0})`)
  })
  ws.on('error', () => {})
})
console.log(`[ai-proxy] ws hub at /api/ws`)
