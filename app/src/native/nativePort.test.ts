/**
 * Web 版解析器/序列化器 与 原生移植版（native-editor/.../core/）的等价性测试。
 * 语料 = 全部模板 + 棘手语法样例；断言 IR 深相等 + 序列化逐字节一致 + 往返稳定。
 * 移植文件有任何漂移，这里立刻红。
 */
import { describe, it, expect } from 'vitest'
import { parse as webParse, parseModifierChainText as webChain } from '../parser/parser'
import { serialize as webSerialize } from '../ir/serialize'
import { TEMPLATE_CATEGORIES } from '../templates/templates'
import { parse as nativeParse, parseModifierChainText as nativeChain } from '../../../native-editor/entry/src/main/ets/core/parser'
import { serialize as nativeSerialize } from '../../../native-editor/entry/src/main/ets/core/serialize'

const SAMPLES: Record<string, string> = {
  'if/else if/else': `@Component
struct P {
  build() {
    Column() {
      if (this.a > 1) {
        Text('a')
      } else if (this.a > 0) {
        Text('b')
      } else {
        Text('c')
      }
    }
  }
}
`,
  '@Builder 调用镜像': `@Component
struct P {
  @Builder Header(title: string) {
    Row() {
      Text(title).fontSize(16)
    }
  }
  build() {
    Column() {
      this.Header('你好')
      Text('body')
    }
  }
}
`,
  'raw 表达式全覆盖': `@Component
struct P {
  @State list: string[] = ['a', 'b']
  build() {
    Column({ space: 8 }) {
      Text(\`计数: \${this.list.length}\`)
        .margin({ top: 1 + 2, left: -4 })
        .fontColor(0xFF112233)
        .backgroundColor($r('app.color.bg'))
        .gesture(PanGesture().onActionStart((e) => { this.go(e) }))
        .visibility(this.list.length > 0 ? Visibility.Visible : Visibility.None)
    }
  }
}
`,
  '注释与表达式语句': `@Entry
@Component
struct P {
  build() {
    // 顶部注释
    Column() {
      // 内部注释
      Text('x')
      /* 块注释 */
      this.doSomething()
    }
    .width('100%')
  }
}
`,
  '无法识别构造恢复': `@Component
struct P {
  build() {
    Column() {
      Text('ok')
      123 + 456
      Text('still ok')
    }
  }
}
`,
  '修饰符链文本': '',
}

describe('native 移植版 ≡ web 版', () => {
  const corpus: Array<[string, string]> = []
  for (const c of TEMPLATE_CATEGORIES) {
    for (const t of c.templates) corpus.push([`模板:${t.name}`, t.code])
  }
  for (const [name, code] of Object.entries(SAMPLES)) {
    if (code) corpus.push([`样例:${name}`, code])
  }

  for (const [name, src] of corpus) {
    it(`${name} — IR 深相等`, () => {
      expect(nativeParse(src)).toEqual(webParse(src))
    })
    it(`${name} — 序列化逐字节一致`, () => {
      expect(nativeSerialize(nativeParse(src))).toBe(webSerialize(webParse(src)))
    })
    it(`${name} — 往返行为与 web 版一致`, () => {
      // 含解析失败占位的语料二次序列化会再包一层错误注释（两版同源同表现），
      // 因此断言「二次处理结果与 web 版逐字节一致」而非绝对幂等
      const once = nativeSerialize(nativeParse(src))
      expect(nativeSerialize(nativeParse(once))).toBe(webSerialize(webParse(once)))
    })
  }

  it('parseModifierChainText 等价', () => {
    const inputs = [
      '.width(100).height(50)',
      ".fontSize(16).fontColor('#333').margin({ top: 4 })",
      '.width(100) garbage',
      'width(100)',
    ]
    for (const s of inputs) {
      expect(nativeChain(s)).toEqual(webChain(s))
    }
  })
})
