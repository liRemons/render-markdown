import React, { useEffect, useState } from 'react';
import { CopyFilled, CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons';
import { createRoot } from 'react-dom/client';
import customMessage from '@/components/CustomMessage';
import CustomBackTop from '@/components/CustomBackTop';
import Empty from '@/components/Empty';
import { copy } from 'methods-r';
import dayjs from 'dayjs';
import renderMarkdown from './utils/render-markdown';
import './markdown.global.less';
import './index.global.less';


interface Props {
  /**
   * Markdown 内容
   */
  content: string;
  /**
  * 创建时间
  */
  createTime?: string;
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
  * 显示编辑按钮
  */
  editButton?: React.ReactNode;
  /**
   * 返回顶部所依赖的容器
   * HTMLElement
   */
  backTopTarget?: HTMLElement;
  /**
  * 是否显示新手引导
  */
  showDriverGuide?: boolean;
}


const initCodeClassName = (props: Props) => {
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

    function CodeToggle() {
      const [isCollapsed, setIsCollapsed] = useState(false);
      return <span className="code-toggle" onClick={() => {
        setIsCollapsed(!isCollapsed);
        if (isCollapsed) {
          preNode?.classList.remove('code-collapsed');
        } else {
          preNode?.classList.add('code-collapsed');
        }
      }}>
        {isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
      </span>
    }
    root.render(<>
      <span>
        {codeTypeDOM}
      </span>
      <span>
        {copyDOM}
        {isShowCollapsed && <CodeToggle />}
      </span>
    </>)
  });
};

export default function RenderMarkdown(props: Props) {
  const { content, createTime, showBackTop, isSlotMermaid = true, codeType, editButton, backTopTarget = document.body, showDriverGuide } = props;
  const [html, setHtml] = useState('');
  useEffect(() => {
    let timer = null;
    
    // 异步初始化
    const init = async () => {
      // 注册默认支持的语言列表
      if (!codeType || codeType?.toLocaleLowerCase() === 'md') {
        setHtml(renderMarkdown(content)?.info);
      } else {
        const text = '```' + codeType + '\n' + content + '\n```'
        setHtml(renderMarkdown(text)?.info);
      }

      timer = setTimeout(async () => {
        initCodeClassName(props);
        if (isSlotMermaid) {
          // DOM 更新完毕 1s 后渲染 Mermaid, 牺牲 cls 换取首屏加载速度
          const { renderMermaidWithControls: renderMermaid } = await import('../MermaidRenderer');
          await renderMermaid({ showDriverGuide });
        }
      }, 10);
    };
    
    init();

    return () => {
      timer = null
      clearTimeout(timer!)
    }
  }, [content])

  return (
    <div className='markdown'>
      {
        html ?
          <div className='markdown-html'>
            <div style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: html }} />
            <div className="markdown-footer">
              {
                createTime && <div className="create-time">
                  文档更新于 {dayjs(createTime).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              }
              &nbsp;
              {
                editButton
              }
            </div>
          </div>
          : <Empty />
      }
      {showBackTop && <CustomBackTop target={() => backTopTarget} />}
    </div>
  )
}