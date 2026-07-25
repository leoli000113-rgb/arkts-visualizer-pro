# ArkTS 可视化编辑器 Pro

基于 [ArkTS-UI-Visualizer](https://github.com/) 改造扩展的 ArkTS/HarmonyOS 可视化 UI 编辑器。

## 功能

- 导入 `.ets` 文件 → 可视化预览 → 拖拽编辑 → 导出代码
- 支持 25+ ArkUI 组件（Text/Button/Image/Row/Column/Stack/Grid/List/Tabs/TextInput/Toggle/Slider 等）
- 三大面板：基础组件 / 复合组件库 / 页面模板
- 28 个页面模板，分 7 大类（基础/首页/列表/表单/网格/个人中心/卡片）
- 9 个复合组件（卡片/列表项/搜索栏/用户头部/按钮组等）
- 设备适配（Mate 80 Pro Max / Mate X7 折叠屏 / Pura X Max 翻盖屏）
- 撤销重做 / 大纲树 / 属性面板 / 右键菜单
- 纯前端，无后端，localStorage 持久化

## 快速开始

```bash
cd app
npm install
npm run dev
```

浏览器打开 http://localhost:5173

或双击项目根目录 `start.bat` 一键启动。

## 技术栈

React 18 + Vite + TypeScript + Zustand

## 项目结构

```
app/src/
├── parser/       .ets → IR 解析器
├── ir/           IR 数据模型 / 序列化 / 校验
├── renderer/     IR → React DOM 渲染器
├── editor/       拖拽 / 大纲树 / 属性面板 / 右键菜单
├── templates/    28 个页面模板（7 大类）
├── library/      9 个复合组件
├── devices/      设备档案
└── store/        Zustand 状态管理
```

## 模板分类

| 分类 | 数量 | 模板 |
|------|------|------|
| 基础 | 4 | 空白页/空状态/骨架屏/错误页 |
| 首页 | 5 | 标准首页/仪表盘/Tab首页/分类导航/极简首页 |
| 列表 | 4 | 图文列表/消息列表/卡片列表/设置列表 |
| 表单 | 4 | 登录/注册/搜索/反馈 |
| 网格 | 4 | 九宫格/图片画廊/商品网格/功能网格 |
| 个人中心 | 3 | 基础/详细/设置页 |
| 卡片 | 4 | 商品/文章/用户/数据卡片 |

## License

MIT
