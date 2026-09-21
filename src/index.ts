import RenderMarkdown from './components/RenderMarkdown';
import type { RenderMarkdownProps } from './components/RenderMarkdown';
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
* renderMermaid
* Mermaid渲染器
*/
import { renderMermaid } from './components/MermaidRenderer'

/**
 * useIncrementalRender
 * 增量渲染 hook，使用 morphdom 进行 DOM 差异化更新
 */
import { useIncrementalRender, MD_PERSIST_ATTR } from './hooks/useIncrementalRender'
import type { MarkdownPlugin, AnchorItem } from './components/RenderMarkdown/utils/render-markdown'

export default RenderMarkdown;

export type { RenderMarkdownProps, MarkdownPlugin, AnchorItem };
export { markdownFormat, languagesCommon, initHighlighter, renderMermaid, useIncrementalRender, MD_PERSIST_ATTR };