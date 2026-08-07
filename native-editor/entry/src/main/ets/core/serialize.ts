/**
 * 代码生成器：IR → .ets 源码 —— 从 Web 版 app/src/ir/serialize.ts 移植（ArkTS 严格模式适配）
 * 与 Web 版逐行等价；Object.entries → Object.keys，数组展开改为显式循环。
 */

import { ArgVal, IRFile, IRNode } from './ir'

export function serializeArg(a: ArgVal): string {
  switch (a.t) {
    case 'str': return `'${a.v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    case 'num': return String(a.v)
    // 8 位 ARGB 值补齐到 8 位，避免高位 0 丢失导致被误读为 RGB
    case 'hex': return '0x' + a.v.toString(16).toUpperCase().padStart(a.v > 0xFFFFFF ? 8 : 6, '0')
    case 'bool': return String(a.v)
    case 'enum': return a.v
    case 'obj': {
      const inner = Object.keys(a.v).map((k) => `${k}: ${serializeArg(a.v[k])}`).join(', ')
      return `{ ${inner} }`
    }
    case 'raw': return a.v
    default: throw new Error('未知 ArgVal 类型')
  }
}

function serializeArgs(args: ArgVal[]): string {
  return args.map(serializeArg).join(', ')
}

function serializeChildren(children: IRNode[], indent: string): string {
  return children.map(c => serializeNode(c, indent)).join('\n')
}

function serializeModifiers(node: IRNode, indent: string, hanging: boolean): string {
  if (node.modifiers.length === 0) return ''
  if (hanging) {
    // 有 children：修饰符链挂在闭合 } 之后
    return node.modifiers.map(m => `\n${indent}.${m.name}(${serializeArgs(m.args)})`).join('')
  }
  return node.modifiers.map(m => `\n${indent}  .${m.name}(${serializeArgs(m.args)})`).join('')
}

export function serializeNode(node: IRNode, indent: string): string {
  // 解析失败占位 / 注释 / 表达式语句 / Builder 调用点：原文（含错误注释）原样回吐
  if (node.unsupported || node.type === 'Comment' || node.type === 'Expr' || node.type === 'BuilderCall') {
    const raw = node.ctorArgs[0]
    return `${indent}${raw !== undefined && raw.t === 'raw' ? raw.v : `/* 未支持节点: ${node.type} */`}`
  }
  // if (cond) { ... } —— cond raw 含括号
  if (node.type === 'If') {
    const cond = node.ctorArgs[0]
    const condText = cond !== undefined && cond.t === 'raw' ? cond.v : '(true)'
    return `${indent}if ${condText} {\n${serializeChildren(node.children, indent + '  ')}\n${indent}}`
  }
  if (node.type === 'Else') {
    return `${indent}else {\n${serializeChildren(node.children, indent + '  ')}\n${indent}}`
  }
  // ForEach(items, (item) => { ... }, keyGen?)
  if (node.type === 'ForEach') {
    const a0 = node.ctorArgs[0]
    const a1 = node.ctorArgs[1]
    const a2 = node.ctorArgs[2]
    const items = a0 !== undefined ? serializeArg(a0) : '[]'
    const params = a1 !== undefined && a1.t === 'raw' ? a1.v : '(item)'
    const keyGen = a2 !== undefined ? `, ${serializeArg(a2)}` : ''
    return `${indent}ForEach(${items}, ${params} => {\n${serializeChildren(node.children, indent + '  ')}\n${indent}}${keyGen})`
  }

  const head = `${indent}${node.type}(${serializeArgs(node.ctorArgs)})`
  if (node.children.length === 0) {
    return head + serializeModifiers(node, indent, false)
  }
  const children = serializeChildren(node.children, indent + '  ')
  return `${head} {\n${children}\n${indent}}${serializeModifiers(node, indent, true)}`
}

/**
 * 全文件重组：preamble / struct 装饰器 / 成员（状态、raw 原文、@Builder、build 标记位）/ postamble
 * —— 除 build() 与 @Builder 内的 UI 结构外，其余全部按原文原位置输出。
 */

/** 在 build 树（含根前后 extras）中找指定名字的 BuilderCall 镜像节点 */
function findBuilderCall(root: IRNode, extrasPre: IRNode[], extrasPost: IRNode[], name: string): IRNode | null {
  let found: IRNode | null = null
  const walk = (n: IRNode): void => {
    if (found !== null) return
    const a1 = n.ctorArgs[1]
    if (n.type === 'BuilderCall' && a1 !== undefined && a1.t === 'raw' && a1.v === name) {
      found = n
      return
    }
    n.children.forEach(walk)
  }
  const all: IRNode[] = [root]
  for (const e of extrasPre) all.push(e)
  for (const e of extrasPost) all.push(e)
  all.forEach(walk)
  return found
}

export function serialize(file: IRFile): string {
  const parts: string[] = []
  if (file.preamble.trim()) parts.push(file.preamble.replace(/\s+$/, '') + '\n\n')
  parts.push((file.structDecorators || '@Entry\n@Component') + '\n')
  parts.push(`struct ${file.structName} {\n`)
  for (const m of file.members) {
    if (m.kind === 'state') {
      parts.push(`  ${m.state.decorator} ${m.state.name}: ${m.state.type} = ${serializeArg(m.state.init)}\n`)
    } else if (m.kind === 'raw') {
      parts.push(m.text.replace(/\s+$/, '') + '\n')
    } else if (m.kind === 'builder') {
      // 调用点镜像的 children 是唯一事实源（编辑发生在镜像上）；无镜像用定义自身解析结果
      const mirror = findBuilderCall(file.root, file.rootExtrasPre, file.rootExtrasPost, m.name)
      const children = mirror !== null ? mirror.children : m.children
      parts.push(`  ${m.signature} {\n${serializeChildren(children, '    ')}\n  }\n`)
    } else {
      parts.push(`  build() {\n`)
      for (const e of file.rootExtrasPre) parts.push(serializeNode(e, '    ') + '\n')
      parts.push(serializeNode(file.root, '    ') + '\n')
      for (const e of file.rootExtrasPost) parts.push(serializeNode(e, '    ') + '\n')
      parts.push(`  }\n`)
    }
  }
  parts.push('}')
  if (file.postamble.trim()) parts.push('\n' + file.postamble.replace(/^\s+/, ''))
  else parts.push('\n')
  return parts.join('')
}
