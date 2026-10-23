import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { CopyFilled, CaretRightOutlined, CaretDownOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { createRoot, Root } from 'react-dom/client';
import customMessage from '@/components/CustomMessage';
import CustomBackTop from '@/components/CustomBackTop';
import Empty from '@/components/Empty';
import TocSidebar, { AnchorItem } from '../TocSidebar';
import { copy } from 'methods-r';
import classnames from 'classnames';
import renderMarkdown, { MarkdownPlugin } from './utils/render-markdown';
import { initImageToolbars, cleanupImageToolbars, addExcludedSelector } from '../ImagePreview';
import { useIncrementalRender, MD_PERSIST_ATTR } from '@/hooks/useIncrementalRender';
import './markdown.global.less';
import './index.global.less';
import styles from './index.module.less';

/** 记录 initCodeToolbars 中为每个 <pre> 创建的 React Root，防止内存泄漏 */
const codeRootMap = new Map<HTMLElement, Root>();

type CodeBlockSnapshot = {
  exact: Map<string, HTMLElement[]>;
  byLanguage: Map<string, HTMLElement[]>;
};

/** 代码块身份 key：语言 + 代码原文，用于在重渲染之间匹配代码块 */
const getCodeBlockKey = (pre: HTMLElement): string | null => {
  const code = pre.querySelector('code');
  if (!code) return null;
  const language = code.className.match(/language-([^\s]+)/)?.[1] ?? '';
  return language + '\u0000' + (code.textContent ?? '');
};

/** 重渲染前快照当前 DOM 中的代码块，供非增量模式复用 */
const snapshotCodeBlocks = (root: HTMLElement | null): CodeBlockSnapshot => {
  const exact = new Map<string, HTMLElement[]>();
  const byLanguage = new Map<string, HTMLElement[]>();
  root?.querySelectorAll('pre').forEach((node) => {
    const pre = node as HTMLElement;
    const code = pre.querySelector('code');
    if (!code) return;
    const key = getCodeBlockKey(pre);
    if (key) {
      const list = exact.get(key);
      if (list) list.push(pre);
      else exact.set(key, [pre]);
    }
    const language = code.className.match(/language-([^\s]+)/)?.[1] ?? '';
    const langList = byLanguage.get(language);
    if (langList) langList.push(pre);
    else byLanguage.set(language, [pre]);
  });
  return { exact, byLanguage };
};

/**
 * 非增量模式每次内容变化都会整体替换 innerHTML，代码块连同复制/折叠工具栏
 * 会被销毁重建，表现为代码区域闪烁。这里把未变化的 <pre> 节点换回；
 * 内容变化但语言相同的代码块复用节点并原地更新 <code>，保住工具栏与语言图标。
 */
const restoreCodeBlocks = (inner: HTMLDivElement | null, snapshot: CodeBlockSnapshot | null) => {
  if (!inner || !snapshot) return;
  const pres = Array.from(inner.querySelectorAll('pre')) as HTMLElement[];
  const reused = new Set<HTMLElement>();

  // 1) 语言 + 内容都相同：直接复用旧节点
  pres.forEach((newPre) => {
    const key = getCodeBlockKey(newPre);
    if (!key) return;
    const oldPre = snapshot.exact.get(key)?.shift();
    if (!oldPre || oldPre === newPre) return;
    reused.add(oldPre);
    newPre.replaceWith(oldPre);
  });

  // 2) 内容变化的代码块：按语言顺序复用旧节点，只替换 <code> 内部
  pres.forEach((newPre) => {
    if (!newPre.isConnected) return;
    const newCode = newPre.querySelector('code');
    if (!newCode) return;
    const language = newCode.className.match(/language-([^\s]+)/)?.[1] ?? '';
    const queue = snapshot.byLanguage.get(language);
    if (!queue?.length) return;
    let oldPre: HTMLElement | undefined;
    while (queue.length) {
      const candidate = queue.shift()!;
      if (candidate !== newPre && !reused.has(candidate)) {
        oldPre = candidate;
        break;
      }
    }
    if (!oldPre) return;
    reused.add(oldPre);
    const oldCode = oldPre.querySelector('code');
    if (oldCode) oldCode.innerHTML = newCode.innerHTML;
    newPre.replaceWith(oldPre);
  });
};

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


/** 从 class 中提取代码语言（code 上还会挂 copy-id / mermaid 等动态 class） */
const getCodeLanguage = (code: HTMLElement): string =>
  code.className.match(/language-([^\s]+)/)?.[1] ?? '';

const initCodeToolbars = (props: Pick<RenderMarkdownProps, 'isSlotMermaid' | 'isShowCollapsed' | 'isPrintPreview'>) => {
  const { isSlotMermaid = true, isShowCollapsed = true } = props;
  document.querySelectorAll('.markdown-html code[class*="language-"]').forEach((item) => {
    const code = item as HTMLElement;
    const codeType = getCodeLanguage(code);
    const slotMermaidClassName = (isSlotMermaid && codeType === 'mermaid') ? 'mermaid-render-noCode' : ''
    const preNode = code.parentNode as HTMLElement | null;
    if (!preNode) return;

    const existing = preNode.querySelector('.pre-handle') as HTMLElement | null;
    if (existing) {
      // 增量 patch 后同步：morphdom 会用新 HTML 的 class 覆盖 <code>，
      // 导致复制按钮依赖的 copy-id 与 mermaid 标记被删除
      const copyId = existing.getAttribute('data-md-copy-id');
      if (copyId && !code.classList.contains(copyId)) {
        code.classList.add(copyId);
      }
      if (slotMermaidClassName) {
        code.classList.add(slotMermaidClassName);
      } else {
        code.classList.remove('mermaid-render-noCode');
      }
      const langEl = existing.querySelector('[data-md-lang]');
      if (langEl && langEl.textContent !== codeType) {
        langEl.textContent = codeType;
      }
      // 折叠按钮配置未变化时保持复用；变化时重建该工具栏
      if (existing.getAttribute('data-md-show-collapsed') === String(isShowCollapsed)) {
        return;
      }
      codeRootMap.get(existing)?.unmount();
      codeRootMap.delete(existing);
      existing.remove();
    }

    const copyId = `copy-${crypto.randomUUID()}`;
    code.classList.add(copyId);
    if (slotMermaidClassName) {
      code.classList.add(slotMermaidClassName);
    }
    const handleDOM = document.createElement('div');
    handleDOM.className = 'pre-handle';
    // 持久节点标记：增量 patch 时 morphdom 不会丢弃工具栏，避免每键重建
    handleDOM.setAttribute(MD_PERSIST_ATTR, '');
    handleDOM.setAttribute('data-md-copy-id', copyId);
    handleDOM.setAttribute('data-md-show-collapsed', String(isShowCollapsed));
    preNode.insertBefore(handleDOM, code);

    const codeTypeDOM = <>
      <img src="https://remons.cn:3008/upload/md_assets/code_icon.png" alt="" />
      <span data-md-lang>{codeType}</span>
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
  const innerDivRef = useRef<HTMLDivElement | null>(null);
  const preSnapshotRef = useRef<CodeBlockSnapshot | null>(null);

  // 用 ref 存储最新 props，避免 useEffect 闭包陈旧问题
  const propsRef = useRef(props);
  propsRef.current = props;

  // 增量渲染：diff 移除节点时清理其中的代码工具栏 React Root，避免 Root 泄漏
  const handleNodeDiscarded = useCallback((el: HTMLElement) => {
    const handles: HTMLElement[] = [];
    if (el.classList?.contains('pre-handle')) {
      handles.push(el);
    }
    el.querySelectorAll('.pre-handle').forEach((n) => handles.push(n as HTMLElement));
    handles.forEach((h) => {
      const root = codeRootMap.get(h);
      if (root) {
        root.unmount();
        codeRootMap.delete(h);
      }
    });
  }, []);

  // 增量 patch 完成后立即同步代码块工具栏：
  // morphdom 会用新 HTML 的 class 覆盖 <code>，导致 copy-id / mermaid 标记丢失
  const handlePatched = useCallback(() => {
    initCodeToolbars(propsRef.current);
  }, []);

  // 增量渲染：使用 morphdom 进行 DOM 差异化更新
  const { anchors: incAnchors, hasContent, setInnerRef } = useIncrementalRender({
    content,
    codeType: props.codeType,
    customRenderers: props.customRenderers,
    throttleMs: incrementalThrottleMs,
    onNodeDiscarded: handleNodeDiscarded,
    onPatched: handlePatched,
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
        // 替换前快照代码块节点，供 layout 阶段复用，避免代码区域整体重建
        preSnapshotRef.current = snapshotCodeBlocks(containerRef.current);
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

      // 非增量模式：只清理图片工具栏；代码块工具栏随复用保留，
      // 由 layout 阶段的 disconnected 检查按需回收
      if (!useIncremental) {
        cleanupImageToolbars();
      }
    };
  }, [content]);

  // 非增量模式：dangerouslySetInnerHTML 会整体重建预览 DOM。在浏览器绘制前
  // 把未变化的代码块节点（含工具栏）换回，避免代码区域闪烁。
  useLayoutEffect(() => {
    if (useIncremental || !html) return;
    restoreCodeBlocks(innerDivRef.current, preSnapshotRef.current);
    preSnapshotRef.current = null;
    // 清理未被复用、已随旧 DOM 一起被替换掉的代码块工具栏 Root
    codeRootMap.forEach((root, handle) => {
      if (!handle.isConnected) {
        root.unmount();
        codeRootMap.delete(handle);
      }
    });
  }, [html, useIncremental]);

  // 组件卸载：清理本容器内已挂载的代码工具栏 Root
  // （codeRootMap 是模块级、document 维度的，只清理当前容器，避免误伤其他实例）
  const unmountSnapshotRef = useRef<HTMLElement | null>(null);
  unmountSnapshotRef.current = containerRef.current;
  useEffect(() => {
    return () => {
      const container = unmountSnapshotRef.current;
      if (!container) return;
      container.querySelectorAll('.pre-handle').forEach((h) => {
        const handle = h as HTMLElement;
        const root = codeRootMap.get(handle);
        if (root) {
          root.unmount();
          codeRootMap.delete(handle);
        }
      });
    };
  }, []);

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
    : { ref: innerDivRef, dangerouslySetInnerHTML: { __html: html } };

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
        <div className={classnames(styles.tocToggle, 'md-toc-toggle', 'remons-markdown-circle')} onClick={() => setShowToc(!showToc)}>
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