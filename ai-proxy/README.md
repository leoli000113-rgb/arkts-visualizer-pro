# ai-proxy — ArkTS Visualizer AI 代理

零依赖纯 Node 服务，给 Web 版可视化编辑器提供两项能力：

1. **Claude API 转发**（`POST /api/ai`，SSE 流式）—— 密钥只在服务端，前端不暴露。
2. **hdc 真机屏幕流**（`GET /api/hdc/stream`，MJPEG）—— 把跑着的鸿蒙模拟器/真机屏幕投到 Web 画布旁，实现真机级高保真。

## 启动

```bash
cd ai-proxy
node server.js          # http://localhost:5174
```

无需 `npm install`（零依赖）。首次运行前复制 `.env.example` 为 `.env` 并填值。

## 配置（.env 或环境变量；环境变量优先）

| 变量 | 说明 |
|---|---|
| `ANTHROPIC_API_KEY` | **必填**。你的 API 密钥。Claude Code 的密钥在凭据库里，需手动复制到此处（我不会替你读）。 |
| `ANTHROPIC_BASE_URL` | 上游网关。留空走官方 `api.anthropic.com`；若你的配置走自定义网关（qwen/glm/openai 兼容代理），填这里。形如 `https://api.example.com` 或 `.../v1`。 |
| `ANTHROPIC_MODEL` | 默认模型，默认 `claude-sonnet-5`。 |
| `HDC_BIN` | hdc 可执行路径。留空自动探测 DevEco 默认安装路径。 |
| `HDC_FPS` | 屏幕流帧率 1–15，默认 6。 |
| `PORT` | 端口，默认 5174。 |
| `ORIGIN` | 允许的前端来源（CORS），默认 `http://localhost:5173`。 |

## 接口

- `GET /api/health` —— `{ ok, model, hasKey, hdc }`
- `POST /api/ai` —— body: `{ model?, max_tokens?, system?, messages }`；流式返回 Claude SSE（前端用 `fetch` + `ReadableStream` 解析 `data:` 行）。
- `GET /api/hdc/status` —— `{ ok, hdc, targets[] }`，探测连接的设备。
- `GET /api/hdc/stream` —— `multipart/x-mixed-replace` MJPEG，前端 `<img src>` 直消费。
- `POST /api/hdc/push-code` —— body = .ets 文本；写到设备 `/data/local/tmp/arkts_proxy/last.ets`（Phase 2：native-editor 轮询该文件实现"代码→真机"闭环）。

## 与 Web 前端的连接

`app/vite.config.ts` 已配 `/api` 代理到 `localhost:5174`。开发时 `npm run dev` 自动转发；生产构建需把本服务与静态站同源部署（或改 `app/src/ai/client.ts` 的 `BASE` 为绝对地址）。

## 工作流（端到端）

1. `node server.js` 启动代理。
2. `cd app && npm run dev` 启动前端。
3. 顶栏「✦ AI」→ 描述界面 → 流式生成 .ets → 自动 `setCode` → 画布 + 代码窗同步。
4. 连上鸿蒙模拟器/真机，顶栏「📱 真机」→ 画布旁显示真机屏幕实时画面（真 ArkUI 布局，1:1 保真）。

## Phase 2（未实现，预留钩子）

- `POST /api/hdc/push-code` 已就绪：把生成的 .ets 推到设备文件，native-editor 轮询载入即可实现"AI 生成 → 真机渲染"闭环。
- 当前 native-editor 从自身 UI 载入代码，需加一个文件监听以消费 `/data/local/tmp/arkts_proxy/last.ets`。
