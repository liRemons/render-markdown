import React, { useEffect, useState, useRef } from 'react';
import { CopyFilled, CaretRightOutlined, CaretDownOutlined, ExportOutlined } from '@ant-design/icons';
import { createRoot, Root } from 'react-dom/client';
import customMessage from '@/components/CustomMessage';
import CustomBackTop from '@/components/CustomBackTop';
import Empty from '@/components/Empty';
import { copy } from 'methods-r';
import renderMarkdown from './utils/render-markdown';
import { initImageToolbars, cleanupImageToolbars } from '../ImagePreview';
import './markdown.global.less';
import './index.global.less';

/** 记录 initCodeToolbars 中为每个 <pre> 创建的 React Root，防止内存泄漏 */
const codeRootMap = new Map<HTMLElement, Root>();

/** Mermaid 渲染防抖延迟（ms）默认值。content 停止变化超过该时间后才统一渲染图表，避免 SSE 打字机过程中闪烁 */
const DEFAULT_MERMAID_DEBOUNCE = 10;

/**
 * 初始化 amap 容器的事件绑定和图标替换
 */
const initAmapContainers = () => {
  document.querySelectorAll('.amap-container').forEach((container) => {
    // const url = (container as HTMLElement).dataset.url || '';
    const label = (container as HTMLElement).dataset.label || '';
    
    const copyBtn = container.querySelector('.amap-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(label).then(() => {
          customMessage.success('已复制');
        }).catch(() => {
          customMessage.error('复制失败');
        });
      });
    }

    const linkBtn = container.querySelector('.amap-link-btn');
    if (linkBtn) {
      // 替换图标为 Ant Design Icon
      const iconSpan = linkBtn.querySelector('.amap-icon');
      if (iconSpan) {
        const root = createRoot(iconSpan);
        root.render(<ExportOutlined style={{ fontSize: '16px' }} />);
      }
    }
  });
};

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
    footer,
    backTopTarget = document.body,
    mermaidDebounce,
  } = props;
  const [html, setHtml] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 用 ref 存储最新 props，避免 useEffect 闭包陈旧问题
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let toolbarMermaidTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    // 异步初始化：markdown 文本立即渲染（保证打字机效果），
    // 代码工具栏 + Mermaid 图表防抖延迟渲染（避免 SSE 流式过程中重复 hack 导致闪烁）
    const init = async () => {
      const { codeType } = propsRef.current;
      let text = '';
      if (!codeType || codeType?.toLocaleLowerCase() === 'md') {
        text = content;
      } else {
        text = '```' + codeType + '\n' + content + '\n```';
      }

      const markdownInfo = await renderMarkdown(text);
      if (cancelled) return; // content 已变化，丢弃过期结果
      setHtml(markdownInfo?.info);

      // 防抖：content 停止变化 MERMAID_DEBOUNCE ms 后才统一渲染代码工具栏和 Mermaid。
      // - SSE 打字机过程中 content 持续变化，timer 会被反复重置，不会触发 mermaid hack
      // - 只有当 content 稳定（流结束或暂停）后才会扫描并渲染图表
      // - 此时 mermaid 源码通常已完整，避免对不完整源码的渲染
      toolbarMermaidTimer = setTimeout(async () => {
        if (cancelled) return;
        initCodeToolbars(propsRef.current);
        
        // 初始化图片工具栏
        const { isPrintPreview } = propsRef.current;
        initImageToolbars(containerRef, isPrintPreview);

        // 初始化 amap 容器事件
        initAmapContainers();

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

      // 卸载代码工具栏 React Root
      codeRootMap.forEach((root, handleDOM) => {
        root.unmount();
        handleDOM.remove();
      });
      codeRootMap.clear();
      
      // 清理图片工具栏和 Viewer 实例
      cleanupImageToolbars();
    };
  }, [content]);

  return (
    <div className='markdown'>
      {
        html ?
          <div className='markdown-html' ref={containerRef}>
            <div style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: html }} />
            {footer && <div className="markdown-footer">{footer}</div>}
          </div>
          : <Empty />
      }
      {showBackTop && <CustomBackTop target={() => backTopTarget} />}
    </div>
  )
}