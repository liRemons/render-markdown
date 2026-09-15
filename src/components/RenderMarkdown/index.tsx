import React, { useEffect, useState, useRef } from 'react';
import { CopyFilled, CaretRightOutlined, CaretDownOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { createRoot, Root } from 'react-dom/client';
import customMessage from '@/components/CustomMessage';
import CustomBackTop from '@/components/CustomBackTop';
import Empty from '@/components/Empty';
import TocSidebar, { AnchorItem } from '../TocSidebar';
import { copy } from 'methods-r';
import renderMarkdown, { MarkdownPlugin } from './utils/render-markdown';
import { initImageToolbars, cleanupImageToolbars, addExcludedSelector } from '../ImagePreview';
import { useIncrementalRender } from '@/hooks/useIncrementalRender';
import './markdown.global.less';
import './index.global.less';
import styles from './index.module.less';

/** 记录 initCodeToolbars 中为每个 <pre> 创建的 React Root，防止内存泄漏 */
const codeRootMap = new Map<HTMLElement, Root>();

/** Mermaid 渲染防抖延迟（ms）默认值。content 停止变化超过该时间后才统一渲染图表，避免 SSE 打字机过程中闪烁 */
const DEFAULT_MERMAID_DEBOUNCE = 10;


/**
 * 代码折叠/展开切换组件
 */
function CodeToggle({ preNode }: { preNode: HTMLElement }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const handleClick = () => {
    setIsCollapsed(!isCollapsed);
    preNode.classList.toggle('code-collapsed', isCollapsed);
  };
  return (
    <span className="code-toggle" onClick={handleClick}>
      {isCollapsed ? <CaretDownOutlined /> : <CaretRightOutlined />}
    </span>
  );
}


export interface RenderMarkdownProps {
  /**
   * Markdown 内容
   */
  content: string;
  /**
  * 是否显示返回顶部
  */
  showBackTop?: boolean;
  /**
  * 是否使用 Mermaid 插件
  */
  isSlotMermaid?: boolean;
  /**
  * 是否显示代码折叠
  */
  isShowCollapsed?: boolean;
  /**
  * 代码类型
  */
  codeType?: string;
  /**
  * 自定义底部内容
  */
  footer?: React.ReactNode;
  /**
   * 返回顶部所依赖的容器
   * HTMLElement
   */
  backTopTarget?: HTMLElement;
  /**
  * 是否显示新手引导
  */
  showDriverGuide?: boolean;
  /**
   * 是否为打印模式
   */
  isPrintPreview?: boolean;
  /**
 * 自定义配置函数，对渲染前 text 进行修改
 * @returns 
 */
  chartConfig?: (text: string) => string;
  /**
  * 默认是否折叠代码
  */
  defaultCollapsed?: boolean;
  /**
  * Mermaid 渲染防抖延迟（ms），默认 10ms
  */
  mermaidDebounce?: number;
  /**
   * 自定义 CDN 配置，如 { mermaid: 'https://...' }
   */
  cdn?: Record<string, string>;
  /**
   * 自定义 markdown-it 渲染器插件列表，在内部渲染器之后按序执行
   */
  customRenderers?: MarkdownPlugin[];
  /**
   * 图片预览排除名单，自定义渲染器容器内的图片不会被 Viewer.js 处理
   * 如：['.copy-password-container']
   */
  excludedSelectors?: string[];
  /**
   * 是否显示目录（TOC）按钮和侧边栏
   */
  showToc?: boolean;
  /**
   * 是否启用增量渲染（使用 morphdom 进行 DOM 差异化更新）
   * 适用于流式输出或编辑器场景，避免全量重绘导致的状态丢失
   */
  useIncremental?: boolean;
  /**
   * 增量渲染节流时间（ms），默认 16
   */
  incrementalThrottleMs?: number;
}


const initCodeToolbars = (props: Pick<RenderMarkdownProps, 'isSlotMermaid' | 'isShowCollapsed' | 'isPrintPreview'>) => {
  const { isSlotMermaid = true, isShowCollapsed = true } = props;
  document.querySelectorAll('.markdown-html code[class*="language-"]').forEach((item) => {
    const codeType = item.className.replace('language-', '').trim();
    const slotMermaidClassName = (isSlotMermaid && codeType === 'mermaid') ? 'mermaid-render-noCode' : ''
    const copyId = `copy-${crypto.randomUUID()}`;
    const preNode = item.parentNode as HTMLElement;

    if (preNode?.querySelector('.pre-handle')) {
      return
    }
    const handleDOM = document.createElement('div');
    handleDOM.className = 'pre-handle';
    const code = preNode?.querySelector<HTMLPreElement>('code');
    code?.classList.add(copyId)
    if (slotMermaidClassName) {
      code?.classList.add(slotMermaidClassName)
    }
    preNode?.insertBefore(handleDOM, preNode.querySelector('code'));
    const codeTypeDOM = <>
      <img src="https://remons.cn:3008/upload/md_assets/code_icon.png" alt="" />
      <span>{codeType}</span>
    </>

    const copyDOM = <span className="copy" onClick={() => {
      const dom = document.querySelector(`.${copyId}`);
      if (dom) {
        copy(dom);
        customMessage.success('复制成功');
      }
    }}><CopyFilled /></span>
    const root = createRoot(handleDOM)
    codeRootMap.set(handleDOM, root)

    root.render(<>
      <span>
        {codeTypeDOM}
      </span>
      <span className="code-handle">
        {copyDOM}
        {isShowCollapsed && <CodeToggle preNode={preNode} />}
      </span>
    </>)
  });
};

export default function RenderMarkdown(props: RenderMarkdownProps) {
  const {
    content,
    showBackTop,
    showToc: enableToc,
    footer,
    backTopTarget = document.body,
    mermaidDebounce,
    useIncremental = false,
    incrementalThrottleMs,
  } = props;
  const [html, setHtml] = useState('');
  const [anchors, setAnchors] = useState<AnchorItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [showToc, setShowToc] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 用 ref 存储最新 props，避免 useEffect 闭包陈旧问题
  const propsRef = useRef(props);
  propsRef.current = props;

  // 增量渲染：使用 morphdom 进行 DOM 差异化更新
  const { anchors: incAnchors, hasContent, setInnerRef } = useIncrementalRender({
    content,
    codeType: props.codeType,
    customRenderers: props.customRenderers,
    throttleMs: incrementalThrottleMs,
  });

  // 合并两种模式的 anchors
  const effectiveAnchors = useIncremental ? incAnchors : anchors;
  // 合并两种模式的内容判断
  const showContent = useIncremental ? hasContent : !!html;

  // 合并渲染逻辑：content 变化时，先渲染 markdown，再防抖初始化工具栏 + Mermaid
  useEffect(() => {
    let toolbarMermaidTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const init = async () => {
      // 非增量模式：先渲染 markdown，增量模式在 hook 中处理
      if (!useIncremental) {
        const { codeType } = propsRef.current;
        let text = '';
        if (!codeType || codeType?.toLocaleLowerCase() === 'md') {
          text = content;
        } else {
          text = '```' + codeType + '\n' + content + '\n```';
        }

        const markdownInfo = await renderMarkdown(text, propsRef.current.customRenderers);
        if (cancelled) return;
        setHtml(markdownInfo?.info);
        setAnchors(markdownInfo?.anchor || []);
      }

      // 两种模式共用：防抖初始化代码工具栏、图片工具栏和 Mermaid
      toolbarMermaidTimer = setTimeout(async () => {
        if (cancelled) return;
        initCodeToolbars(propsRef.current);

        const { isPrintPreview, excludedSelectors } = propsRef.current;
        if (excludedSelectors) {
          addExcludedSelector(excludedSelectors);
        }
        initImageToolbars(containerRef, isPrintPreview);

        const { isSlotMermaid, showDriverGuide, chartConfig, defaultCollapsed, cdn } = propsRef.current;
        if (isSlotMermaid) {
          // DOM 稳定后统一渲染 Mermaid
          const { renderMermaidWithControls: renderMermaid } = await import('../MermaidRenderer');
          await renderMermaid({ showDriverGuide, isPrintPreview, chartConfig, defaultCollapsed, cdn });
        }
      }, mermaidDebounce ?? DEFAULT_MERMAID_DEBOUNCE);
    };

    init();

    return () => {
      cancelled = true;
      if (toolbarMermaidTimer) clearTimeout(toolbarMermaidTimer);

      // 非增量模式：卸载代码工具栏 React Root 和清理图片工具栏
      if (!useIncremental) {
        codeRootMap.forEach((root, handleDOM) => {
          root.unmount();
          handleDOM.remove();
        });
        codeRootMap.clear();
        cleanupImageToolbars();
      }
    };
  }, [content]);

  // IntersectionObserver 监听标题滚动，更新 activeId
  useEffect(() => {
    if (effectiveAnchors.length === 0) return;

    const allHrefs: string[] = [];
    const collectHrefs = (items: AnchorItem[]) => {
      items.forEach(item => {
        allHrefs.push(item.href);
        if (item.children?.length) {
          collectHrefs(item.children);
        }
      });
    };
    collectHrefs(effectiveAnchors);

    const elements = allHrefs.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 多个标题可能同时进入检测区域，取最靠近视口顶部的那个
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top ? entry : closest
        );
        setActiveId(topMost.target.id);
      },
      { rootMargin: '0px 0px -90% 0px', threshold: 0 }
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [effectiveAnchors]);

  // 页面 hash 支持：初始定位 + 监听 hash 变化
  useEffect(() => {
    // 根据当前 hash 滚动到对应元素
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(hash);
      }
    };

    // DOM 渲染后执行初始定位
    const timer = setTimeout(scrollToHash, 100);

    // 监听 hash 变化（浏览器前进/后退按钮）
    const handleHashChange = () => scrollToHash();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [effectiveAnchors]);

  // 根据模式确定 inner div 的属性
  const innerProps = useIncremental
    ? { ref: setInnerRef as any }
    : { dangerouslySetInnerHTML: { __html: html } };

  return (
    <div className='markdown'>
      {showContent ? (
        <div className='markdown-html' ref={containerRef}>
          <div style={{ width: '100%' }} {...innerProps} />
          {footer && <div className="markdown-footer">{footer}</div>}
        </div>
      ) : (
        <Empty />
      )}
      {showBackTop && <CustomBackTop target={() => backTopTarget} />}

      {/* 目录按钮 */}
      {enableToc && effectiveAnchors.length > 0 && (
        <div className={styles.tocToggle} onClick={() => setShowToc(!showToc)}>
          <UnorderedListOutlined />
        </div>
      )}

      {/* 目录面板 */}
      {enableToc && (
        <TocSidebar
          anchors={effectiveAnchors}
          activeId={activeId}
          visible={showToc}
          onClose={() => setShowToc(false)}
        />
      )}
    </div>
  );
}