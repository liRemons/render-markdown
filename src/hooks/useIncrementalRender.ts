import { useRef, useEffect, useState, useCallback } from 'react';
import morphdom from 'morphdom';
import renderMarkdown, { MarkdownPlugin, AnchorItem } from '@/components/RenderMarkdown/utils/render-markdown';

interface UseIncrementalRenderOptions {
  /** Markdown 内容 */
  content: string;
  /** 代码类型包装 */
  codeType?: string;
  /** 自定义 markdown-it 插件 */
  customRenderers?: MarkdownPlugin[];
  /** morphdom patch 节流时间（ms），默认 16（~60fps） */
  throttleMs?: number;
}

/**
 * 增量渲染 hook，使用 morphdom 进行部分 DOM 更新。
 *
 * - 首次渲染：使用 innerHTML 设置初始内容
 * - 后续渲染：渲染为字符串，然后通过 morphdom patch 容器
 * - 节流 patch 调用，避免流式输出期间过多 DOM 操作
 * - 返回 inner 内容 <div> 的 ref 回调
 */
export function useIncrementalRender({
  content,
  codeType,
  customRenderers,
  throttleMs = 16,
}: UseIncrementalRenderOptions) {
  const [anchors, setAnchors] = useState<AnchorItem[]>([]);
  const [hasContent, setHasContent] = useState(false);

  const lastContentRef = useRef('');
  const lastHtmlRef = useRef('');
  const innerDivRef = useRef<HTMLDivElement | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const isInitialRef = useRef(true);

  const schedulePatch = useCallback((newContent: string) => {
    pendingContentRef.current = newContent;

    if (throttleTimerRef.current != null) {
      clearTimeout(throttleTimerRef.current);
    }

    throttleTimerRef.current = setTimeout(() => {
      const targetContent = pendingContentRef.current;
      if (targetContent === null) return;
      pendingContentRef.current = null;

      const renderContent = (!codeType || codeType?.toLocaleLowerCase() === 'md')
        ? targetContent
        : '```' + codeType + '\n' + targetContent + '\n```';

      doRenderAndPatch(renderContent);
    }, throttleMs);
  }, [codeType, throttleMs]);

  const doRenderAndPatch = useCallback(async (text: string) => {
    const inner = innerDivRef.current;
    if (!inner) return;

    const markdownInfo = await renderMarkdown(text, customRenderers);
    if (!markdownInfo) return;

    const newHtml = markdownInfo.info;
    if (!newHtml) return;
    setAnchors(markdownInfo.anchor || []);

    // 渲染期间内容已变化，丢弃过期结果
    if (pendingContentRef.current !== null) return;

    lastHtmlRef.current = newHtml;

    if (isInitialRef.current) {
      inner.innerHTML = newHtml;
      isInitialRef.current = false;
      setHasContent(true);
      lastContentRef.current = text;
    } else {
      // childrenOnly 模式：包裹 HTML，只更新子节点
      const wrapper = document.createElement('div');
      wrapper.innerHTML = newHtml;
      
      morphdom(inner, wrapper, {
        childrenOnly: true,
        onBeforeNodeAdded(el) {
          // 跳过 .pre-handle 元素（包含 React 工具栏），会在 patch 后由 initCodeToolbars 重新初始化
          if (el.nodeType === 1 && (el as HTMLElement).classList.contains('pre-handle')) {
            return false;
          }
          // 返回 el，允许节点正常添加
          return el;
        },
      });
      lastContentRef.current = text;
    }
  }, [customRenderers]);

  useEffect(() => {
    if (!content) {
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

    setHasContent(true);
    
    // 首次内容直接渲染，不节流
    if (isInitialRef.current) {
      doRenderAndPatch(wrappedContent);
      return;
    }

    schedulePatch(content);

    return () => {
      if (throttleTimerRef.current != null) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [content, codeType, schedulePatch, doRenderAndPatch]);

  useEffect(() => {
    return () => {
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