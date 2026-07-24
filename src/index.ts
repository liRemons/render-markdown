import RenderMarkdown from './components/RenderMarkdown';
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

export default RenderMarkdown;

export { markdownFormat, languagesCommon, initHighlighter, renderMermaid };