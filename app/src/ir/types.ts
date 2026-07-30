export type ArgVal =
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'hex'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'enum'; v: string }
  | { t: 'obj'; v: Record<string, ArgVal> }
  | { t: 'raw'; v: string }

export interface Modifier {
  name: string
  args: ArgVal[]
}

export interface IRNode {
  type: string
  ctorArgs: ArgVal[]
  children: IRNode[]
  modifiers: Modifier[]
  unsupported?: boolean
  /** 源码字符偏移（build/组件体内盖戳），供大纲树点击跳转代码用；非 build 体内节点无此字段 */
  pos?: number
  end?: number
}

export interface IRState {
  name: string
  type: string
  init: ArgVal
  /** 装饰器原文（如 '@State'、'@StorageLink(\'isAnalyzing\')'），原样保留 */
  decorator: string
}

/** struct 成员：状态声明（结构化，可被 UI 编辑/求值）| 原文块（方法/字段，原样保留）| @Builder（签名原文保留 + 方法体 UI 结构化）| build() 标记位 */
export type IRMember =
  | { kind: 'state'; state: IRState }
  | { kind: 'raw'; text: string }
  | { kind: 'builder'; name: string; signature: string; children: IRNode[] }
  | { kind: 'build' }

export interface IRFile {
  structName: string
  /** struct 之前的全部原文（import / interface / 注释），原样保留 */
  preamble: string
  /** struct 之后的全部原文（其它 struct / 自定义组件等），原样保留 */
  postamble: string
  /** struct 装饰器原文（如 '@Entry\n@Component'），原样保留 */
  structDecorators: string
  /** 成员列表（含 build 标记位），保持源码顺序 */
  members: IRMember[]
  /** members 中所有 state 的副本（渲染求值用） */
  states: IRState[]
  root: IRNode
  /** build() 体内、根组件前后的注释/表达式语句（保持原相对位置输出） */
  rootExtrasPre: IRNode[]
  rootExtrasPost: IRNode[]
}
