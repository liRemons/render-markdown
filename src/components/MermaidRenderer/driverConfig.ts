import { IsPC } from 'methods-r';

const mermaidDriverKey = 'docList-mermaid-driver';
const menuDriverKey = 'docList-menu-driver';
const menuPcDriverKey = 'docList-pc-menu-driver';

/**
 * 生成 Mermaid 相关的新手引导配置
 * @param showSourceView 是否显示源码查看
 * @param hasSvg 是否有已渲染的图表
 */
export function getDriverConfig(showSourceView: boolean, hasSvg: boolean) {
  return [
    {
      id: menuDriverKey,
      condition: () => !localStorage[menuDriverKey] && showSourceView && !IsPC() && localStorage.docListMenuVisible !== 'true',
      onOpen: () => { localStorage[menuDriverKey] = '1'; },
      steps: [
        { element: '.docList-menu-anchor', popover: { title: '大纲', description: '点击此处您可查看大纲' } },
        { element: '.docList-menu-list', popover: { title: '列表', description: '点击此处您可查看当前分类下文章列表' } },
        { element: '.docList-menu-copyHtml', popover: { title: '复制', description: '点击此处您可复制 HTML 渲染的格式内容' } },
        { element: '.docList-menu-copyMarkdown', popover: { title: '复制', description: '点击此处您可复制 markdown 源码' } },
        { element: '.docList-menu-print', popover: { title: '打印', description: '点击此处您可跳转至打印页面，输出为PDF' } },
      ]
    },
    {
      id: menuPcDriverKey,
      condition: () => !localStorage[menuPcDriverKey] && IsPC() && showSourceView,
      onOpen: () => { localStorage[menuPcDriverKey] = '1'; },
      steps: [
        { element: '.docList-menu-copyHtml', popover: { title: '复制', description: '点击此处您可复制 HTML 渲染的格式内容' } },
        { element: '.docList-menu-copyMarkdown', popover: { title: '复制', description: '点击此处您可复制 markdown 源码' } },
        { element: '.docList-menu-print', popover: { title: '打印', description: '点击此处您可跳转至打印页面，输出为PDF' } },
        { element: '.docList-menu-mermaid-collapse', popover: { title: '展开收起mermaid', description: '点击此处按钮可一键展开收起mermaid图表' }, isShow: hasSvg },
      ]
    },
    {
      id: mermaidDriverKey,
      condition: () => {
        const result = hasSvg && !localStorage[mermaidDriverKey] && showSourceView;
        return !!result;
      },
      onOpen: () => { localStorage[mermaidDriverKey] = '1'; },
      steps: [
        { element: '.mermaid-react-root', popover: { title: 'mermaid', description: '恭喜您解锁 Mermaid 渲染图表' } },
        { element: '.mermaid-react-root .mermaid-minimize-btn', popover: { title: '缩略图', description: '点击此处按钮可查看缩略图' } },
        { element: '.mermaid-react-root .mermaid-fullscreen-btn', popover: { title: '全屏', description: '点击此处按钮可切换为全屏展示' } },
        { element: '.mermaid-react-root .mermaid-showcode-btn', popover: { title: '源码', description: '点击此处按钮查看源码弹窗' } },
        { element: '.mermaid-react-root .mermaid-collapsed-btn', popover: { title: '展开', description: '点击此处按钮展开大图' } },
      ]
    }
  ];
}
