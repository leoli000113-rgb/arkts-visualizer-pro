import { IRNode } from '../ir/types'

/**
 * 属性面板字段 schema：专属编辑区由 ComponentSpec.fields 声明式驱动。
 * - mod 类字段（num/size/boxnum/str/enum/bool/color/xy）：读写 .mod 修饰符
 * - ctorText：首构造参数文本（str/raw 可改，复杂表达式只读）
 * - ctorObj*：构造参数对象字段（如 Column({ space: 8 }) 的 space）
 */
export interface FieldSpec {
  kind:
    | 'num' | 'size' | 'boxnum' | 'str' | 'enum' | 'bool' | 'color' | 'xy'
    | 'ctorText' | 'ctorObjNum' | 'ctorObjStr' | 'ctorObjEnum' | 'ctorObjBool'
  /** 显示标签，也是通用 TIPS 的查表 key */
  label: string
  /** 修饰符名（mod 类字段必填） */
  mod?: string
  /** 构造参数对象字段名（ctorObj* 类必填） */
  key?: string
  /** enum / ctorObjEnum 的选项 */
  options?: string[]
  /** num 步进 */
  step?: string
  /** enum 是否允许「（默认）」未设置项（默认允许） */
  allowUnset?: boolean
  /** 感叹号说明；缺省时回退到属性面板通用 TIPS[label] */
  tip?: string
}

export type Category = '布局' | '容器' | '基础' | '表单' | '反馈' | '结构'

/** 元件注册声明：面板分组 / 默认节点 / 容器与约束 / 专属属性 / 大纲摘要的唯一真相源 */
export interface ComponentSpec {
  type: string
  category: Category
  /** 是否出现在左侧组件面板 */
  palette: boolean
  /** 是否为容器（dnd 中部落点 = inside） */
  container: boolean
  /** 子类型白名单（如 List → ['ListItem']）；缺省 = 接受任意类型 */
  accepts?: string[]
  /** 独子容器（Scroll/TabContent） */
  singleChild?: boolean
  /** 结构节点（If/Else/ForEach/BuilderCall）：修饰符不参与序列化，面板只展示信息 */
  structural?: boolean
  /** 拖入画布时的默认节点工厂 */
  makeDefault?: () => IRNode
  /** 专属属性区 schema（面板通用区另算） */
  fields?: FieldSpec[]
  /** 大纲树节点摘要 */
  summary?: (n: IRNode) => string
}
