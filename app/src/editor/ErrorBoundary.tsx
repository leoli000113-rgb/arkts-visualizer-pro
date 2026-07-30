import React from 'react'
import { useStore } from '../store/store'

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/**
 * 渲染兜底：画布/面板任何渲染异常不再白屏（React 整树卸载），
 * 而是显示错误面板 + 完整错误信息，可一键重置为示例代码恢复。
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="err-boundary">
        <div className="err-box">
          <div className="err-title">界面渲染出错（已拦截，未白屏）</div>
          <pre className="err-msg">{String(error?.message || error)}</pre>
          <div className="err-actions">
            <button onClick={() => this.setState({ error: null })}>重试渲染</button>
            <button onClick={() => { useStore.getState().resetToSample(); this.setState({ error: null }) }}>
              重置为示例代码
            </button>
          </div>
          <div className="err-hint">如果由刚导入的代码触发，请把代码与上方错误信息反馈给维护者</div>
        </div>
      </div>
    )
  }
}
