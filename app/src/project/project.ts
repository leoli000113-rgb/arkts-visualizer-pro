import { IRFile } from '../ir/types'
import { parse } from '../parser/parser'
import { extractComponents } from '../renderer/components'

/**
 * 项目级（多文件）纯逻辑：
 * - import 声明提取 / 相对路径解析（跨文件组件表用）
 * - router url → 项目文件解析（交互预览导航用）
 * - 整项目导入的文件分类（.ets / 媒体 / resources element json）
 * - 解析缓存（按 path+code 失效，避免编辑当前页时重复解析整个工程）
 *
 * 全部函数无副作用（parseCached 仅写模块内缓存），可单测。
 */

// ---------- import 声明 ----------

export interface ImportDecl { names: string[]; from: string }

/** 从 preamble 原文提取 import 声明：默认导入 / 命名导入（含 as 别名取本地名）；namespace 导入忽略 */
export function extractImports(preamble: string): ImportDecl[] {
  const out: ImportDecl[] = []
  const re = /import\s+([^'"]+?)\s+from\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(preamble))) {
    const clause = m[1].trim()
    const names: string[] = []
    const named = clause.match(/\{([^}]*)\}/)
    if (named) {
      for (const part of named[1].split(',')) {
        const p = part.trim()
        if (!p) continue
        const asM = p.match(/[\w$]+\s+as\s+([\w$]+)/)
        names.push(asM ? asM[1] : p)
      }
    }
    const def = clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim()
    if (def && !def.startsWith('*')) names.push(def)
    if (names.length) out.push({ names, from: m[2] })
  }
  return out
}

/** 相对导入路径拼接（'../components/PageView' 相对当前文件目录） */
function joinRel(fromFile: string, spec: string): string {
  const dir = fromFile.split('/').slice(0, -1)
  for (const seg of spec.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') dir.pop()
    else dir.push(seg)
  }
  return dir.join('/')
}

/** import spec → files 表中的实际路径（尝试原样 / +.ets / +.ts） */
export function resolveImport(fromFile: string, spec: string, files: Record<string, string>): string | null {
  if (!spec.startsWith('.')) return null // 包名（@kit.* 等）不解析
  const base = joinRel(fromFile, spec)
  for (const cand of [base, `${base}.ets`, `${base}.ts`]) {
    if (files[cand] !== undefined) return cand
  }
  return null
}

// ---------- 路由 ----------

/** router.pushUrl 的 url（'pages/ReadingPage'）→ files 表路径；命中多个时优先 /pages/ 下、路径最短者 */
export function routeTarget(url: string, files: Record<string, string>): string | null {
  const u = url.replace(/^@/, '').replace(/^\//, '').replace(/\.(ets|ts)$/, '')
  if (!u) return null
  const hits = Object.keys(files).filter((p) => {
    const stripped = p.replace(/\.(ets|ts)$/, '')
    return stripped === u || stripped.endsWith(`/${u}`)
  })
  if (!hits.length) return null
  hits.sort((a, b) => {
    const ap = a.includes('/pages/') ? 0 : 1
    const bp = b.includes('/pages/') ? 0 : 1
    return ap - bp || a.length - b.length
  })
  return hits[0]
}

/** 项目起始页：优先 pages/Index + @Entry → /pages/ 下任一 @Entry → 任一 @Entry → 第一个文件 */
export function pickStartFile(files: Record<string, string>): string | null {
  const keys = Object.keys(files).sort()
  if (!keys.length) return null
  const isEntry = (p: string) => files[p].includes('@Entry')
  return (
    keys.find((p) => /\/pages\/Index\.ets$/.test(p) && isEntry(p)) ??
    keys.find((p) => p.includes('/pages/') && isEntry(p)) ??
    keys.find(isEntry) ??
    keys[0]
  )
}

// ---------- 解析缓存 ----------

const parseCache = new Map<string, { code: string; ir: IRFile | null }>()

/** 按 path 缓存解析结果（code 变更即重解）；解析失败缓存 null（不重复抛错） */
export function parseCached(path: string, code: string): IRFile | null {
  const hit = parseCache.get(path)
  if (hit && hit.code === code) return hit.ir
  let ir: IRFile | null = null
  try { ir = parse(code) } catch { /* 单文件失败不影响工程其余部分 */ }
  if (parseCache.size > 200) parseCache.clear()
  parseCache.set(path, { code, ir })
  return ir
}

/** 跨文件组件表：import 声明解析到的组件（含其同文件组件）+ 当前文件同文件组件（后者优先） */
export function buildComponents(currentPath: string, ir: IRFile, files: Record<string, string>): Record<string, IRFile> {
  const out: Record<string, IRFile> = {}
  for (const imp of extractImports(ir.preamble)) {
    const target = resolveImport(currentPath, imp.from, files)
    if (!target) continue
    const fir = parseCached(target, files[target])
    if (!fir) continue
    let sameFile: Record<string, IRFile> | null = null
    for (const n of imp.names) {
      if (n === fir.structName) { out[n] = fir; continue }
      sameFile ??= extractComponents(fir)
      if (sameFile[n]) out[n] = sameFile[n]
    }
  }
  Object.assign(out, extractComponents(ir))
  return out
}

// ---------- 媒体与资源 ----------

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)$/i

export const isImageFile = (name: string): boolean => IMAGE_EXT.test(name)
export const isVideoFile = (name: string): boolean => VIDEO_EXT.test(name)
export const isMediaFile = (name: string): boolean => isImageFile(name) || isVideoFile(name)

/** 媒体引用键：文件名去目录去扩展名（$r('app.media.cover') ↔ cover.png） */
export function mediaKeyOf(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.[^.]+$/, '')
}

/** resources/base/element/color.json | string.json → name → value 表（非此形态返回 null） */
export function parseResourceJson(text: string): Record<string, string> | null {
  try {
    const j = JSON.parse(text)
    const arr = j?.color ?? j?.string
    if (!Array.isArray(arr)) return null
    const out: Record<string, string> = {}
    for (const it of arr) {
      if (it && typeof it.name === 'string' && typeof it.value === 'string') out[it.name] = it.value
    }
    return out
  } catch {
    return null
  }
}
