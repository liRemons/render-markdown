# render-markdown

一个基于 React 的 Markdown 渲染组件，支持 GFM（GitHub Flavored Markdown）Tabs 标签、代码高亮、Mermaid 图表等功能。

渲染效果
![整体渲染效果](https://remons.cn:3008/upload/md_assets/%E6%95%B4%E4%BD%93%E6%B8%B2%E6%9F%93%E6%95%88%E6%9E%9C.png)

## 技术方案

### 技术栈

| 类别 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | React 18 | 组件库基础框架（peer 依赖） |
| 构建工具 | Vite（库模式，ESM 单产物） | `vite.lib.config.ts` 构建库，`vite.config.ts` 跑示例页 |
| 语言 | TypeScript | 提供类型定义（`dist/index.d.ts`） |
| 样式方案 | Less + CSS Modules | 统一提取为 `dist/index.css`，需手动引入 |
| 图片预览 | PhotoSwipe v5（`photoswipe`，零依赖 ESM） | Pointer Events 手势：以指针/手指为锚点连续缩放、拖拽带惯性、双指外划与竖向拖出关闭 |
| 代码规范 | ESLint + Prettier | 统一代码风格 |
| 发布工具 | changesets | 语义化版本管理与 changelog 生成 |

### 核心功能

- **GFM 支持**: 完整的 GitHub Flavored Markdown 渲染
- **增量渲染**: 基于 morphdom 的 DOM 差异化更新，适用于流式输出场景
- **代码高亮**: 基于 highlight.js 的代码语法高亮
- **Mermaid 图表**: 支持 Mermaid 语法渲染流程图、时序图等
- **Tab 标签页**: 支持 Tab 标签页语法
- **Alert 提示框**: 支持警告、提示等信息框
- **目录锚点**: 从标题 token 流自动采集，无需在正文写 `[[TOC]]` 指令
- **代码复制**: 一键复制代码块
- **代码折叠**: 支持代码块折叠展开
- **深色模式**: 自动适配深色/浅色主题
- **多实例安全**: 工具栏 / 图片预览 / 图表均在组件容器作用域内工作，互不干扰

### 本地开发与示例页

```bash
npm install
npm run dev        # 打开 http://localhost:5173，示例页覆盖全部能力与修复点
npm run typecheck  # tsc --noEmit
npm run build      # 产出 dist/index.mjs + dist/index.css + *.d.ts
```

## API

### 安装

```bash
npm install remons-render-markdown
```

产物为 **ESM only**（`"type": "module"`，无 `require` 导出），请配合打包器使用。
`highlight.js`、`react`、`react-dom`、`@ant-design/icons` 为 **peer 依赖**，需由使用方自行安装。
其余运行时依赖（`markdown-it`、`morphdom`、`photoswipe`、`@panzoom/panzoom` 等）在 `dependencies` 中声明，构建时 external，由包管理器解析。

### 导出内容

```typescript
// 默认导出 + 命名导出
import RenderMarkdown, {
  markdownFormat,
  languagesCommon,
  initHighlighter,
  useIncrementalRender,
  MD_PERSIST_ATTR,
  MermaidChart,
  renderMermaid,
  ThemeProvider,
  useTheme,
  initTheme,
  addExcludedSelector,
  removeExcludedSelector,
  defaultValidateLink,
  registerCdn,
} from 'remons-render-markdown';

// 类型
import type { RenderMarkdownProps, MarkdownPlugin, AnchorItem, ThemeMode } from 'remons-render-markdown';

// 样式（构建产物为 dist/index.css）
import 'remons-render-markdown/style.css';
```

#### 默认导出

- **RenderMarkdown**: React 组件，用于渲染 Markdown 内容

#### 命名导出

- **markdownFormat**: Markdown 解析函数（**异步**），返回 `{ anchor: AnchorItem[], info: string }`
- **languagesCommon**: 默认支持的语言包配置（javascript, typescript, css, json, bash, xml, plaintext）
- **initHighlighter**: 注册高亮语言包的函数（必须调用，否则代码块无高亮）
- **useIncrementalRender**: 增量渲染 hook，使用 morphdom 进行 DOM 差异化更新，适用于流式输出场景
- **MD_PERSIST_ATTR**: `'data-md-persist'`，标记需跨增量渲染保留的 JS 动态节点
- **MermaidChart**: 独立图表组件（**推荐**）
- **renderMermaid**: 旧函数式用法，已 `@deprecated`，保留以兼容
- **ThemeProvider** / **useTheme** / **initTheme**: 主题相关；`initTheme()` 需在入口显式调用（库不再在 import 时产生全局副作用）
- **addExcludedSelector** / **removeExcludedSelector**: 图片预览的全局排除名单增删（默认名单已含 `pre` 与 `.mermaid-react-root`）
- **defaultValidateLink**: 本库默认链接校验（markdown-it 原生名单 + 放行无脚本特征的内联 svg），自定义 `validateLink` 时可拿它做基线复用
- **registerCdn**: 注册懒加载资源（如 mermaid）的默认 CDN 地址

### RenderMarkdown 组件 Props

> **初始化语义**：除 `content` 外的配置项仅在组件挂载时读取一次，渲染途中修改不会生效（需变更 `key` 重新挂载）。`backTopTarget` 同样只在首次渲染时读取。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| content | string | ✅ | - | Markdown 内容 |
| enableMermaid | boolean | ❌ | `true` | 是否把 mermaid 代码块渲染为图表 |
| showCollapseButton | boolean | ❌ | `true` | 是否显示代码块折叠按钮 |
| codeType | string | ❌ | - | 按纯代码渲染（如 `'go'`），不传则按 Markdown 渲染 |
| html | boolean | ❌ | `true` | 是否渲染源码中的原生 HTML；不可信内容请设为 `false`（增量/非增量均生效，初始化语义） |
| validateLink | (url: string) => boolean | ❌ | `defaultValidateLink` | 覆盖链接校验（初始化语义）；不传则用本库默认（markdown-it 名单 + 放行内联 svg），详见《注意事项》第 12 条 |
| incremental | boolean | ❌ | `false` | 是否启用 morphdom 增量渲染 |
| incrementalThrottleMs | number | ❌ | `16` | 增量渲染节流窗口（ms） |
| toolbarDebounceMs | number | ❌ | `100` | content 变化后工具栏/图片/图表扫描的防抖延迟（ms） |
| showToc | boolean | ❌ | `false` | 是否显示目录（TOC）按钮和侧边栏 |
| showBackTop | boolean | ❌ | `false` | 是否显示返回顶部按钮 |
| backTopTarget | HTMLElement \| null | ❌ | `document.body` | 返回顶部监听的滚动容器（仅首次渲染读取） |
| footer | React.ReactNode | ❌ | - | 内容区下方的自定义底部 |
| customRenderers | MarkdownPlugin[] | ❌ | - | 自定义 markdown-it 插件，在内置插件之后按序执行 |
| transformSource | (text: string) => string | ❌ | - | 渲染前改写 mermaid 源码 |
| defaultCollapsed | boolean | ❌ | `true` | 代码块 / 图表默认折叠状态 |
| showDriverGuide | boolean | ❌ | `false` | 是否显示图表新手引导 |
| isPrintPreview | boolean | ❌ | `false` | 打印模式（跳过交互式工具栏） |
| excludedSelectors | string[] | ❌ | - | 本实例的图片预览排除容器 |
| cdn | Record<string, string> | ❌ | - | 懒加载资源地址，如 `{ mermaid: 'https://...' }` |

**已重命名的 prop（旧名仍可用，标记为 deprecated）：**

| 旧名 | 新名 |
|------|------|
| `isSlotMermaid` | `enableMermaid` |
| `isShowCollapsed` | `showCollapseButton` |
| `mermaidDebounce` | `toolbarDebounceMs` |
| `useIncremental` | `incremental` |
| `chartConfig` | `transformSource` |

### markdownFormat 函数

解析 Markdown 内容并返回结构化数据。**异步函数**（内部等待 KaTeX CDN 就绪）。

**参数：**

- `content: string` - Markdown 文本内容
- `customPlugins?: MarkdownPlugin[]` - 自定义 markdown-it 插件
- `options?: { html?: boolean; validateLink?: (url: string) => boolean }` - `html` 默认 `true`，渲染不可信内容时设为 `false`；`validateLink` 不传则用本库默认 `defaultValidateLink`（放行无脚本特征的 `data:image/svg+xml`），传入则整体接管

**返回值（Promise）：**

```typescript
{
  anchor: Array<{
    title: string;        // 标题文本（纯文本）
    href: string;         // 锚点链接（与标题 DOM 上的 id 一致）
    nodeName: string;     // 节点名称，如 "H1", "H2"
    nodeTitle: string;    // 完整节点 HTML（已转义，勿直接 innerHTML 展示）
    children: Array<...>; // 子标题
  }>;
  info: string;           // 渲染后的 HTML 字符串
}
```

**降级行为：** KaTeX 加载失败时不抛错，公式降级为原文本并 `console.warn`；未注册高亮语言时代码块仅不染色，不影响渲染。

### initHighlighter 函数

注册自定义的代码高亮语言。`highlight.js` 为 peer + external 依赖，库不会自带语言包，**必须调用一次**才会高亮。

**参数：**

- `languages: Record<string, any>` - 语言包对象，格式为 `{ languageName: languageModule }`

**示例：**

```typescript
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';

initHighlighter({
  javascript,
  python,
});
```

## 使用方式

### 基础用法

```tsx
import RenderMarkdown, { initHighlighter, languagesCommon, ThemeProvider } from 'remons-render-markdown';
import 'remons-render-markdown/style.css';

// 入口注册一次即可
initHighlighter(languagesCommon);

function App() {
  const markdownContent = `
# Hello World

This is a **Markdown** renderer.

\`\`\`javascript
console.log('Hello');
\`\`\`
  `;

  return <RenderMarkdown content={markdownContent} />;
}

