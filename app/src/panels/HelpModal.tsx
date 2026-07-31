const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y', desc: '撤销 / 重做（50 步，连续手势合并为一步）' },
  { keys: 'Ctrl+C / Ctrl+X / Ctrl+V', desc: '复制 / 剪切 / 粘贴选中组件（粘贴遵循容器约束）' },
  { keys: 'Ctrl+D', desc: '创建选中组件的副本' },
  { keys: 'Delete', desc: '删除选中组件' },
  { keys: '拖拽', desc: '组件面板 → 画布/大纲树：边缘 30% = 前/后插入，中部 = 放入容器（Scroll 等独子容器自动放入内层）' },
  { keys: '大纲树行悬停', desc: '＋ 插入组件（容器进内部/叶子到下方）· ⧉ 副本 · ✕ 删除' },
  { keys: '面板首部右键', desc: '大纲树/代码/属性等面板：停靠到左/右/顶/底，或重置布局' },
  { keys: '面板边缘把手', desc: '拖拽调整面板宽高；停靠区内缘把手调整整区尺寸' },
  { keys: 'Alt + 拖拽', desc: '任意组件自由偏移（.offset，不改结构）' },
  { keys: '右/下/右下角把手', desc: '拖拽改组件宽 / 高 / 同时改' },
  { keys: '右键', desc: '画布或大纲树上打开节点菜单（包裹容器/上移下移/复制代码等）' },
  { keys: 'Stack 内拖放', desc: '按坐标自由摆放（自动写 .position）' },
  { keys: '缩放条', desc: '画布左上角：−/+ 缩放，点百分比重置 100%，「适应」缩放到窗口大小' },
]

/** 快捷键与手势说明弹窗（顶栏 ? 按钮触发） */
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="dev-overlay" onClick={onClose}>
      <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dev-head">
          <span>快捷键与手势</span>
          <button className="dev-close" onClick={onClose}>×</button>
        </div>
        <div className="help-list">
          {SHORTCUTS.map((s) => (
            <div className="help-row" key={s.keys}>
              <kbd>{s.keys}</kbd>
              <span>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
