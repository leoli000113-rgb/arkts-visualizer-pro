import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useStore } from './store/store'
import './index.css'

// 调试/自动化钩子（E2E 验证用，UI 不引用）
;(window as unknown as { __store: unknown }).__store = { useStore }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
