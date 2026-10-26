import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/hooks/useTheme';
import MermaidRenderer from './index';
import { FENCE_OPEN_CLASS } from '@/components/RenderMarkdown/utils/render-markdown/fence-state';
import { MD_PERSIST_ATTR, MERMAID_ROOT_CLASS, MERMAID_SRC_ATTR } from '@/utils/dom-contract';
import {
  registerMermaidRoot,
  unmountMermaidRootsAt,
  getMermaidRoot,
  cleanupMermaidRoots,
  pruneDetachedMermaidRoots,
  isMermaidChartRoot,
  hashMermaidSource,
} from './mermaidRootRegistry';

export { cleanupMermaidRoots };

interface ScanProps {
  showDriverGuide?: boolean;
  isPrintPreview?: boolean;
  transformSource?: (text: string) => string;
  /** @deprecated 旧名，等价于 transformSource（初始化语义） */
  chartConfig?: (text: string) => string;
  defaultCollapsed?: boolean;
  cdn?: Record<string, string>;
  /** 扫描作用域，默认为 document；传入容器可实现多实例隔离 */
  rootElement?: ParentNode;
}

/** 一个可以挂图表的闭合 mermaid 代码块 */
interface MermaidBlock {
  /** 代码块 <pre>：图表锚定在它之后，它本身保留在 DOM 里作为增量 diff 的锚点 */
  pre: HTMLElement;
  source: string;
  srcHash: string;
}

/**
 * 图表元素树。类型固定为模块级组件：更新时只换 props，
 * 不会因元素类型变化而整棵重建（这是保住缩放/全屏/折叠状态的前提）。
 */
function ChartTree({ source, options }: { source: string; options: ScanProps }) {
  return (
    <React.StrictMode>
      <ThemeProvider>
        <MermaidRenderer
          source={source}
          enablePanzoom
          showDownload
          showSourceView
          showCollapse
          transformSource={options.transformSource ?? options.chartConfig}
          defaultCollapsed={options.defaultCollapsed ?? true}
          isPrintPreview={options.isPrintPreview ?? false}
          minHeight={200}
          showDriverGuide={options.showDriverGuide}
          cdn={options.cdn}
        />
      </ThemeProvider>
    </React.StrictMode>
  );
}

/**
 * DOM 扫描入口（文档页使用）
 * 扫描容器内所有已闭合的 code.language-mermaid 代码块，在其**后面**插入图表挂载点。
 *
 * 关键约定：`<pre>` 保留在 DOM 中（由 CSS 隐藏源码），图表作为它的兄弟节点存在。
 * 这样增量渲染时 morphdom 仍能按 <pre> 自身的语义 key 匹配到原节点、原地无变化，
 * 而挂载点靠 MD_PERSIST_ATTR 免于被移除；两边都不会被销毁重建。
 * 早先的 `pre.replaceWith(container)` 写法会让每次 patch 都命中"签名不匹配"，
 * 图表被移除→重挂→整图重新 mermaid.render，表现为流式中反复闪白并丢失交互状态。
 *
 * 可重复调用：源码未变的块直接复用现有挂载点（不重渲染）；源码变了走 props 更新；
 * 块被删除/围栏重开的挂载点会被卸载移除，不会累积泄漏。
 */
export default async function renderMermaidWithControls(props: ScanProps = {}) {
  const { rootElement = document } = props;

  // 上一轮随整块重建被挤出去、已脱离文档的挂载点：扫描找不到它们，先回收
  pruneDetachedMermaidRoots();

  const blocks: MermaidBlock[] = [];
  rootElement.querySelectorAll('code.language-mermaid').forEach((node) => {
    const code = node as HTMLElement;
    // 围栏尚未闭合（流式输出中）：本轮不挂图表，并摘掉"隐藏源码"标记，
    // 否则该块在输入期间既没有图表、又只剩一个空位
    if (code.classList.contains(FENCE_OPEN_CLASS)) {
      code.classList.remove('mermaid-render-noCode');
      return;
    }
    const pre = code.parentElement;
    if (!pre || pre.tagName !== 'PRE') return;
    const source = (code.textContent ?? '').trim();
    blocks.push({ pre, source, srcHash: hashMermaidSource(source) });
  });

  const existingCharts = Array.from(rootElement.querySelectorAll(`.${MERMAID_ROOT_CLASS}`)) as HTMLElement[];
  const blockByPre = new Map<HTMLElement, MermaidBlock>(blocks.map((b) => [b.pre, b]));
  /** 已被某个块占用的挂载点：一个挂载点只服务一个块 */
  const used = new Set<HTMLElement>();

  // 1) 紧邻本块、且源码指纹一致 —— 什么都不做，现有图表原样保留
  for (const block of blocks) {
    const adj = block.pre.nextElementSibling;
    if (isMermaidChartRoot(adj) && adj.getAttribute(MERMAID_SRC_ATTR) === block.srcHash) used.add(adj);
  }

  // 2) 同源码的图表被 morphdom 挪了位置（前有插块/删块）：搬回来复用，同样不重渲染。
  //    紧邻某个块右侧的挂载点是那个块自己的槽位，不参与搬移，避免两边互相抢。
  for (const block of blocks) {
    const adj = block.pre.nextElementSibling;
    if (isMermaidChartRoot(adj) && used.has(adj)) continue;
    const candidate = existingCharts.find(
      (el) => !used.has(el) && !blockByPre.has(el.previousElementSibling as HTMLElement)
        && el.getAttribute(MERMAID_SRC_ATTR) === block.srcHash,
    );
    if (!candidate) continue;
    block.pre.after(candidate);
    used.add(candidate);
  }

  // 3) 逐块补齐：能复用元素身份的复用（仅更新源码 props），否则新建挂载点
  for (const block of blocks) {
    const adj = block.pre.nextElementSibling;
    if (isMermaidChartRoot(adj) && used.has(adj)) continue;

    // 紧邻但源码已变：保留同一个节点与同一个 React Root，只把新源码喂进去
    const stale = isMermaidChartRoot(adj) && !used.has(adj) ? adj : null;
    if (stale) {
      stale.setAttribute(MERMAID_SRC_ATTR, block.srcHash);
      used.add(stale);
      const root = getMermaidRoot(stale);
      if (root) {
        root.render(<ChartTree source={block.source} options={props} />);
        continue;
      }
      // Root 记录丢失（外部清空过容器等），按新建处理
      unmountMermaidRootsAt(stale);
      stale.remove();
    }

    const container = document.createElement('div');
    container.className = MERMAID_ROOT_CLASS;
    container.setAttribute(MERMAID_SRC_ATTR, block.srcHash);
    // 持久标记：增量 patch 时 morphdom 不移除本节点（见 useIncrementalRender）
    container.setAttribute(MD_PERSIST_ATTR, '');
    block.pre.after(container);

    unmountMermaidRootsAt(container);
    const root = createRoot(container);
    registerMermaidRoot(container, root);
    root.render(<ChartTree source={block.source} options={props} />);
  }

  // 4) 孤儿回收：源码被删/被改写后没人认领、或锚点已失效的图表，卸载并移除
  for (const el of existingCharts) {
    if (used.has(el)) continue;
    unmountMermaidRootsAt(el);
    el.remove();
  }
}
