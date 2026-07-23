# render-markdown

一个基于 React 的 Markdown 渲染组件，支持 GFM（GitHub Flavored Markdown）Tabs 标签、代码高亮、Mermaid 图表等功能。

## 技术方案

### 技术栈

| 类别 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | React 18 | 组件库基础框架 |
| 构建工具 | Vite | 基于 Rollup 的极速构建器 |
| 语言 | TypeScript | 提供类型定义 |
| 样式方案 | CSS Modules / 内联样式 | 轻量无外部依赖 |
| 代码规范 | ESLint + Prettier | 统一代码风格 |
| 发布工具 | changesets | 语义化版本管理与 changelog 生成 |

### 核心功能

- **GFM 支持**: 完整的 GitHub Flavored Markdown 渲染
- **代码高亮**: 基于 highlight.js 的代码语法高亮
- **Mermaid 图表**: 支持 Mermaid 语法渲染流程图、时序图等
- **Tab 标签页**: 支持 Tab 标签页语法
- **Alert 提示框**: 支持警告、提示等信息框
- **目录锚点**: 自动生成文档目录和锚点链接（自行实现目录渲染）
- **代码复制**: 一键复制代码块
- **代码折叠**: 支持代码块折叠展开

## API

### 安装

```bash
npm install remons-render-markdown
```

### 导出内容

```typescript
import RenderMarkdown, { markdownFormat, languagesCommon,  initHighlighter } from 'remons-render-markdown';
```

#### 默认导出
- **RenderMarkdown**: React 组件，用于渲染 Markdown 内容

#### 命名导出
- **markdownFormat**: Markdown 解析函数，返回 `{ anchor: AnchorItem[], info: string }`
- **languagesCommon**: 默认支持的语言包配置（javascript, typescript, css, json, bash, xml, plaintext）
- **initHighlighter**: 初始化高亮语言包的函数

### RenderMarkdown 组件 Props

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| content | string | ✅ | - | Markdown 内容 |
| createTime | string | ❌ | - | 创建时间，用于显示文档更新时间 |
| isSlotMermaid | boolean | ❌ | true | 是否使用 Mermaid 插件渲染图表 |
| isShowCollapsed | boolean | ❌ | true | 是否显示代码折叠按钮 |
| codeType | string | ❌ | - | 指定代码类型（如 'javascript' 等），不传则按 Markdown 渲染 |
| editButton | React.ReactNode | ❌ | - | 自定义编辑按钮 |

### markdownFormat 函数

解析 Markdown 内容并返回结构化数据。

**参数：**
- `content: string` - Markdown 文本内容

**返回值：**
```typescript
{
  anchor: Array<{
    title: string;        // 标题文本
    href: string;         // 锚点链接
    nodeName: string;     // 节点名称，如 "H1", "H2"
    nodeTitle: string;    // 完整节点 HTML
    children: Array<...>; // 子标题
  }>;
  info: string;           // 渲染后的 HTML 字符串
}
```

### initHighlighter 函数

注册自定义的代码高亮语言。

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
import RenderMarkdown from 'render-markdown';
import 'render-markdown/dist/index.css';

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
```

### 完整示例

```tsx
import RenderMarkdown from 'render-markdown';
import 'render-markdown/dist/index.css';

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
      createTime="2026-07-23T12:00:00Z"
      isSlotMermaid={true}
      isShowCollapsed={true}
      editButton={<button>编辑</button>}
    />
  );
}
```

### 使用 markdownFormat 获取目录结构

```tsx
import { markdownFormat } from 'render-markdown';

function TableOfContents() {
  const content = '# 标题1\n## 标题1.1\n## 标题1.2\n# 标题2';
  const { anchor, info } = markdownFormat(content);
  
  console.log(anchor); 
  // [
  //   { title: '标题1', href: '标题1', nodeName: 'H1', children: [...] },
  //   { title: '标题2', href: '标题2', nodeName: 'H1', children: [] }
  // ]
  
  return <div dangerouslySetInnerHTML={{ __html: info }} />;
}
```

### 自定义代码高亮语言

```tsx
import RenderMarkdown, { initHighlighter, languagesCommon } from 'render-markdown';
import 'render-markdown/dist/index.css';
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
import RenderMarkdown from 'render-markdown';
import 'render-markdown/dist/index.css';

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
      isSlotMermaid={false}
    />
  );
}
```

### 关于语法
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

#### Alert 提示框
依赖于 `@mdit/plugin-alert` 插件，参考 [mdit-plugin-alert](https://mdit-plugins.github.io/zh/alert.html) 的文档。

语法示例：
```markdown
> [!warning]
> 我是一个警告信息
```

#### 目录锚点

## 注意事项

1. **样式引入**：务必引入 `remons-render-markdown/dist/index.css` 以确保正确的样式渲染
2. **Mermaid 支持**：当 `isSlotMermaid` 为 `true` 时，会自动渲染 mermaid 代码块为图表
3. **代码高亮**：请使用 `initHighlighter` 注册（必须）
4. **安全性**：外部链接会自动添加 `target="_blank"` 和 `rel="noopener"` 属性
5. **性能优化**：Mermaid 渲染会延迟执行，以优化首屏加载速度