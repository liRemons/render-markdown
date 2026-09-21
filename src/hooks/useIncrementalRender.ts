import { useRef, useEffect, useState, useCallback } from 'react';
import morphdom from 'morphdom';
import renderMarkdown, { MarkdownPlugin, AnchorItem } from '@/components/RenderMarkdown/utils/render-markdown';

/**
 * 属性名：标记"由 JS 动态插入、需跨增量渲染保留"的节点。
 * 带此属性的节点在 morphdom diff 时不会被移除（如插件容器内 JS 插入的收起按钮）。
 */
export const MD_PERSIST_ATTR = 'data-md-persist';

interface UseIncrementalRenderOptions {
  /** Markdown 内容 */
  content: string;
  /** 代码类型包装 */
  codeType?: string;
  /** 自定义 markdown-it 插件 */
  customRenderers?: MarkdownPlugin[];
  /** morphdom patch 节流时间（ms），默认 16（~60fps） */
  throttleMs?: number;
  /**
   * 节点被 morphdom diff 移除后触发（含被移除子树的递归子节点）。
   * 用于清理挂在被移除节点上的 React Root、监听器等状态。
   */
  onNodeDiscarded?: (el: HTMLElement) => void;
}

/**
 * JS 运行时动态追加的 class，不参与节点语义签名计算：
 * 这些 class 每次 diff 都可能变化，计入签名会导致节点无法被复用。
 */
const JS_ADDED_CLASSES = new Set([
  'mermaid-render-noCode',
  'code-collapsed',
  'has-left-mask',
  'has-right-mask',
  'has-both-masks',
  'active',
]);

/**
 * 为元素节点生成稳定的语义 key，供 morphdom 做 keyed 匹配：
 * - 优先 id（如 markdown-it-anchor 给标题挂的 id），保证语义对应；
 * - 其次"标签名 + 规范化 className"（排除 JS 动态追加的 class），
 *   让插件产出的不同容器（badge / shareCode / linkCard 等）按类型匹配，
 *   避免内容位移时不同类型的块被按位置错配（旧状态挂到错误元素上）；
 * - 无法确定语义时返回 null，回退 morphdom 默认的位置匹配。
 */
function getNodeSignature(node: Node): string | null {
  if (node.nodeType !== 1) return null;
  const el = node as HTMLElement;
  const id = el.getAttribute('id');
  if (id) return `id:${id}`;
  const raw = typeof el.className === 'string' ? el.className : '';
  const normalized = raw
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('copy-') && !JS_ADDED_CLASSES.has(c))
    .join(' ');
  if (!normalized) return null;
  return `${el.tagName.toLowerCase()}#${normalized}`;
}

/**
 * 增量渲染 hook，使用 morphdom 进行部分 DOM 更新。
 *
 * - 首次渲染：使用 innerHTML 设置初始内容
 * - 后续渲染：渲染为字符串，然后通过 morphdom patch 容器
 * - 节流 patch 调用，避免流式输出期间过多 DOM 操作
 * - 渲染序号保证内容变化后，飞行中的渲染结果不会污染新状态
 * - 按"标签 + className"语义 key 匹配节点，保护 customRenderers（插件）产出的容器状态
 * - 保留节点上 JS 添加的 data-* 属性（初始化守卫位），避免 patch 后被重复初始化
 * - 返回 inner 内容 <div> 的 ref 回调
 */
