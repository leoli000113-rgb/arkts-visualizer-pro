/**
 * 原生模板库（core/templates.ts）完整性：与 web 版逐字节一致 + 全部可被原生解析器解析
 */
import { describe, it, expect } from 'vitest'
import { TEMPLATE_CATEGORIES as webCats } from '../templates/templates'
import { TEMPLATE_CATEGORIES as nativeCats, TEMPLATES as nativeTemplates } from '../../../native-editor/entry/src/main/ets/core/templates'
import { parse } from '../../../native-editor/entry/src/main/ets/core/parser'

describe('native 模板库', () => {
  it('与 web 版深相等（防漂移）', () => {
    expect(nativeCats).toEqual(webCats)
  })

  it('数量齐全', () => {
    expect(nativeTemplates.length).toBeGreaterThanOrEqual(28)
  })

  it('每个模板都能被原生解析器解析出单根组件', () => {
    for (const t of nativeTemplates) {
      const f = parse(t.code)
      expect(f.root.type.length).toBeGreaterThan(0)
    }
  })
})
