import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // /api 前缀转发到 ai-proxy（Claude 转发 + hdc 屏幕流）
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        // MJPEG 屏幕流需要关掉压缩与超时，否则长连接被截断。
        // WS 控制通道不经 vite 代理——app/src/ai/ws.ts 直连 ai-proxy 5174
        // （WS 无 CORS 预检，跨端口可连，且免 vite 重启）。
        ws: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (req) => { req.setHeader('Connection', 'keep-alive') })
        },
      },
    },
  },
})
