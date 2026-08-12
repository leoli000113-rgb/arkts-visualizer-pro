import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { pasteboard, BusinessError } from '@kit.BasicServicesKit';
import { picker } from '@kit.CoreFileKit';
import http from '@ohos.net.http';
import webSocket from '@ohos.net.webSocket';
import fs from '@ohos.file.fs';
import { util } from '@kit.ArkTS';
import { parse } from '../core/parser';
import { serialize } from '../core/serialize';
import { IRFile, IRNode } from '../core/ir';
import { buildScope } from '../core/exprEval';
import {
  deleteAtPath, duplicateAtPath, insertAuto, keyToPath, moveBy, nodeAtPath, pathKey,
  readNumModifier, readOffset, readStrModifier, readTextArg,
  setColorModifier, setLengthModifier, setTextArg,
} from '../core/mutate';
import { CONTAINER_TYPES, newNodeFor } from '../core/factory';
import { TEMPLATE_CATEGORIES, Template, TemplateCategory } from '../core/templates';
import { EditorCanvas, PreviewController, GeoRectEntry } from '../render/EditorCanvas';
import { flattenOutline, OutlineRow, OutlineTree } from '../panels/OutlineTree';

const TAG = 'ArkTsEditor';

/** 画布样例（新建页面时的初始内容） */
const SAMPLE: string = `@Entry
@Component
struct SamplePage {
  @State count: number = 0

  build() {
    Column() {
      Text('标题')
        .fontSize(20)
        .margin({ top: 20, bottom: 12 })
      Row({ space: 8 }) {
        Button('主要按钮')
          .backgroundColor('#0A59F7')
        Button('次要')
          .backgroundColor('#e5e5ea')
          .fontColor('#333333')
      }
      .margin({ bottom: 16 })
      Scroll() {
        Column({ space: 6 }) {
          Text('滚动项 1').fontSize(14)
          Text('滚动项 2').fontSize(14)
          Text('滚动项 3').fontSize(14)
        }
        .alignItems(HorizontalAlign.Start)
        .padding(12)
      }
      .layoutWeight(1)
      .backgroundColor('#f5f5f5')
      .borderRadius(8)
      ForEach([1, 2, 3], (it: number) => {
        Text('item')
      }, (it: number) => String(it))
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#ffffff')
  }
}
`;

interface PageItem {
  name: string
  file: IRFile
}

/** ai-proxy WS 消息（device 收到的：code 推送 / 远程拖拽）。 */
interface WsMsg {
  type: string
  code?: string
  geoKey?: string
  irPath?: string
  dx?: number
  dy?: number
}

/** 设备→浏览器 的 WS 出站消息（ArkTS 要求字面量对应声明的接口） */
interface WsOutMsg {
  type: string
  rects?: GeoRectEntry[]
}

/** 设备上线主动登记角色的 hello 消息 */
interface WsHelloMsg {
  type: string
  role: string
}

/** ai-proxy /api/code/current 的响应（真机闭环轮询） */
interface ProxyResp {
  ok: boolean
  ts: number
  code: string
}

/**
 * 编辑器主页：左组件库（点击添加）｜中画布/代码视图｜右大纲树 + 属性面板
 * 顶栏：页面标签 + 导入/导出/代码/移动模式
 */
@Entry
@Component
struct Index {
  @State statusText: string = '就绪';
  @State topPad: number = 0;
  @State selPath: string = '';
  @State moveMode: boolean = false;
  @State showCode: boolean = false;
  @State code: string = '';
  @State ver: number = 0;
  @State rows: OutlineRow[] = [];
  @State showSel: boolean = false;
  @State selX: number = 0;
  @State selY: number = 0;
  @State selW: number = 0;
  @State selH: number = 0;
  @State pageNames: string[] = [];
  @State curPage: number = 0;
  @State showTemplates: boolean = false;
  @State canUndo: boolean = false;
  @State canRedo: boolean = false;
  // 全屏预览模式：隐藏编辑器外壳（顶栏/状态行/组件库/大纲/属性），只留画布全屏渲染。
  // 远端（Web）推来代码时自动进入；真机点「✕ 退出预览」回编辑器。
  @State previewMode: boolean = false;
  private pages: PageItem[] = [];
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private previewCtl: PreviewController = new PreviewController();
  private collapsed: Set<string> = new Set();
  private canvasOX: number = 0;
  private canvasOY: number = 0;
  private panLastX: number = 0;
  private panLastY: number = 0;
  private pending: Map<string, string> = new Map();
  /** 几何键：画布点选时可能带 ForEach 实例后缀（'0.3#1.0'），只用于定位/直写，不用于 IR 操作 */
  private selGeoKey: string = '';
  private dragging: boolean = false;
  private dragBaseX: number = 0;
  private dragBaseY: number = 0;
  private dragAccX: number = 0;
  private dragAccY: number = 0;
  private selTimer: number = -1;

