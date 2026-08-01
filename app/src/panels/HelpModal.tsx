const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y', desc: '撤销 / 重做（50 步，连续手势合并为一步）' },
  { keys: 'Ctrl+C / Ctrl+X / Ctrl+V', desc: '复制 / 剪切 / 粘贴选中组件（粘贴遵循容器约束）' },
  { keys: '复制/剪切后 = 粘贴模式', desc: '点击容器放入其内部、点击组件放到其后，可连续点击多处；Esc 或点空白退出' },
  { keys: 'Ctrl+D', desc: '创建选中组件的副本' },
  { keys: 'Delete', desc: '删除选中组件' },
  { keys: '拖拽', desc: '组件面板 → 画布/大纲树：容器中部 = 放入内部就近位置，边缘窄带 = 前/后插入（Scroll 等独子容器自动放入内层；树内悬停收合容器 0.6s 自动展开）' },
  { keys: '右键 → 调整位置', desc: '进入位置调整模式：拖拽只改偏移不动结构，方向键微调（Shift ×10），Esc 退出' },
  { keys: '大纲树行悬停', desc: '＋ 插入组件（容器进内部/叶子到下方）· ⧉ 副本 · ✕ 删除' },
  { keys: '面板首部右键', desc: '面板/代码/属性面板：停靠到左/右/底，或重置布局（大纲树为固定条，宽度可拖）' },
  { keys: '大纲树首部 «', desc: '收合大纲树为窄条（点击窄条任意处展开）；默认展开，状态记忆' },
  { keys: '面板边缘把手', desc: '拖拽调整面板宽高；停靠区内缘把手调整整区尺寸' },
  { keys: 'Alt + 拖拽', desc: '任意组件自由偏移（.offset，不改结构）——等同右键「调整位置」的快捷方式' },
  { keys: '右/下/右下角把手', desc: '拖拽改组件宽 / 高 / 同时改' },
  { keys: '右键', desc: '画布或大纲树上打开节点菜单（包裹容器/上移下移/复制代码等）' },
  { keys: 'Stack 内拖放', desc: '按坐标自由摆放（自动写 .position）' },
  { keys: '缩放条', desc: '画布左上角：−/+ 缩放，点百分比重置 100%，「适应」缩放到窗口大小' },
  { keys: '顶栏「系统栏」', desc: '显示/隐藏手机状态栏与底部导航条：应用区避开安全区（与真机非沉浸布局一致），默认开启' },
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
