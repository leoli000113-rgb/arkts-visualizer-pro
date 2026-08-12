import { useStore } from '../store/store'
import { postCurrentCode } from './client'

/**
 * WebSocket 客户端：浏览器 ↔ ai-proxy WS hub ↔ native-editor（设备，走 hdc rport）。
 * 代码走 WS（替代 1.5s 轮询）；设备渲染后回发 geometry/rendered。
 * 像素仍走 MJPEG HTTP（<img src>，高效），控制 + 几何走本 WS。
 *
 * 直连 ai-proxy 5174（不经 vite 代理）：vite 的 WS 升级代理需重启才生效，且直连
 * 对本地开发工具更稳——WS 无 CORS 预检，`ws` 库默认不校验 Origin，跨端口可连。
 * MJPEG 仍走 vite /api 代理（HTTP，不受 ws 配置影响）。
 */
// 模块顶层不能直接读 location：vitest/node 环境无全局 location，会在 import 时抛
// ReferenceError 拖死所有经 dnd.ts 间接引入本模块的测试。延迟到连接时再取。
function wsUrl(): string {
  const proto = (typeof location !== 'undefined' && location.protocol === 'https:') ? 'wss' : 'ws'
  return `${proto}://localhost:5174/api/ws?role=browser`
}

let ws: WebSocket | null = null
let connected = false
let reconnectTimer = 0
let started = false

/** 当前 WS 是否连上（sendCode 据此决定走 WS 还是降级 HTTP） */
export function wsConnected(): boolean {
  return connected
}

/** 连接 ai-proxy WS hub（幂等，仅启动一次；断线自动重连 1.5s） */
export function connectWs(): void {
  if (started) return
  started = true
  open()
}

function open(): void {
  try {
    ws = new WebSocket(wsUrl())
  } catch {
    ws = null
    scheduleReconnect()
    return
  }
  ws.onopen = () => {
    connected = true
    useStore.getState().setWsOnline(true)
    console.log('[ws] browser → ai-proxy connected')
  }
  ws.onclose = () => {
    connected = false
    ws = null
    useStore.getState().setWsOnline(false)
    scheduleReconnect()
  }
  ws.onerror = () => { /* onclose 会接管重连 */ }
  ws.onmessage = onMessage
}

function scheduleReconnect(): void {
  window.clearTimeout(reconnectTimer)
  reconnectTimer = window.setTimeout(open, 1500)
}

interface GeoRect { path: string; x: number; y: number; w: number; h: number }
interface WsInMsg {
  type: string
  rects?: GeoRect[]
}

function onMessage(ev: MessageEvent): void {
  let msg: WsInMsg
  try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '') } catch { return }
  if (msg.type === 'geometry' && msg.rects) {
    const m = new Map<string, { x: number; y: number; w: number; h: number }>()
    for (const r of msg.rects) m.set(r.path, { x: r.x, y: r.y, w: r.w, h: r.h })
    useStore.getState().setGeo(m)
  } else if (msg.type === 'rendered') {
    useStore.getState().setRenderedTs(Date.now())
  }
}

/** 发送代码到设备：WS 连上走 WS，否则降级 HTTP postCurrentCode（轮询兼容） */
export function sendCode(code: string): void {
  if (ws !== null && connected) {
    try { ws.send(JSON.stringify({ type: 'code', code })) } catch { /* 静默 */ }
  } else {
    void postCurrentCode(code)
  }
}

/** 拖拽控制（P4 用，P1 先占位） */
export function sendDragStart(geoKey: string, irPath: string): void {
  if (ws !== null && connected) {
    try { ws.send(JSON.stringify({ type: 'drag-start', geoKey, irPath })) } catch { /* 静默 */ }
  }
}
export function sendDragDelta(dx: number, dy: number): void {
  if (ws !== null && connected) {
    try { ws.send(JSON.stringify({ type: 'drag-delta', dx, dy })) } catch { /* 静默 */ }
  }
}
export function sendDragEnd(): void {
  if (ws !== null && connected) {
    try { ws.send(JSON.stringify({ type: 'drag-end' })) } catch { /* 静默 */ }
  }
}