  // —— 真机闭环：轮询 ai-proxy 拉取 Web 端生成的最新 .ets ——
  // 真机经 hdc rport 反向转发：设备 127.0.0.1:5174 → 宿主 ai-proxy:5174（IP 无关）。
  // 模拟器改回 '10.0.2.2'（模拟器专用别名，不走 rport）。
  private proxyHost: string = '127.0.0.1';
  private proxyPort: number = 5174;
  private proxyTimer: number = -1;
  private proxyLastTs: number = 0;

  // —— WebSocket 低延迟通道（主路径：代码/拖拽经此推送；轮询保留作 fallback）——
  private ws: webSocket.WebSocket | null = null;
  private wsConnected: boolean = false;
  private wsReconnectTimer: number = -1;
  // 远程拖拽基线/累积（镜像本机 PanGesture 的 dragBaseX/Y、dragAccX/Y 语义）
  private rDragBaseX: number = 0;
  private rDragBaseY: number = 0;
  private rDragAccX: number = 0;
  private rDragAccY: number = 0;

  private curFile(): IRFile {
    return this.pages[this.curPage].file;
  }

  aboutToAppear(): void {
    this.pages = [{ name: 'SamplePage', file: parse(SAMPLE) }];
    this.pageNames = this.pages.map(p => p.name);
    // 沉浸式全屏下避让状态栏（avoidArea 返回 px，转 vp）
    const hostCtx = this.getUIContext().getHostContext();
    if (hostCtx !== undefined) {
      window.getLastWindow(hostCtx).then((win: window.Window) => {
        const area = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
        if (area.visible) {
          this.topPad = this.getUIContext().px2vp(area.topRect.height);
        }
      }).catch((e: BusinessError) => {
        hilog.error(0x0000, TAG, 'avoidArea failed: %{public}s', JSON.stringify(e));
      });
    }
    this.previewCtl.onTapNode = (p: string) => this.onNodeTap(p);
    // 选中框跟随轮询：滚动/布局/窗口变化时自动重新对齐（值不变不写状态，空闲零开销）
    this.selTimer = setInterval(() => this.syncSelRect(), 120);
    // 真机闭环：轮询 ai-proxy 拉取最新 .ets（Web 端生成后 POST 到 /api/code/current）
    this.proxyTimer = setInterval(() => this.pollProxy(), 1500);
    // WebSocket 主路径：代码/拖拽经此推送（比 1.5s 轮询快一个量级）；轮询保留作 fallback
    this.connectWs();
    this.refreshTree();
  }