export function useIncrementalRender({
  content,
  codeType,
  customRenderers,
  throttleMs = 16,
  onNodeDiscarded,
}: UseIncrementalRenderOptions) {
  const [anchors, setAnchors] = useState<AnchorItem[]>([]);
  const [hasContent, setHasContent] = useState(false);

  const lastContentRef = useRef('');
  const lastHtmlRef = useRef('');
  const innerDivRef = useRef<HTMLDivElement | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ content: string; seq: number } | null>(null);
  const isInitialRef = useRef(true);
  /** 渲染序号：content 变化后使其自增，飞行中的旧渲染结果据此作废 */
  const renderSeqRef = useRef(0);
  const onNodeDiscardedRef = useRef<((el: HTMLElement) => void) | undefined>(undefined);
  onNodeDiscardedRef.current = onNodeDiscarded;

  const doRenderAndPatch = useCallback(async (rawContent: string, seq: number) => {
    const text = (!codeType || codeType?.toLocaleLowerCase() === 'md')
      ? rawContent
      : '```' + codeType + '\n' + rawContent + '\n```';

    const markdownInfo = await renderMarkdown(text, customRenderers);
    // 渲染期间内容已变化（或组件卸载），丢弃过期结果
    if (!markdownInfo || seq !== renderSeqRef.current) return;

    const newHtml = markdownInfo.info;
    if (!newHtml) return;

    const applyPatch = () => {
      if (seq !== renderSeqRef.current) return;
      const inner = innerDivRef.current;
      if (!inner) {
        // 首帧 hasContent 置 true 后容器可能尚未 commit 完成，下一轮重试
        setTimeout(applyPatch, 0);
        return;
      }

      setAnchors(markdownInfo.anchor || []);
      lastHtmlRef.current = newHtml;

      if (isInitialRef.current) {
        inner.innerHTML = newHtml;
        isInitialRef.current = false;
        lastContentRef.current = text;
        return;
      }

      // childrenOnly 模式：包裹 HTML，只更新子节点
      const wrapper = document.createElement('div');
      wrapper.innerHTML = newHtml;

      // data-* 快照：morphdom 会移除旧节点上新 HTML 中不存在的 data-* 属性，
      // 导致 JS 守卫位（如 data-click-inited / data-circleBound）丢失，
      // 同一元素每次 patch 后被重复初始化（重复绑定事件 / 重复 createRoot）。
      // patch 前记录、patch 后写回。
      const dataBackup = new WeakMap<HTMLElement, Map<string, string>>();

      morphdom(inner, wrapper, {
        childrenOnly: true,
        // 插件容器按语义 key 匹配，避免不同容器互相错配
        getNodeKey: (node) => getNodeSignature(node),
        onBeforeElUpdated(fromEl, toEl) {
          const backup = new Map<string, string>();
          for (const attr of Array.from(fromEl.attributes)) {
            if (attr.name.startsWith('data-') && !toEl.hasAttribute(attr.name)) {
              backup.set(attr.name, attr.value);
            }
          }
          if (backup.size) dataBackup.set(fromEl, backup);
          return true;
        },
        onElUpdated(fromEl) {
          const backup = dataBackup.get(fromEl);
          if (backup) {
            backup.forEach((value, name) => fromEl.setAttribute(name, value));
            dataBackup.delete(fromEl);
          }
        },
        onBeforeNodeAdded(el) {
          // 跳过 .pre-handle 元素（包含 React 工具栏），会在 patch 后由 initCodeToolbars 重新初始化
          if (el.nodeType === 1 && (el as HTMLElement).classList.contains('pre-handle')) {
            return false;
          }
          // 返回 el，允许节点正常添加
          return el;
        },
        onBeforeNodeDiscarded(el) {
          // 带 MD_PERSIST_ATTR 标记的节点由 JS 动态插入（插件收起按钮等），diff 不移除
          if (el.nodeType === 1 && (el as HTMLElement).hasAttribute(MD_PERSIST_ATTR)) {
            return false;
          }
          return true;
        },
        onNodeDiscarded(el) {
          if (el.nodeType === 1 && onNodeDiscardedRef.current) {
            onNodeDiscardedRef.current(el as HTMLElement);
          }
        },
      });
      lastContentRef.current = text;
    };

    applyPatch();
  }, [codeType, customRenderers]);

  const schedulePatch = useCallback((rawContent: string, seq: number) => {
    pendingRef.current = { content: rawContent, seq };

    if (throttleTimerRef.current != null) {
      clearTimeout(throttleTimerRef.current);
    }

    throttleTimerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) doRenderAndPatch(pending.content, pending.seq);
    }, throttleMs);
  }, [throttleMs, doRenderAndPatch]);

  useEffect(() => {
    if (!content) {
      // 内容清空也在渲染序号上作废一切在途渲染
      renderSeqRef.current += 1;
      isInitialRef.current = true;
      setHasContent(false);
      lastContentRef.current = '';
      lastHtmlRef.current = '';
      return;
    }

    const wrappedContent = (!codeType || codeType?.toLocaleLowerCase() === 'md')
      ? content
      : '```' + codeType + '\n' + content + '\n```';

    if (lastContentRef.current === wrappedContent) {
      return;
    }

    renderSeqRef.current += 1;
    const seq = renderSeqRef.current;
    setHasContent(true);

    // 首次内容直接渲染，不节流
    if (isInitialRef.current) {
      doRenderAndPatch(content, seq);
      return;
    }

    schedulePatch(content, seq);

    return () => {
      if (throttleTimerRef.current != null) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [content, codeType, schedulePatch, doRenderAndPatch]);

  useEffect(() => {
    return () => {
      // 组件卸载：所有在途渲染作废
      renderSeqRef.current += 1;
      if (throttleTimerRef.current != null) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  const setInnerRef = useCallback((node: HTMLDivElement | null) => {
    innerDivRef.current = node;
  }, []);

  return { anchors, hasContent, setInnerRef };
}

export default useIncrementalRender;