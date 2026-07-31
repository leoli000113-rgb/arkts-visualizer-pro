import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  extractImports, resolveImport, routeTarget, pickStartFile,
  mediaKeyOf, isMediaFile, isImageFile, isVideoFile, parseResourceJson,
  buildComponents,
} from './project'
import {
  findRouterAction, extractMethodRoutes, routerActionOf,
  resolveMediaRef, resourceColor, resourceString,
} from '../renderer/shared'
import { parse } from '../parser/parser'
import { renderNode } from '../renderer/Renderer'

describe('extractImports：import 声明提取', () => {
  it('命名/默认/别名/包名导入', () => {
    const pre = [
      `import { PageView } from '../components/PageView';`,
      `import { router, display } from '@kit.ArkUI';`,
      `import Foo from './Foo';`,
      `import { A as B } from './x';`,
      `import Def, { Named } from './both';`,
    ].join('\n')
    const out = extractImports(pre)
    expect(out).toHaveLength(5)
    expect(out[0]).toEqual({ names: ['PageView'], from: '../components/PageView' })
    expect(out[1].names).toEqual(['router', 'display'])
    expect(out[2]).toEqual({ names: ['Foo'], from: './Foo' })
    expect(out[3].names).toEqual(['B'])
    expect(out[4].names).toEqual(['Named', 'Def'])
  })
})

describe('resolveImport：相对导入路径解析', () => {
  const files = {
    'proj/entry/src/main/ets/pages/ReadingPage.ets': '',
    'proj/entry/src/main/ets/components/PageView.ets': '',
  }
  it('上级目录相对路径命中', () => {
    expect(resolveImport('proj/entry/src/main/ets/pages/ReadingPage.ets', '../components/PageView', files))
      .toBe('proj/entry/src/main/ets/components/PageView.ets')
  })
  it('包名与缺失文件返回 null', () => {
    expect(resolveImport('proj/entry/src/main/ets/pages/ReadingPage.ets', '@kit.ArkUI', files)).toBeNull()
    expect(resolveImport('proj/entry/src/main/ets/pages/ReadingPage.ets', '../data/Missing', files)).toBeNull()
  })
})

describe('routeTarget：router url → 项目文件', () => {
  const files = {
    'proj/entry/src/main/ets/pages/Index.ets': '',
    'proj/entry/src/main/ets/pages/ReadingPage.ets': '',
    'proj/entry/src/main/ets/components/ReadingPageHelper.ets': '',
  }
  it('pages/ReadingPage 命中页面文件', () => {
    expect(routeTarget('pages/ReadingPage', files)).toBe('proj/entry/src/main/ets/pages/ReadingPage.ets')
  })
  it('未命中返回 null', () => {
    expect(routeTarget('pages/Nowhere', files)).toBeNull()
  })
})

describe('pickStartFile：起始页选择', () => {
  it('优先 pages/Index + @Entry', () => {
    const files = {
      'proj/entry/src/main/ets/pages/ReadingPage.ets': '@Entry\n@Component\nstruct ReadingPage {}',
      'proj/entry/src/main/ets/pages/Index.ets': '@Entry\n@Component\nstruct Index {}',
      'proj/entry/src/main/ets/components/Card.ets': '@Component\nstruct Card {}',
    }
    expect(pickStartFile(files)).toBe('proj/entry/src/main/ets/pages/Index.ets')
  })
  it('无 @Entry 时退到第一个文件', () => {
    expect(pickStartFile({ 'a/Card.ets': '@Component\nstruct Card {}' })).toBe('a/Card.ets')
    expect(pickStartFile({})).toBeNull()
  })
})

describe('媒体与资源文件分类', () => {
  it('扩展名识别', () => {
    expect(isImageFile('a.png')).toBe(true)
    expect(isVideoFile('b.MP4')).toBe(true)
    expect(isMediaFile('c.txt')).toBe(false)
  })
  it('mediaKeyOf 去目录去扩展名', () => {
    expect(mediaKeyOf('entry/src/main/resources/base/media/cover.png')).toBe('cover')
    expect(mediaKeyOf('clip.mp4')).toBe('clip')
  })
  it('parseResourceJson 解析 color/string json', () => {
    expect(parseResourceJson('{"color":[{"name":"primary","value":"#112233"}]}')).toEqual({ primary: '#112233' })
    expect(parseResourceJson('{"string":[{"name":"app_name","value":"阅读"}]}')).toEqual({ app_name: '阅读' })
    expect(parseResourceJson('{}')).toBeNull()
    expect(parseResourceJson('not json')).toBeNull()
  })
})

describe('buildComponents：跨文件组件表', () => {
  const files = {
    'proj/entry/src/main/ets/pages/Detail.ets': [
      `import { Card } from '../components/Card';`,
      `@Entry`,
      `@Component`,
      `struct Detail {`,
      `  build() {`,
      `    Column() {`,
      `      Card()`,
      `    }`,
      `  }`,
      `}`,
    ].join('\n'),
    'proj/entry/src/main/ets/components/Card.ets': [
      `@Component`,
      `export struct Card {`,
      `  build() {`,
      `    Text('card')`,
      `  }`,
      `}`,
    ].join('\n'),
  }
  it('import 的组件解析进组件表', () => {
    const path = 'proj/entry/src/main/ets/pages/Detail.ets'
    const ir = parse(files[path])
    const comps = buildComponents(path, ir, files)
    expect(comps.Card?.structName).toBe('Card')
  })
})