export default () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

### 完整示例

```tsx
import RenderMarkdown from 'remons-render-markdown';
import 'remons-render-markdown/style.css';

function ArticlePage() {
  const content = `
# 文章标题

这是一篇示例文章。

## 代码示例

\`\`\`javascript
const greeting = 'Hello World';
console.log(greeting);
\`\`\`

## Mermaid 图表

\`\`\`mermaid
graph TD
  A[开始] --> B[处理]
  B --> C[结束]
\`\`\`
  `;

  return (
    <RenderMarkdown
      content={content}
      enableMermaid
      showCollapseButton
      showToc
      showBackTop
      footer={<span>—— 完 ——</span>}
      html={false}
    />
  );
}
```

### 使用 markdownFormat 获取目录结构

```tsx
import { useEffect, useState } from 'react';
import { markdownFormat, type AnchorItem } from 'remons-render-markdown';

function TableOfContents({ content }: { content: string }) {
  const [anchor, setAnchor] = useState<AnchorItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    markdownFormat(content).then(({ anchor }) => {
      if (!cancelled) setAnchor(anchor);
    });
    return () => { cancelled = true; };
  }, [content]);

  // anchor 为树形结构，无需在正文写 [[TOC]] 指令
  return (
    <ul>
      {anchor.map((item) => (
        <li key={item.href}>
          <a href={`#${item.href}`}>{item.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

### 自定义代码高亮语言

```tsx
import RenderMarkdown, { initHighlighter, languagesCommon } from 'remons-render-markdown';
import 'remons-render-markdown/style.css';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';

// 注册额外的语言
initHighlighter({
  ...languagesCommon,  // 包含默认语言
  python,
  go,
});

function App() {
  return (
    <RenderMarkdown
      content={`
\`\`\`python
def hello():
    print('Hello')
\`\`\`

\`\`\`go
package main
import "fmt"
func main() {
    fmt.Println("Hello")
}
\`\`\`
      `}
    />
  );
}
```

### 仅渲染特定代码类型

```tsx
import RenderMarkdown from 'remons-render-markdown';
import 'remons-render-markdown/style.css';

function CodeViewer() {
  const code = `
const x = 1;
const y = 2;
console.log(x + y);
  `;

  return (
    <RenderMarkdown
      content={code}
      codeType="javascript"
      enableMermaid={false}
    />
  );
}
```

### 使用 useIncrementalRender 实现增量渲染

`useIncrementalRender` 适用于流式输出场景（如 AI 对话），通过 morphdom 实现高效的 DOM 差异化更新。
一般场景直接给 `<RenderMarkdown incremental />` 即可，需自行控制容器时才直接使用该 hook。

```tsx
import { useIncrementalRender } from 'remons-render-markdown';

function StreamingContent({ content }) {
  const { anchors, hasContent, setInnerRef } = useIncrementalRender({
    content,
    // 可选：节流时间，默认 16ms
    throttleMs: 16,
  });

  return (
    <div>
      {hasContent && <div ref={setInnerRef} />}
      {anchors.length > 0 && (
        <ul>
          {anchors.map((item) => (
            <li key={item.href}>
              <a href={`#${item.href}`}>{item.title}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| content | string | ✅ | - | Markdown 内容（**唯一响应式参数**） |
| codeType | string | ❌ | - | 代码类型，不传则按 Markdown 渲染（初始化语义） |
| customRenderers | MarkdownPlugin[] | ❌ | - | 自定义 markdown-it 插件（初始化语义） |
| throttleMs | number | ❌ | `16` | 节流窗口（ms）（初始化语义） |
| onNodeDiscarded | (el: HTMLElement) => void | ❌ | - | 节点被 diff 移除后触发（含被移除子树的子节点），用于清理 React Root 等挂载状态 |
| onPatched | () => void | ❌ | - | 每次 patch 完成后、浏览器绘制前同步触发，用于恢复运行时标记 |

**初始化语义（重要）：** 除 `content` 外的所有选项仅在挂载时读取一次，渲染途中传入新值**不感知**（不会重新初始化，也不会触发重渲染）。需要切换行为时，请变更外层组件的 `key` 使其重新挂载。

**节流语义：** 真节流（leading + trailing）——首次变化立即渲染，期间最多每 `throttleMs` 渲染一次，窗口末尾的残余变化会补一次收尾渲染（而非 debounce 式的“等静默后才渲染”）。

**返回值：**

| 属性 | 类型 | 说明 |
|------|------|------|
| anchors | AnchorItem[] | 文档锚点列表 |
| hasContent | boolean | 是否有内容 |
| setInnerRef | (node: HTMLDivElement) => void | 内容容器的 ref 回调 |

**增量渲染与自定义插件（customRenderers）的配合约定：**

1. 插件产出的容器节点（如 `:::badge` / `:::linkCard` / `<plugin-container>`）按"标签 + className"语义匹配，内容位移时不同类型的块不会被错配到旧节点上。
2. 元素上 JS 后加的 `data-*` 属性（如初始化守卫位 `data-xxx-inited`）在 diff 后会被保留，"只初始化一次"的守卫逻辑不会在增量渲染中被重复触发。
3. JS 动态插入的额外子节点（如 React 挂载点、收起按钮）默认会被 diff 移除；若需跨增量渲染保留，请给节点设置 `data-md-persist` 属性（见导出常量 `MD_PERSIST_ATTR`）。
4. 被 diff 移除的节点会触发 `onNodeDiscarded`，请在此卸载挂载在其上的 React Root，避免内存泄漏。

### 关于语法

#### mermaid 图表

```code
---
title: 图表标题
---
......... 图表内容
```

- 折叠图
![mermaid 渲染图](https://remons.cn:3008/upload/md_assets/mermaid%20%E7%BC%A9%E7%95%A5%E5%9B%BE.png)

- 缩略图
![mermaid 渲染图](https://remons.cn:3008/upload/md_assets/mermaid%20%E5%B1%95%E5%BC%80%E5%9B%BE.png)
#### Tabs 标签页

依赖于 `@mdit/plugin-tab` 插件，参考 [mdit-plugin-tab](https://mdit-plugins.github.io/zh/tab.html) 的文档。
*暂不支持 tabs 嵌套*

语法示例：

```markdown
:::markdown-tabs

@tab:active tab1
    ```javascript
        console.log('Hello');
    ```

@tab tab2 
    ```typescript
        console.log('World');
    ```
:::
```
![tabs 渲染图](https://remons.cn:3008/upload/md_assets/tabs.png)

#### Alert 提示框

语法示例：

```markdown
> [!warning]
> 我是一个警告信息
```

![alert 渲染图](https://remons.cn:3008/upload/md_assets/alert.png)

#### MermaidChart 组件（推荐）/ renderMermaid 方法（已废弃）

独立渲染 Mermaid 图表，支持缩放、全屏、下载、源码查看等功能。

```tsx
import { MermaidChart } from 'remons-render-markdown';
import 'remons-render-markdown/style.css';

function MermaidComponent() {
  const mermaidCode = `
---
title: 流程图示例
---
graph TD
  A[开始] --> B[处理]
  B --> C[结束]
  `;

  // 组件形式：元素类型稳定，父组件重渲染不会卸载重建子树
  return <MermaidChart source={mermaidCode} showSourceView showCollapse />;
}
```

旧写法 `renderMermaid({ source })` 仍可用，但已标 `@deprecated`：它每次调用都返回新的元素类型，导致父组件重渲染时子树完整卸载重建（缩放/折叠/全屏状态丢失）。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| source | string | ✅ | - | Mermaid 代码字符串，支持设置标题 |
| debounceMs | number | ❌ | `300` | 图表渲染的 debounce 时间（毫秒） |
| enablePanzoom | boolean | ❌ | `true` | 是否启用缩放和平移 |
| showDownload | boolean | ❌ | `true` | 是否显示下载按钮（SVG/PNG） |
| showSourceView | boolean | ❌ | `false` | 是否显示源码查看按钮和工具栏 |
| showCollapse | boolean | ❌ | `false` | 是否显示折叠/展开按钮 |
| defaultCollapsed | boolean | ❌ | `true` | 默认折叠状态 |
| className | string | ❌ | `""` | 自定义样式类名 |
| minHeight | number | ❌ | `200` | 最小高度（像素） |
| securityLevel | `'strict' \| 'loose'` | ❌ | `'strict'` | mermaid 安全级别；`strict` 禁用图内点击事件与原始 HTML，仅完全信任图源时才用 `loose` |
| transformSource | (text: string) => string | ❌ | - | 渲染前改写源码（初始化语义）；旧名 `chartConfig` 仍可用 |
| cdn | Record<string, string> | ❌ | - | 自定义 mermaid 库地址（mermaid 本体仍走 CDN 懒加载，全局仅加载一次） |
| showDriverGuide | boolean | ❌ | `false` | 是否显示新手引导 |
| driverGuideOnce | boolean | ❌ | `true` | 引导是否每个元素只弹一次（设为 `false` 在流式重渲染下会反复弹） |
| isPrintPreview | boolean | ❌ | `false` | 打印模式 |

**功能特性：**
- 缩放：支持放大、缩小、重置视图
- 全屏：支持浏览器原生全屏模式
- 下载：支持下载 SVG 和 PNG 格式
- 源码查看：点击按钮可查看 Mermaid 源码
- 折叠/展开：支持图表的折叠和展开
- 缩略图模式：最小化时显示缩略图
- 深色模式：自动适配主题

### 主题（ThemeProvider / useTheme / initTheme）

库不再在 `import` 时修改全局 `data-theme`（避免引入隐式副作用）。需要跟随外部主题切换时：

```tsx
import { ThemeProvider, useTheme, initTheme, type ThemeMode } from 'remons-render-markdown';

// 1）入口（main.tsx）显式同步一次已存储的主题
initTheme();

// 2）应用外层包 Provider
<ThemeProvider><App /></ThemeProvider>;

// 3）任意子组件内读写模式：light | dark | system
const { mode, theme, isDark, setMode } = useTheme();
setMode('dark');
```

防 FOUC：可在 `index.html` 内联脚本里提前给 `<html>` 写 `data-theme`（读 `localStorage['app-theme-mode']`），示例页即采用此方式。

### 图片预览排除名单

```tsx
import { addExcludedSelector, removeExcludedSelector } from 'remons-render-markdown';

// 默认全局名单：`pre`（代码块里当源码展示的图）与 `.mermaid-react-root`（图表挂载点里的装饰图，
// 如标题行的 mermaid 图标）—— 它们是 UI 控件而不是文档插图，不该弹出全屏预览

// 全局：处于这些容器内的图片不进入预览画廊
addExcludedSelector('.copy-password-container');
removeExcludedSelector('.copy-password-container'); // 可撤销，避免只增不减的隐式泄漏

// 实例级：仅影响当前组件（该 prop 每次渲染实时生效，中途变更无需重挂载）
<RenderMarkdown content={md} excludedSelectors={['.avatar-group']} />;
```

预览基于 PhotoSwipe：桌面滚轮即以指针位置为锚点缩放，双击放大到原始像素（可继续放大到 2 倍），未放大时拖拽平移带惯性；
触屏单指拖拽有惯性、双指外划或竖向拖出关闭，单击图片切回/放大、点背景关闭；Esc 关闭、←/→ 切换多图。
遮罩默认是半透明 + 毛玻璃（不是 PhotoSwipe 自带的纯黑），并随 `data-theme` 切换。
样式（`.pswp` 及其 CSS 变量 `--pswp-bg`、`--pswp-icon-color` 等）已打包进 `style.css`，根节点带 `md-image-preview` class，直接覆盖 `--pswp-bg` 即可改遮罩颜色。

## 注意事项

1. **样式引入**：务必引入 `remons-render-markdown/style.css`（实际路径 `dist/index.css`）以确保正确的样式渲染
2. **ESM only**：产物无 CommonJS 入口；在 Next.js 等 SSR 项目中需作为客户端组件使用（`'use client'`）
3. **代码高亮**：`highlight.js` 为 peer 依赖，必须调用 `initHighlighter(...)` 注册语言（库不自带语言包）
4. **Mermaid 支持**：`enableMermaid`（旧名 `isSlotMermaid`）为 `true` 时自动将 mermaid 代码块渲染为图表；mermaid 库走 CDN 懒加载，可用 `cdn={{ mermaid: '...' }}` 或 `registerCdn` 指定地址，**未配置且加载失败时会报错而非静默**。图表插在代码块 `<pre>` 的**后面**（作为兄弟节点），`<pre>` 本身保留在 DOM 里、仅由 `pre:has(code.mermaid-render-noCode){display:none}` 收起——它是增量 diff 认领该块的锚点，自定义样式时不要把它从 DOM 里移除
5. **安全默认值**：mermaid `securityLevel` 默认 `strict`；外部链接自动 `target="_blank"` + `rel="noopener"`；渲染不可信内容（AI 输出/用户上传）时请设 `html={false}` 关闭原生 HTML（该开关在增量与非增量两种模式下都会透传给 markdown-it）
6. **初始化语义**：除 `content` 外的 props 均仅在挂载时读取一次，途中变更需改 `key` 重挂载
7. **多实例**：工具栏/图片预览/图表均限定在本实例容器作用域，卸载时会回收 React Root 与打开中的预览遮罩；`fullscreenchange` 为页面级事件，图表只响应自身的全屏进出，退出全屏时还原进入前的展开状态（不影响其它图表）
8. **性能**：Mermaid 渲染延迟执行（`toolbarDebounceMs`，默认 100ms）以优化首屏
9. **视图位姿**：图表重渲染（流式输出、主题切换）与折叠/展开**不再重置**用户的缩放/平移（`noBind` + `bind/destroy` 只切换事件绑定）；进入/退出全屏会重建视图，属预期
10. **全屏背景可定制**：由 CSS 变量 `--remons-markdown-mermaid-fullscreen-bg` 控制（浅色为渐变，深色已适配为 `#1a1d2e → #232840`），使用方可覆盖该变量
11. **非增量模式的代码块复用**：内容变化时会尽量复用旧 `<pre>`（先按「语言 + 原文」精确匹配，再按同语言的文档顺序兼容内容变更）以避开工具栏重建闪烁。顺序复用是启发式，因此**同一语言的代码块数量发生变化（中间插块/删块）时会全量放弃该级复用**，该语言的变动块会被重建（短暂闪烁但不会把 A 块的折叠态/滚动位带到 B 块）；需要严格不闪烁请使用 `incremental`
12. **链接校验默认为 `defaultValidateLink`（markdown-it 名单 + 放行内联 svg）**：markdown-it 原生只放行 `data:image/(gif|png|jpeg|webp);`，`data:image/svg+xml` 会被判为不安全链接丢弃，表现为正文里原样显示 `![...](data:...)` 源码而不是图片（图标、图表、AI 产出的内联 svg 全中招）。本库不会再出现这种退化：**不传 `validateLink` 也会接管**，在原生名单之上只额外放行内联 svg。为何还要多一层：`validateLink` 同时管图片语法和链接语法，`<img src="data:image/svg+xml,...">` 本身是惰性的（SVG 作为图片不执行脚本、不加载外部资源），但 `<a href="data:image/svg+xml,...">` 被导航时 SVG 会作为**文档**渲染、脚本可执行；所以默认校验会解码 data URI（base64 形态也先 `atob`）并拒掉带 `<script>` / `on*=` 事件属性 / `<!ENTITY>` / `foreignObject` 特征的 svg，解不出来的也当不可信处理。**这是纵深防御的启发式过滤，不是沙箱**：渲染真正不可信的内容仍应靠 `html={false}`（第 13 条）。传入 `validateLink` 则**整体接管**，要保留库默认可写 `validateLink={(url) => myRule(url) || defaultValidateLink(url)}`；不要把“方便”写成 `() => true`，那会连带放行 `javascript:`/`vbscript:`/`file:`
13. **`validateLink` 与 `html` 的分工**：`validateLink` 只作用于 Markdown 的链接/图片语法；`html=true` 放行的原生 HTML 块是**原样透传**的，不经过 `validateLink`（所以 `<img src="data:image/svg+xml,...">` 本来就能显示，但反过来 `<a href="javascript:...">` 也不受它拦截）。渲染不可信内容时真正的防护是 `html={false}`，此时原生标签会被转义成文本展示（示例页第 7 区）；也别把超长 base64 塞进这类会被转义展示的 HTML 里，正文会被刷屏
14. **流式输出中的半截围栏不会去渲染图表**：markdown-it 对「有开头没结尾」的 ``` 围栏会吞到输入末尾并照常输出一个完整 code token（`haveEndMarker` 不记入 token），因此残缺的 Mermaid 源码会被当成写完的图表送 `mermaid.render`——实测一份文档的 180 个前缀里有 69 个会报错。现在渲染阶段会给未闭合的 `<code>` 追加 `md-fence-open` 标记：带此标记的块**本轮不挂图表**，以普通代码块形式展示逐步输入的内容，围栏一旦闭合（下一帧）自动切换为图表。直接用 `markdownFormat` 拿 HTML 的使用方也会看到该标记 class，可自行判断“这段还没写完”
15. **图表挂载点跨渲染复用**：扫描（`renderMermaidWithControls`）以「代码块紧邻 + 源码指纹」认领挂载点（`data-md-mermaid-src`，FNV-1a 指纹）：源码没变就**完全不碰**那个节点，源码变了只往同一个 React Root 推新 props（不卸载重建），块被删除或围栏重新打开时挂载点才被卸载移除。因此图表闭合后即使后面正文继续增长，也不会重挂、不闪白、不丢缩放/全屏/折叠状态；pre 被插块挤开位置时同指纹图表会被搬回原位；非增量模式整块重建时 `<pre>` 与其图表会被一起快照再搬回。实测一份文档从 300 推到 540 字符期间：`mermaid.render` 调用 1 次、挂载点元素身份变化 0 次、SVG 消失 0 次（修复前分别为 4 次 / 8 次 / 反复交替）
16. **图片预览已换为 PhotoSwipe v5**（旧实现为 viewerjs）：预览实例按点击创建、关闭动画结束后自行销毁，所以不存在“实例内部图片列表过期”问题，增量渲染重建 `<img>` 也无需通知谁；对外 API（`addExcludedSelector`/`removeExcludedSelector`/`excludedSelectors`/`isPrintPreview`）不变。能力差异：没有旋转、没有底部缩略图导航条、没有缩放百分比浮层（多图切换交给箭头/滑动/键盘）；图片尚无尺寸时不传 `width/height`（由 PhotoSwipe 加载后自行测量，传 0 会把 fit/fill 缩放级别算歪），`srcset` 只采纳带 `w` 描述符的候选项（`1x, 2x` 会被误判）
17. **预览的缩放级与遮罩颜色已偏离 PhotoSwipe 默认值**：`secondaryZoomLevel`/`maxZoomLevel` 官方默认都是 `'fill'`（短边铺满），于是双击放大一到顶、滚轮再滚也不动，小图还会因 fit/fill 被 100% 封顶而直接被判为“不可缩放”（放大按钮不出现）；本库改为 `fit` → `1`（原始像素）→ `2`（2 倍原始像素）。另：官方无 `minZoomLevel` 选项，下限是 `min(fit, initial, secondary)` 而 `fit` 被封顶为 1，所以图片不比视口大时 100% 就是最小、根本缩不下去（不比视口小时最小也只到“长边贴屏边”）；本库在 `slide.zoomLevels.min`（公开字段）上把下限放到 `fit * 0.5`，要恢复官方行为把 `MIN_ZOOM_FACTOR_OF_FIT` 改成 1。遮罩则由官方纯黑 `#000` 改为半透明 + `backdrop-filter` 毛玻璃并跟随 `data-theme`，使用方可覆盖 `.pswp.md-image-preview` 上的 `--pswp-bg`（注意别只写 `.pswp`，特异度会输给这条）；**不要覆盖 `--pswp-icon-color-secondary`**（默认中灰 #4f4f4f），放大镜/关闭/箭头的实心部分靠它与白色描边拉开反差，改成白色系会让图标糊成一块实心
18. **预览的默认排除名单已含 `pre` 与 `.mermaid-react-root`**：前者是代码块里当源码展示的图（不是插图），后者是图表挂载点内的装饰图（如标题行的 mermaid 图标）—— 它们是 UI 控件而不是文档插图，误弹全屏预览会把图表自身的交互盖掉。名单只影响「是否进预览」：命中排除的图片仍会正常派发点击事件（以前在捕获阶段 `stopImmediatePropagation` 的写法会连带屏蔽 React 绑在图表内部的事件委托，现已去掉），要用 `removeExcludedSelector('.mermaid-react-root')` 可撤回某条默认项
19. **新增两个可覆盖变量**：`--remons-markdown-mermaid-surface`（图表容器背景，浅色 `transparent` / 深色 `#2e3350`，旧实现是在全局样式里用 `!important` 盖组件的 `var`，现已收敛到变量）与 `--remons-markdown-tabs-mask`（tabs 头部横向溢出时左右的渐隐遮罩色，旧实现写死白色，深色下会变成一层白纱）
20. **圆角跟随 token（轻微视觉变更）**：`.markdown img` / `iframe` 旧代码读的是 `--remons-markdown-border-radius` —— 这个变量从未在任何地方定义，因此一直吃 `6px` 回退；现在改为跟随实际存在的 `--remons-markdown-radius-base`（默认 `8px`）。同理：图表折叠时的底部渐隐旧实现是 `transparent` 渐变到 `var(--remons-markdown-color-bg)`（浅色下也是 `transparent`）—— 遮罩从来没出现过，现在渐变到 `--remons-markdown-color-bg-white`，两套主题都可见
21. **样式不再拉远程字体**：旧版 `assets/css/index.global.less` 里有一条 Google Fonts 的 `@import`，但它不是文件首条声明，会被构建里的 CSS minifier 直接丢弃（dev 生效、prod 不生效），已删除；字体栈统一由 `--remons-markdown-font-family-base` 控制，需要自定义字体时由使用方自己 `@font-face`。alert 图标仍依赖 `iconfont` 的远程样式表（见该文件内的说明）
22. **`!important` 已收敛（覆盖变得更简单）**：`.markdown` 的标题 margin、`.remons-markdown-circle` 的圆角/阴影、tabs 按钮的边框与阴影、TOC 的 `backdrop-filter` 均不再带 `!important`，使用方可直接用同特异度规则覆盖。附带修正一个旧 bug：标题的 `margin: 6px 0 !important` 会把自己下面的 `h*:first-child { margin-top: 0 }` 压死，所以首屏第一个标题上方一直多一段 6px，现在归零真正生效


