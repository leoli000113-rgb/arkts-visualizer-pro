import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        // /api 前缀转发到 ai-proxy（Claude 转发 + hdc 屏幕流）
        proxy: {
            '/api': {
                target: 'http://localhost:5174',
                changeOrigin: true,
                // MJPEG 屏幕流需要关掉压缩与超时，否则长连接被截断
                ws: false,
                configure: function (proxy) {
                    proxy.on('proxyReq', function (req) { req.setHeader('Connection', 'keep-alive'); });
                },
            },
        },
    },
});
