import RenderMarkdown from './components/RenderMarkdown';
import type { RenderMarkdownProps } from './components/RenderMarkdown';
/**
 * markdownFormat
 * Markdown 解析函数（异步：内部等待 KaTeX CDN 就绪；加载失败时公式降级为文本）
 * 返回 { anchor: AnchorItem[], info: string }
 */
import markdownFormat from './components/RenderMarkdown/utils/render-markdown';
/** 
 * languagesCommon
 * 默认高亮语言配置
 */
import languagesCommon from './components/RenderMarkdown/utils/render-markdown/languagesCommon';
/**
 * initHighlighter 
 * 初始化高亮器
 * @param languages - 高亮器语言配置
 */
import { initHighlighter } from './components/RenderMarkdown/utils/render-markdown';

/**
 * defaultValidateLink
 * 本库默认链接校验：markdown-it 原生名单 + 额外放行无脚本特征的 data:image/svg+xml 内联图。
 * 自定义 validateLink 时可拿它做基线复用（传入后会整体接管，不传则用它）
 */
import { defaultValidateLink } from './components/RenderMarkdown/utils/render-markdown/validate-link';

/**
 * circledNumbers
 * 带圈序号（①⑩㉑ ❶⓿、emoji keycap）钉字体插件：把序号包成 span，由样式统一字体与字号。
 * 库内已默认启用；这里导出供使用方在自己的插件链里复用/排布顺序，
 * ICircledClass / DEFAULT_CIRCLED_CLASS 供通过 .use(circledNumbers, cls) 覆盖三档类名
 */
import {
  circledNumbers,
  DEFAULT_CIRCLED_CLASS,
  type ICircledClass,
} from './components/RenderMarkdown/utils/render-markdown/circled-numbers';

/**
* Mermaid 渲染
* - MermaidChart：推荐的组件用法（元素类型稳定，重渲染不丢状态）
* - renderMermaid：旧函数用法，已标废
*/
import { MermaidChart, renderMermaid } from './components/MermaidRenderer'

/**
 * useIncrementalRender
 * 增量渲染 hook，使用 morphdom 进行 DOM 差异化更新
 * 除 content 外的选项均为初始化语义（仅挂载时读取一次）
 */
import { useIncrementalRender, MD_PERSIST_ATTR } from './hooks/useIncrementalRender'
import type { MarkdownPlugin, AnchorItem } from './components/RenderMarkdown/utils/render-markdown'

/** 图片预览全局排除名单（实例级请用 excludedSelectors prop） */
import { addExcludedSelector, removeExcludedSelector } from './components/ImagePreview'

/** 主题：Provider / hook / 防 FOUC 的显式初始化 / 模式类型 */
import { ThemeProvider, useTheme, initTheme } from './hooks/useTheme'
import type { ThemeMode } from './hooks/useTheme'

/** CDN 默认地址注册（mermaid 等懒加载资源） */
import { registerCdn } from './utils/cdn'

export default RenderMarkdown;

export type { RenderMarkdownProps, MarkdownPlugin, AnchorItem, ThemeMode, ICircledClass };
export {
  markdownFormat,
  languagesCommon,
  initHighlighter,
  defaultValidateLink,
  circledNumbers,
  DEFAULT_CIRCLED_CLASS,
  MermaidChart,
  renderMermaid,
  useIncrementalRender,
  MD_PERSIST_ATTR,
  addExcludedSelector,
  removeExcludedSelector,
  ThemeProvider,
  useTheme,
  initTheme,
  registerCdn,
};
