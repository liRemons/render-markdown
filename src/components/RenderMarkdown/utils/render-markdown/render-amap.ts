import markdownItContainer from 'markdown-it-container';

/**
 * 渲染高德地图链接容器
 * 语法: :::amap {"url": "xxx", "label": "地址"}
 */
export function renderAmap(md: any) {
  md.use(markdownItContainer, 'amap', {
    validate: (params: string) => {
      return params.trim().match(/^amap\s*(.*)$/);
    },

    render: (tokens: any[], idx: number) => {
      const token = tokens[idx];
      const m = token.info.trim().match(/^amap\s*(.*)$/);

      if (token.nesting === 1) {
        // 开始标签
        let url = '';
        let label = '';

        if (m && m[1]) {
          try {
            // 兼容末尾带有 ::: 的情况，去除尾部冒号
            const configStr = m[1].trim().replace(/:+$/, '');
            const config = JSON.parse(configStr);
            url = config.url || '';
            label = config.label || '';
          } catch (e) {
            console.warn('[render-amap] Failed to parse config:', e);
          }
        }

        return `<div class="amap-container" data-url="${md.utils.escapeHtml(url)}" data-label="${md.utils.escapeHtml(label)}">
        <span class="amap-label">
          <img src="https://remons.cn:3008/upload/content/icon/%E9%AB%98%E5%BE%B7%E5%9C%B0%E5%9B%BE.svg" />
          ${md.utils.escapeHtml(label)}
        </span>  
        <div class="amap-actions">
            <div class="amap-copy-btn">
              <span class="amap-icon amap-copy-icon"></span> 复制地址
            </div>
            <a href="${md.utils.escapeHtml(url)}" target="_blank" rel="noopener" class="amap-link-btn">
              <span class="amap-icon amap-link-icon"></span> 打开导航
            </a>
          </div>
        </div>`;
      } else {
        // 结束标签
        return '</div>';
      }
    },
  });
}

export default renderAmap;