describe('router 导航动作提取', () => {
  it('findRouterAction：pushUrl/replaceUrl/back', () => {
    expect(findRouterAction(`() => router.back()`)).toEqual({ kind: 'back' })
    expect(findRouterAction(`router.pushUrl({ url: 'pages/ReadingPage', params: { bookId: bookId } })`))
      .toEqual({ kind: 'push', url: 'pages/ReadingPage' })
    expect(findRouterAction(`() => { this.open(id) }`)).toBeNull()
  })

  it('extractMethodRoutes：方法体内的导航调用', () => {
    const src = [
      `@Entry`, `@Component`, `struct A {`,
      `  build() {`,
      `    Column() { Text('x') }`,
      `  }`,
      `  open(bookId: number): void {`,
      `    router.pushUrl({ url: 'pages/ReadingPage', params: { bookId: bookId } }).catch(() => {});`,
      `  }`,
      `  stay(): void {`,
      `    this.x = 1;`,
      `  }`,
      `}`,
    ].join('\n')
    const routes = extractMethodRoutes(parse(src))
    expect(routes.open).toEqual({ kind: 'push', url: 'pages/ReadingPage' })
    expect(routes.stay).toBeUndefined()
  })

  it('routerActionOf：内联优先，间接调用查方法表', () => {
    const mk = (raw: string) => ({
      type: 'Text', ctorArgs: [], children: [],
      modifiers: [{ name: 'onClick', args: [{ t: 'raw' as const, v: raw }] }],
    })
    expect(routerActionOf(mk(`() => router.back()`))).toEqual({ kind: 'back' })
    expect(routerActionOf(mk(`() => this.open(it.book.id)`), { open: { kind: 'push', url: 'pages/ReadingPage' } }))
      .toEqual({ kind: 'push', url: 'pages/ReadingPage' })
    expect(routerActionOf(mk(`() => this.noop()`), {})).toBeNull()
    expect(routerActionOf({ type: 'Text', ctorArgs: [], children: [], modifiers: [] })).toBeNull()
  })
})

describe('resolveMediaRef：媒体引用解析', () => {
  const media = { cover: 'data:image/png;base64,AAA', clip: 'data:video/mp4;base64,BBB' }
  it('$r/$rawfile/路径/URL', () => {
    expect(resolveMediaRef({ t: 'raw', v: `$r('app.media.cover')` }, media)).toBe(media.cover)
    expect(resolveMediaRef({ t: 'raw', v: `$rawfile('res/cover.png')` }, media)).toBe(media.cover)
    expect(resolveMediaRef({ t: 'str', v: 'common/imgs/cover.png' }, media)).toBe(media.cover)
    expect(resolveMediaRef({ t: 'str', v: 'https://x/y.png' }, media)).toBe('https://x/y.png')
    expect(resolveMediaRef({ t: 'str', v: 'common/missing.png' }, media)).toBeUndefined()
    expect(resolveMediaRef(undefined, media)).toBeUndefined()
  })
})

describe('项目资源表（颜色/字符串）', () => {
  it('项目 color.json 优先于内置色表', () => {
    const a = { t: 'raw' as const, v: `$r('app.color.primary')` }
    expect(resourceColor(a, { primary: '#123456' })).toBe('#123456')
    expect(resourceColor(a)).toBe('#667eea') // 内置表
    expect(resourceString({ t: 'raw', v: `$r('app.string.app_name')` }, { app_name: '阅读' })).toBe('阅读')
  })
})

describe('媒体渲染（SSR）', () => {
  it('Image 命中媒体表渲染真图，未命中走占位', () => {
    const src = [
      `@Entry`, `@Component`, `struct T {`,
      `  build() {`,
      `    Column() {`,
      `      Image($r('app.media.cover'))`,
      `      Image($r('app.media.missing'))`,
      `    }`,
      `  }`,
      `}`,
    ].join('\n')
    const ir = parse(src)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, {
        states: ir.states,
        res: { media: { cover: 'data:image/png;base64,AAA' }, colors: {}, strings: {} },
      })}</>,
    )
    expect(html).toContain('<img')
    expect(html).toContain('data:image/png;base64,AAA')
    expect(html).toContain('[Image:') // 未命中的仍是占位
  })

  it('Text 命中 $r 字符串资源时渲染文案', () => {
    const src = [
      `@Entry`, `@Component`, `struct T {`,
      `  build() {`,
      `    Column() {`,
      `      Text($r('app.string.app_name'))`,
      `    }`,
      `  }`,
      `}`,
    ].join('\n')
    const ir = parse(src)
    const html = renderToStaticMarkup(
      <>{renderNode(ir.root, [], null, () => {}, null, false, {
        states: ir.states,
        res: { media: {}, colors: {}, strings: { app_name: '阅读器' } },
      })}</>,
    )
    expect(html).toContain('阅读器')
  })
})
