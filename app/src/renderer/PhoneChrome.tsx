/**
 * 手机系统栏（状态栏/底部手势条）——画布（App.tsx）与模板缩略图（TemplateThumb）
 * 共用同一份标记，保证两者应用区高度一致、视觉完全对齐。
 */
export function StatusBar() {
  return (
    <div className="status-bar" title="手机状态栏（安全区）：应用内容从其下方开始">
      <span className="sb-time">10:08</span>
      <span className="sb-icons">
        <svg width="11" height="8" viewBox="0 0 11 8" aria-hidden="true">
          <rect x="0" y="5" width="2" height="3" rx="0.5" fill="currentColor" />
          <rect x="3" y="3.5" width="2" height="4.5" rx="0.5" fill="currentColor" />
          <rect x="6" y="2" width="2" height="6" rx="0.5" fill="currentColor" />
          <rect x="9" y="0.5" width="2" height="7.5" rx="0.5" fill="currentColor" opacity="0.35" />
        </svg>
        <svg width="11" height="8" viewBox="0 0 12 9" aria-hidden="true">
          <path d="M6 8.2 4.1 6.2a2.7 2.7 0 0 1 3.8 0L6 8.2z" fill="currentColor" />
          <path d="M2.6 4.7a4.9 4.9 0 0 1 6.8 0L8 6.1a2.9 2.9 0 0 0-4 0l-1.4-1.4z" fill="currentColor" />
          <path d="M0.9 3a7.4 7.4 0 0 1 10.2 0l-1.3 1.3a5.4 5.4 0 0 0-7.6 0L0.9 3z" fill="currentColor" />
        </svg>
        <svg width="15" height="8" viewBox="0 0 16 9" aria-hidden="true">
          <rect x="0.5" y="0.5" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.5" />
          <rect x="2" y="2" width="8" height="5" rx="1" fill="currentColor" />
          <rect x="13.5" y="3" width="2" height="3" rx="1" fill="currentColor" fillOpacity="0.5" />
        </svg>
      </span>
    </div>
  )
}

export function NavBar() {
  return (
    <div className="nav-bar" title="底部导航条（安全区）：手势横条区域">
      <span className="nav-pill" />
    </div>
  )
}