  aboutToDisappear(): void {
    if (this.selTimer >= 0) {
      clearInterval(this.selTimer);
      this.selTimer = -1;
    }
    if (this.proxyTimer >= 0) {
      clearInterval(this.proxyTimer);
      this.proxyTimer = -1;
    }
    if (this.wsReconnectTimer >= 0) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = -1;
    }
    if (this.ws !== null) {
      try { this.ws.close() } catch (e) { hilog.warn(0x0000, TAG, 'ws close: %{public}s', String(e)) }
      this.ws = null;
    }
  }

  /** IR 变化后：重建画布 + 刷新大纲/属性/代码 + 稍后重查选中框（等布局完成） */
  private refreshTree(): void {
    const f = this.curFile();
    this.previewCtl.setTree(f.root, buildScope(f.states));
    this.rows = flattenOutline(f.root, this.collapsed);
    this.code = serialize(f);
    this.ver++;
    setTimeout(() => { this.syncSelRect(); this.emitGeometry(); }, 90);
  }

  // ---------- 真机闭环：轮询 ai-proxy 拉取 Web 生成的 .ets ----------

  /** 拉取 /api/code/current，ts 变化即载入（替换当前页，保留撤销栈）。 */
  private pollProxy(): void {
    const url = `http://${this.proxyHost}:${this.proxyPort}/api/code/current`;
    const req = http.createHttp();
    req.request(url, {
      method: http.RequestMethod.GET,
      expectDataType: http.HttpDataType.STRING,
      connectTimeout: 3000,
      readTimeout: 3000,
    }).then((res) => {
      if (res.responseCode !== 200) return;
      const body = typeof res.result === 'string' ? res.result : '';
      if (body.length === 0) return;
      try {
        const obj = JSON.parse(body) as ProxyResp;
        if (obj.ok && obj.ts > 0 && obj.ts !== this.proxyLastTs) {
          this.proxyLastTs = obj.ts;
          if (obj.code.length > 0) this.loadProxyCode(obj.code);
        }
      } catch (e) {
        hilog.warn(0x0000, TAG, 'proxy parse failed: %{public}s', String(e));
      }
    }).catch((e: BusinessError) => {
      // 代理离线/未启动：静默，下一轮再试
      hilog.debug(0x0000, TAG, 'proxy poll err: %{public}s', JSON.stringify(e));
    }).finally(() => {
      req.destroy();
    });
  }

  /** 把 Web 生成的 .ets 载入当前页（替换内容，进撤销栈，便于回退）。 */
  private loadProxyCode(code: string): void {
    try {
      const ir = parse(code);
      this.snapshot();
      this.pages[this.curPage].file = ir;
      this.pageNames = this.pages.map((p: PageItem) => p.name);
      this.selPath = '';
      this.selGeoKey = '';
      this.showSel = false;
      // 远端推送即进全屏预览：画布撑满，外壳隐藏，Web 端 MJPEG 截到的就是干净保真渲染
      this.moveMode = false;
      this.previewMode = true;
      this.refreshTree();
      this.statusText = `已载入 AI 代码（${ir.structName}）`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      hilog.warn(0x0000, TAG, 'loadProxyCode parse fail: %{public}s', msg);
      this.statusText = `AI 代码解析失败: ${msg}`;
    }
  }

  /** 退出全屏预览，回编辑器外壳。 */
  private exitPreview(): void {
    this.previewMode = false;
  }

  // ---------- WebSocket 低延迟通道（替代轮询主路径）----------

  private connectWs(): void {
    const url = `ws://${this.proxyHost}:${this.proxyPort}/api/ws?role=device`;
    const ws = webSocket.createWebSocket();
    ws.on('open', () => {
      this.wsConnected = true;
      hilog.info(0x0000, TAG, 'ws open');
      // 主动登记角色，防止 ai-proxy deviceWs 指向陈旧连接
      const hello: WsHelloMsg = { type: 'hello', role: 'device' };
      this.wsSend(hello);
    });
    ws.on('message', (err: BusinessError, value: string | ArrayBuffer) => {
      // HarmonyOS 无错时 err 传 undefined（非 null），必须同时排除两者，否则误判出错早退。
      if (err !== null && err !== undefined) {
        hilog.warn(0x0000, TAG, 'ws onmessage err: %{public}s', JSON.stringify(err));
        return;
      }
      const text = typeof value === 'string' ? value : '';
      if (text.length === 0) return;
      this.onWsMessage(text);
    });
    ws.on('close', () => {
      this.wsConnected = false;
      this.ws = null;
      hilog.info(0x0000, TAG, 'ws close, 重连 1.5s');
      this.wsReconnectTimer = setTimeout(() => this.connectWs(), 1500);
    });
    ws.on('error', (err: BusinessError) => {
      hilog.warn(0x0000, TAG, 'ws err: %{public}s', JSON.stringify(err));
    });
    ws.connect(url).then((ok: boolean) => {
      this.ws = ws;
      hilog.info(0x0000, TAG, 'ws connect ok=%{public}s', String(ok));
    }).catch((e: BusinessError) => {
      hilog.warn(0x0000, TAG, 'ws connect fail: %{public}s', JSON.stringify(e));
      this.wsReconnectTimer = setTimeout(() => this.connectWs(), 1500);
    });
  }

  private wsSend(obj: object): void {
    if (this.ws === null || !this.wsConnected) return;
    let s: string;
    try { s = JSON.stringify(obj) } catch (e) { return }
    this.ws.send(s).then(() => {
    }, (e: BusinessError) => {
      hilog.warn(0x0000, TAG, 'ws send: %{public}s', JSON.stringify(e));
    });
  }

  private onWsMessage(text: string): void {
    let msg: WsMsg;
    try { msg = JSON.parse(text) as WsMsg } catch (e) { hilog.warn(0x0000, TAG, 'ws msg parse fail'); return }
    hilog.info(0x0000, TAG, 'ws msg type=%{public}s', msg.type);
    if (msg.type === 'code') {
      if (msg.code !== undefined && msg.code.length > 0) this.loadProxyCode(msg.code);
    } else if (msg.type === 'drag-start') {
      this.onRemoteDragStart(msg.geoKey ?? '', msg.irPath ?? '');
    } else if (msg.type === 'drag-delta') {
      this.onRemoteDragDelta(msg.dx ?? 0, msg.dy ?? 0);
    } else if (msg.type === 'drag-end') {
      this.onRemoteDragEnd();
    }
  }

  /** 渲染完成后发几何图（path→rect, canvas 相对 vp）+ rendered 信号给浏览器。 */
  private emitGeometry(): void {
    const rects: GeoRectEntry[] = this.previewCtl.snapshotRects(this.canvasOX, this.canvasOY);
    hilog.info(0x0000, TAG, 'emitGeometry rects=%{public}d wsConn=%{public}s', rects.length, String(this.wsConnected));
    const geoMsg: WsOutMsg = { type: 'geometry', rects };
    this.wsSend(geoMsg);
    const doneMsg: WsOutMsg = { type: 'rendered' };
    this.wsSend(doneMsg);
  }

  // ---------- 远程拖拽（复用本机 PanGesture 的 moveBy+applyOffset 原语）----------
  private onRemoteDragStart(geoKey: string, irPath: string): void {
    if (this.showCode || irPath.length === 0) return;
    this.snapshot();
    const p = keyToPath(irPath);
    const n = nodeAtPath(this.curFile().root, p);
    if (n === null) return;
    const base = readOffset(n);
    this.rDragBaseX = base.x;
    this.rDragBaseY = base.y;
    this.rDragAccX = 0;
    this.rDragAccY = 0;
    this.selGeoKey = geoKey;
    this.selPath = pathKey(p);
    this.dragging = true;
  }

  private onRemoteDragDelta(dx: number, dy: number): void {
    if (!this.dragging || this.selGeoKey === '') return;
    const n = this.selNode();
    if (n === null) return;
    moveBy(n, dx, dy);
    this.rDragAccX += dx;
    this.rDragAccY += dy;
    this.previewCtl.applyOffset(this.selGeoKey, this.rDragBaseX + this.rDragAccX, this.rDragBaseY + this.rDragAccY);
  }

  private onRemoteDragEnd(): void {
    if (!this.dragging) return;
    this.endDrag();
  }

  /**
   * 把选中框对齐到节点当前实际位置（窗口坐标 - 画布原点）。
   * 仅在数值变化时写 @State；拖拽期间跳过（拖拽由手势直接驱动盒子和节点）。
   */
  private syncSelRect(): void {
    if (this.dragging) return;
    if (this.selGeoKey === '' || this.showCode) {
      if (this.showSel) this.showSel = false;
      return;
    }
    const r = this.previewCtl.queryRect(this.selGeoKey);
    if (r === null) {
      if (this.showSel) this.showSel = false;
      return;
    }
    const x = r.x - this.canvasOX;
    const y = r.y - this.canvasOY;
    if (!this.showSel || Math.abs(x - this.selX) > 0.5 || Math.abs(y - this.selY) > 0.5 ||
      Math.abs(r.w - this.selW) > 0.5 || Math.abs(r.h - this.selH) > 0.5) {
      this.selX = x;
      this.selY = y;
      this.selW = r.w;
      this.selH = r.h;
      this.showSel = true;
    }
  }

  /** 选中：p 可能带 ForEach 实例后缀（画布点选）；selPath 归一化为模板路径用于 IR 操作 */
  private onNodeTap(p: string): void {
    this.selPath = pathKey(keyToPath(p));
    this.selGeoKey = p;
    this.ver++;
    this.syncSelRect();
  }

  /** 拖拽收尾：重建一次树（IR 已在拖拽中累积好），让代码/大纲/选中框全部归位 */
  private endDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.refreshTree();
  }

  private selNode(): IRNode | null {
    return nodeAtPath(this.curFile().root, keyToPath(this.selPath));
  }

  private doDelete(path: string): void {
    this.snapshot();
    if (deleteAtPath(this.curFile().root, keyToPath(path))) {
      if (this.selPath === path || this.selPath.startsWith(path + '.')) {
        this.selPath = '';
        this.selGeoKey = '';
        this.showSel = false;
      }
      this.refreshTree();
    }
  }

  private doDuplicate(path: string): void {
    this.snapshot();
    const np = duplicateAtPath(this.curFile().root, keyToPath(path));
    if (np !== null) {
      this.selPath = np.join('.');
      this.selGeoKey = this.selPath;
      this.refreshTree();
    }
  }

  private doToggle(path: string): void {
    if (this.collapsed.has(path)) this.collapsed.delete(path);
    else this.collapsed.add(path);
    this.rows = flattenOutline(this.curFile().root, this.collapsed);
  }

  // ---------- 撤销/重做（序列化快照，变更前调用 snapshot） ----------

  private snapshot(): void {
    this.undoStack.push(serialize(this.curFile()));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.canUndo = true;
    this.canRedo = false;
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (prev === undefined) return;
    this.redoStack.push(serialize(this.curFile()));
    this.pages[this.curPage].file = parse(prev);
    this.selPath = '';
    this.selGeoKey = '';
    this.showSel = false;
    this.canUndo = this.undoStack.length > 0;
    this.canRedo = true;
    this.refreshTree();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(serialize(this.curFile()));
    this.pages[this.curPage].file = parse(next);
    this.selPath = '';
    this.selGeoKey = '';
    this.showSel = false;
    this.canRedo = this.redoStack.length > 0;
    this.canUndo = true;
    this.refreshTree();
  }

  /** 组件库点击添加：插进选中容器（或选中项之后），并选中新节点 */
  private doAddComponent(type: string): void {
    this.snapshot();
    const np = insertAuto(this.curFile().root, keyToPath(this.selPath), newNodeFor(type), CONTAINER_TYPES);
    if (np !== null) {
      this.selPath = np.join('.');
      this.selGeoKey = this.selPath;
      this.statusText = `已添加 ${type}`;
      const n = this.selNode();
      hilog.info(0x0000, TAG, 'addComponent: selPath=%{public}s, nodeType=%{public}s, rootChildren=%{public}d',
        this.selPath, n !== null ? n.type : 'null', this.curFile().root.children.length);
      this.refreshTree();
    }
  }

  private switchPage(i: number): void {
    if (i === this.curPage || i < 0 || i >= this.pages.length) return;
    this.curPage = i;
    this.selPath = '';
    this.selGeoKey = '';
    this.showSel = false;
    this.collapsed.clear();
    this.refreshTree();
  }

  /** 模板载入为新页面并切换过去 */
  private loadTemplate(code: string, name: string): void {
    try {
      const ir = parse(code);
      this.pages.push({ name: ir.structName, file: ir });
      this.pageNames = this.pages.map(p => p.name);
      this.showTemplates = false;
      this.switchPage(this.pages.length - 1);
      this.statusText = `已加载模板「${name}」`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.statusText = `模板解析失败: ${msg}`;
    }
  }

  private async doImport(): Promise<void> {
    const ctx = this.getUIContext().getHostContext();
    if (ctx === undefined) return;
    try {
      const docPicker = new picker.DocumentViewPicker(ctx);
      const uris = await docPicker.select({ maxSelectNumber: 30, fileSuffixFilters: ['.ets'] });
      let added = 0;
      let failed = 0;
      for (const uri of uris) {
        try {
          const file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
          const stat = fs.statSync(file.fd);
          const buf = new ArrayBuffer(stat.size);
          fs.readSync(file.fd, buf);
          fs.closeSync(file);
          const text = util.TextDecoder.create('utf-8').decodeToString(new Uint8Array(buf));
          const ir = parse(text);
          this.pages.push({ name: ir.structName, file: ir });
          added++;
        } catch (e) {
          failed++;
          hilog.error(0x0000, TAG, 'import failed for %{public}s: %{public}s', uri, JSON.stringify(e));
        }
      }
      this.pageNames = this.pages.map(p => p.name);
      this.statusText = `导入完成：成功 ${added} 个${failed > 0 ? `，失败 ${failed} 个` : ''}`;
      if (added > 0) this.switchPage(this.pages.length - added);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.statusText = `导入取消/失败: ${msg}`;
    }
  }

  private async doExport(): Promise<void> {
    const ctx = this.getUIContext().getHostContext();
    if (ctx === undefined) return;
    try {
      const docPicker = new picker.DocumentViewPicker(ctx);
      const name = `${this.curFile().structName}.ets`;
      const uris = await docPicker.save({ newFileNames: [name] });
      if (uris.length === 0) return;
      const file = fs.createRandomAccessFileSync(uris[0], fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      file.writeSync(this.code);
      file.close();
      this.statusText = `已导出 ${name}`;
      this.toast('已导出 ' + name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.statusText = `导出失败: ${msg}`;
    }
  }

  private doCopyCode(): void {
    const data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, this.code);
    pasteboard.getSystemPasteboard().setData(data).then(() => {
      this.toast('代码已复制');
    }).catch((e: BusinessError) => {
      hilog.error(0x0000, TAG, 'copy failed: %{public}s', JSON.stringify(e));
    });
  }

  private toast(msg: string): void {
    this.getUIContext().getPromptAction().showToast({ message: msg, duration: 1500 });
  }

  build() {
    Column() {
      // 顶栏一行：页面标签 + 导入/导出/代码切换 + 移动模式
      Row() {
        List() {
          ForEach(this.pageNames, (name: string, i: number) => {
            ListItem() {
              Text(name)
                .fontSize(12)
                .fontColor(i === this.curPage ? '#0A59F7' : '#555555')
                .fontWeight(i === this.curPage ? FontWeight.Bold : FontWeight.Normal)
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .backgroundColor('#ffffff')
                .borderRadius(6)
                .margin({ right: 4 })
                .onClick(() => this.switchPage(i))
            }
          }, (name: string, i: number) => `${i}-${name}`)
        }
        .listDirection(Axis.Horizontal)
        .layoutWeight(1)
        .height(30)
        .scrollBar(BarState.Off)

        // 切换类按钮必须内联：@Builder 按值参数不响应状态变化（label/高亮会冻住）
        Button(this.showTemplates ? '收起模板' : '模板')
          .fontSize(11)
          .height(28)
          .padding({ left: 8, right: 8 })
          .margin({ left: 4 })
          .backgroundColor(this.showTemplates ? '#0A59F7' : '#e5e5ea')
          .fontColor(this.showTemplates ? '#ffffff' : '#333333')
          .onClick(() => { this.showTemplates = !this.showTemplates; })
        Button(this.showCode ? '关闭代码' : '代码')
          .fontSize(11)
          .height(28)
          .padding({ left: 8, right: 8 })
          .margin({ left: 4 })
          .backgroundColor(this.showCode ? '#0A59F7' : '#e5e5ea')
          .fontColor(this.showCode ? '#ffffff' : '#333333')
          .onClick(() => { this.showCode = !this.showCode; })
        this.TopButton('导入', () => { this.doImport(); })
        this.TopButton('导出', () => { this.doExport(); })
        this.TopButton('撤销', () => { this.undo(); })
        this.TopButton('重做', () => { this.redo(); })
        Button(this.moveMode ? '退出移动' : '移动')
          .fontSize(11)
          .height(28)
          .padding({ left: 8, right: 8 })
          .margin({ left: 4 })
          .backgroundColor(this.moveMode ? '#0A59F7' : '#e5e5ea')
          .fontColor(this.moveMode ? '#ffffff' : '#333333')
          .onClick(() => { this.moveMode = !this.moveMode; })
      }
      .width('100%')
      .padding({ left: 8, right: 8, top: 4, bottom: 2 })
      .visibility(this.previewMode ? Visibility.None : Visibility.Visible)

      // 状态行
      Row() {
        Text(this.statusText)
          .fontSize(11)
          .fontColor('#888888')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .padding({ left: 10, right: 10, bottom: 4 })
      .visibility(this.previewMode ? Visibility.None : Visibility.Visible)

      Row() {
        if (!this.previewMode) {
          this.LibraryPanel()
        }

        // 画布 + 选中框 + 代码视图
        // 注意：内层 Stack 必须零 padding——onAreaChange 的 globalPosition 与 .position() 的
        // 定位基准在「带 padding 时相对边框盒还是内容盒」上不一致（实测差一个 padding），
        // 零 padding 下两者重合，选中框坐标才严格等于 节点窗口坐标 - 内层 Stack 原点。
        Stack() {
          Stack() {
            EditorCanvas({ controller: this.previewCtl })
              .width('100%')
              .height('100%')
              .visibility(this.showCode ? Visibility.Hidden : Visibility.Visible)
            if (this.showSel && !this.showCode && !this.previewMode) {
              Column()
                .width(this.selW)
                .height(this.selH)
                .position({ x: this.selX, y: this.selY })
                .border({ width: 2, color: '#0A59F7' })
                .backgroundColor('#1a0A59F7')
                .hitTestBehavior(HitTestMode.None)
            }
            if (this.showCode) {
              Column() {
                Row() {
                  Text('生成的 .ets 源码')
                    .fontSize(12)
                    .fontColor('#666666')
                    .layoutWeight(1)
                  Button('复制')
                    .fontSize(12)
                    .height(28)
                    .onClick(() => this.doCopyCode())
                }
                .width('100%')
                .padding({ bottom: 6 })
                Scroll() {
                  Text(this.code)
                    .fontSize(11)
                    .fontFamily('monospace')
                    .fontColor('#333333')
                    .width('100%')
                    .textAlign(TextAlign.Start)
                    .copyOption(CopyOptions.LocalDevice)
                }
                .layoutWeight(1)
                .width('100%')
              }
              .width('100%')
              .height('100%')
              .padding(8)
              .backgroundColor('#ffffff')
              .borderRadius(8)
            }
            if (this.previewMode) {
              // 全屏预览时浮动退出按钮（左上角，不影响布局），点回编辑器外壳
              Button('✕ 退出预览')
                .fontSize(12)
                .height(32)
                .padding({ left: 12, right: 12 })
                .backgroundColor('#cc000000')
                .fontColor('#ffffff')
                .borderRadius(16)
                .position({ x: 12, y: 12 })
                .onClick(() => this.exitPreview())
            }
          }
          .width('100%')
          .height('100%')
          .alignContent(Alignment.TopStart)
          .clip(true)
          .onAreaChange((o: Area, a: Area) => {
            this.canvasOX = typeof a.globalPosition.x === 'number' ? a.globalPosition.x : 0;
            this.canvasOY = typeof a.globalPosition.y === 'number' ? a.globalPosition.y : 0;
            this.syncSelRect();
          })
        }
        .alignContent(Alignment.TopStart)
        .layoutWeight(1)
        .height('100%')
        .padding(8)
        // 手势常驻、按模式切 mask：普通模式 Normal（Scroll/List 滚动优先，画布零干扰）；
        // 移动模式 IgnoreInternal（父手势优先，选中组件在列表/滚动容器里也能拖动，
        // 否则子组件抢手势表现为「拖不动」）。mask 是普通修饰符参数，模式切换原地生效，不重建画布。
        .gesture(
          PanGesture()
            .onActionStart(() => {
              this.panLastX = 0;
              this.panLastY = 0;
              if (this.moveMode && !this.showCode && this.selPath !== '') {
                this.snapshot(); // 拖拽全程一个快照
                const n = this.selNode();
                if (n !== null) {
                  const base = readOffset(n);
                  this.dragBaseX = base.x;
                  this.dragBaseY = base.y;
                  this.dragAccX = 0;
                  this.dragAccY = 0;
                  this.dragging = true;
                }
              }
            })
            .onActionUpdate((e: GestureEvent) => {
              if (!this.dragging) return;
              const dx = e.offsetX - this.panLastX;
              const dy = e.offsetY - this.panLastY;
              this.panLastX = e.offsetX;
              this.panLastY = e.offsetY;
              const n = this.selNode();
              if (n === null) return;
              moveBy(n, dx, dy); // IR 同步累积（序列化/撤销以 IR 为准）
              this.dragAccX += dx;
              this.dragAccY += dy;
              // 直写活节点 offset + 盒子跟手：拖拽期间不重建整棵树
              this.previewCtl.applyOffset(this.selGeoKey, this.dragBaseX + this.dragAccX, this.dragBaseY + this.dragAccY);
              if (this.showSel) {
                this.selX += dx;
                this.selY += dy;
              }
            })
            .onActionEnd(() => this.endDrag())
            .onActionCancel(() => this.endDrag()),
          this.moveMode && !this.showCode ? GestureMask.IgnoreInternal : GestureMask.Normal
        )

        // 右栏：大纲树 + 属性面板
        Column() {
          Text('大纲树')
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .padding({ top: 6, bottom: 4 })
          OutlineTree({
            rows: this.rows,
            selPath: this.selPath,
            ver: this.ver,
            onSelect: (p: string) => this.onNodeTap(p),
            onToggle: (p: string) => this.doToggle(p),
            onDelete: (p: string) => this.doDelete(p),
            onDuplicate: (p: string) => this.doDuplicate(p),
          })
            .layoutWeight(1)
          Divider()
            .margin({ top: 4, bottom: 4 })
          Text('属性')
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .padding({ top: 2, bottom: 2 })
          Scroll() {
            this.PropertyPanel()
          }
          .height('44%')
          .scrollBar(BarState.Auto)
        }
        .width(220)
        .height('100%')
        .alignItems(HorizontalAlign.Start)
        .backgroundColor('#f7f8fa')
        .visibility(this.previewMode ? Visibility.None : Visibility.Visible)
      }
      .layoutWeight(1)
      .width('100%')

      // 模板库覆盖层（在外层 Column 内，position 脱离文档流盖住整页）
      if (this.showTemplates) {
        this.TemplatesOverlay()
      }
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.topPad })
    .backgroundColor('#e8eaed')
  }

  // ---------- 属性面板（@Builder：无组件边界；不传节点参数——全部内部新鲜求值，规避按值参数缓存） ----------

  private selNodeOrRoot(): IRNode {
    const n = this.selNode();
    return n !== null ? n : this.curFile().root;
  }

  private curProp(name: string): string {
    const n = this.selNodeOrRoot();
    if (name === '_text') return readTextArg(n) || '';
    const s = readStrModifier(n, name);
    if (s !== null) return s;
    const v = readNumModifier(n, name);
    return v !== null ? String(v) : '';
  }

  private commitProp(name: string): void {
    const v = this.pending.get(name);
    if (v === undefined) return;
    this.pending.delete(name);
    this.snapshot();
    const n = this.selNodeOrRoot();
    if (name === '_text') setTextArg(n, v);
    else if (name === 'fontColor' || name === 'backgroundColor') setColorModifier(n, name, v);
    else setLengthModifier(n, name, v);
    this.refreshTree();
  }

  @Builder
  PropField(label: string, name: string, placeholder: string) {
    Row() {
      Text(label)
        .fontSize(11)
        .fontColor('#555555')
        .width(72)
      TextInput({ text: this.curProp(name), placeholder })
        .fontSize(11)
        .layoutWeight(1)
        .height(30)
        .padding({ left: 6, right: 6 })
        .backgroundColor('#ffffff')
        .borderRadius(4)
        .onChange((v: string) => { this.pending.set(name, v) })
        .onSubmit(() => this.commitProp(name))
        .onBlur(() => this.commitProp(name))
    }
    .width('100%')
  }

  @Builder
  PropertyPanel() {
    if (this.selNode() === null) {
      Text('在画布或大纲树中选中组件')
        .fontSize(12)
        .fontColor('#999999')
        .margin({ top: 8 })
        .padding(8)
    } else {
      Column({ space: 6 }) {
        Row() {
          Text(`${this.selNodeOrRoot().type}${this.selPath === '' ? '（根）' : ''}`)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .layoutWeight(1)
          Text(`v${this.ver}`)
            .fontSize(10)
            .fontColor('#bbbbbb')
        }
        .width('100%')
        if (this.selNodeOrRoot().type === 'Text' || this.selNodeOrRoot().type === 'Button') {
          this.PropField('文本', '_text', '文字内容')
        }
        this.PropField('宽', 'width', '数值 / %')
        this.PropField('高', 'height', '数值 / %')
        if (this.selNodeOrRoot().type === 'Text' || this.selNodeOrRoot().type === 'Button' || this.selNodeOrRoot().type === 'TextInput') {
          this.PropField('字号', 'fontSize', '数值')
          this.PropField('字色', 'fontColor', '#rrggbb')
        }
        this.PropField('背景', 'backgroundColor', '#rrggbb')
        this.PropField('外边距', 'margin', '数值')
        this.PropField('内边距', 'padding', '数值')
        this.PropField('不透明', 'opacity', '0~1')
        Row({ space: 8 }) {
          Button('复制')
            .fontSize(12)
            .height(30)
            .layoutWeight(1)
            .backgroundColor('#e5e5ea')
            .fontColor('#333333')
            .onClick(() => this.doDuplicate(this.selPath))
          Button('删除')
            .fontSize(12)
            .height(30)
            .layoutWeight(1)
            .backgroundColor('#ffe5e5')
            .fontColor('#cc0000')
            .onClick(() => this.doDelete(this.selPath))
        }
        .width('100%')
        .margin({ top: 8 })
      }
      .padding(8)
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  TemplatesOverlay() {
    Column() {
      Row() {
        Text('模板库（点击载入为新页面）')
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .layoutWeight(1)
        Button('关闭')
          .fontSize(12)
          .height(30)
          .onClick(() => { this.showTemplates = false; })
      }
      .width('100%')
      .padding(10)
      Scroll() {
        Column() {
          ForEach(TEMPLATE_CATEGORIES, (cat: TemplateCategory) => {
            Column() {
              Text(`${cat.icon} ${cat.label}`)
                .fontSize(13)
                .fontWeight(FontWeight.Bold)
                .margin({ top: 6, bottom: 6 })
              Flex({ wrap: FlexWrap.Wrap }) {
                ForEach(cat.templates, (t: Template) => {
                  Column() {
                    Text(t.icon)
                      .fontSize(22)
                    Text(t.name)
                      .fontSize(11)
                      .margin({ top: 4 })
                    Text(t.description)
                      .fontSize(9)
                      .fontColor('#999999')
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                      .margin({ top: 2 })
                  }
                  .width(100)
                  .padding(8)
                  .margin({ right: 8, bottom: 8 })
                  .backgroundColor('#ffffff')
                  .borderRadius(8)
                  .alignItems(HorizontalAlign.Start)
                  .onClick(() => this.loadTemplate(t.code, t.name))
                }, (t: Template) => `${cat.label}-${t.name}`)
              }
              .width('100%')
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
          }, (cat: TemplateCategory) => cat.label)
        }
        .padding({ left: 10, right: 10, bottom: 10 })
        .alignItems(HorizontalAlign.Start)
      }
      .layoutWeight(1)
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#f2f3f5')
    .position({ x: 0, y: 0 })
    .zIndex(10)
  }

  @Builder
  TopButton(label: string, onTap: () => void) {
    Button(label)
      .fontSize(11)
      .height(28)
      .padding({ left: 8, right: 8 })
      .margin({ left: 4 })
      .backgroundColor('#e5e5ea')
      .fontColor('#333333')
      .onClick(onTap)
  }

  @Builder
  LibraryPanel() {
    Column() {
      Text('组件库')
        .fontSize(13)
        .fontWeight(FontWeight.Bold)
        .margin({ bottom: 8 })
      ForEach(['Text', 'Button', 'Image', 'TextInput', 'Column', 'Row', 'Stack', 'Scroll', 'List', 'Grid', 'Swiper', 'Divider'],
        (name: string) => {
          Text(name)
            .fontSize(12)
            .width('100%')
            .padding(7)
            .margin({ bottom: 4 })
            .backgroundColor('#ffffff')
            .borderRadius(6)
            .onClick(() => this.doAddComponent(name))
        }, (name: string) => name)
      Text('点击添加到选中容器')
        .fontSize(10)
        .fontColor('#999999')
        .margin({ top: 6 })
    }
    .width(130)
    .height('100%')
    .padding(8)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor('#f7f8fa')
  }
}
