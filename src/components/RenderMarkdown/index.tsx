import React, { useEffect, useState, useRef } from 'react';
import { CopyFilled, CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons';
import { createRoot, Root } from 'react-dom/client';
import customMessage from '@/components/CustomMessage';
import CustomBackTop from '@/components/CustomBackTop';
import Empty from '@/components/Empty';
import { copy } from 'methods-r';
import renderMarkdown from './utils/render-markdown';
import './markdown.global.less';
import './index.global.less';

/** 记录 initCodeToolbars 中为每个 <pre> 创建的 React Root，防止内存泄漏 */
const codeRootMap = new Map<HTMLElement, Root>();

/**
 * 代码折叠/展开切换组件
 */
function CodeToggle({ preNode }: { preNode: HTMLElement }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const handleClick = () => {
    setIsCollapsed(!isCollapsed);
    preNode.classList.toggle('code-collapsed', isCollapsed);
  };
  return (
    <span className="code-toggle" onClick={handleClick}>
      {isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
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
}


const initCodeToolbars = (props: Pick<RenderMarkdownProps, 'isSlotMermaid' | 'isShowCollapsed' | 'isPrintPreview'>) => {
  const { isSlotMermaid = true, isShowCollapsed = true, isPrintPreview = false } = props;
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
    const root = codeRootMap.get(handleDOM) || createRoot(handleDOM)
    codeRootMap.set(handleDOM, root)

    root.render(<>
      <span>
        {codeTypeDOM}
      </span>
      {
        !isPrintPreview && <span>
          {copyDOM}
          {isShowCollapsed && <CodeToggle preNode={preNode} />}
        </span>
      }
    </>)
  });
};

export default function RenderMarkdown(props: RenderMarkdownProps) {
  const {
    content,
    showBackTop,
    footer,
    backTopTarget = document.body,
  } = props;
  const [html, setHtml] = useState('');

  // 用 ref 存储最新 props，避免 useEffect 闭包陈旧问题
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 异步初始化
    const init = async () => {
      const { codeType, isSlotMermaid, showDriverGuide, isPrintPreview, defaultCollapsed, chartConfig } = propsRef.current;
      // 注册默认支持的语言列表
      if (!codeType || codeType?.toLocaleLowerCase() === 'md') {
        setHtml(renderMarkdown(content)?.info);
      } else {
        const text = '```' + codeType + '\n' + content + '\n```'
        setHtml(renderMarkdown(text)?.info);
      }

      timer = setTimeout(async () => {
        initCodeToolbars(propsRef.current);
        if (isSlotMermaid) {
          // DOM 更新完毕 1s 后渲染 Mermaid, 牺牲 cls 换取首屏加载速度
          const { renderMermaidWithControls: renderMermaid } = await import('../MermaidRenderer');
          await renderMermaid({ showDriverGuide, isPrintPreview, chartConfig, defaultCollapsed });
        }
      }, 10);
    };

    init();

    return () => {
      if (timer) clearTimeout(timer);
      // 卸载所有旧的 React Root，防止内存泄漏
      codeRootMap.forEach((root) => root.unmount());
      codeRootMap.clear();
    }
  }, [content])

  return (
    <div className='markdown'>
      {
        html ?
          <div className='markdown-html'>
            <div style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: html }} />
            {footer && <div className="markdown-footer">{footer}</div>}
          </div>
          : <Empty />
      }
      {showBackTop && <CustomBackTop target={() => backTopTarget} />}
    </div>
  )
}