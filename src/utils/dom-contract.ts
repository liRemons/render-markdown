/**
 * 跨模块共享的 DOM 契约常量（纯常量、无任何依赖）。
 *
 * 单独成模块的原因：这些标记同时被三方读写——
 * - useIncrementalRender（morphdom diff 时据此保护 / 摘除节点）
 * - RenderMarkdown（代码块工具栏、源码隐藏 class）
 * - MermaidRenderer 的 DOM 扫描（图表挂载点身份与复用判据）
 * 若各自定义字面量，任何一处改名都会静默破坏另外两处的行为，且不会报错。
 */

/**
 * 标记「由 JS 动态插入、需跨增量渲染保留」的节点：
 * 带此属性的节点在 morphdom diff 时不会被移除（如插件容器内的收起按钮、图表挂载点）。
 */
export const MD_PERSIST_ATTR = 'data-md-persist';

/** 已挂载节点的业务身份 key：morphdom 与插件恢复逻辑据此跨渲染匹配同一个节点 */
export const MD_KEY_ATTR = 'data-md-key';

/** Mermaid 图表挂载点的 class（React Root 挂在这个 div 上） */
export const MERMAID_ROOT_CLASS = 'mermaid-react-root';

/**
 * 挂载点上记录的「当前展示的是哪份源码」指纹。
 * 源码没变就直接复用这个节点（不重挂、不重渲染），变了才更新 props——
 * 这是流式场景下图表不闪白、不丢缩放/全屏状态的关键。
 */
export const MERMAID_SRC_ATTR = 'data-md-mermaid-src';
