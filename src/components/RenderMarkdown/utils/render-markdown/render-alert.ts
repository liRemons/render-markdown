// Alert 类型配置
export const alertTitles: Record<string, string> = {
  note: '注',
  tip: '提示',
  important: '重要',
  warning: '注意',
  caution: '警告',
};

export const alertIcons: Record<string, string> = {
  note: '<i class="iconfont icon-note"></i>',
  tip: '<i class="iconfont icon-tip"></i>',
  important: '<i class="iconfont icon-important"></i>',
  warning: '<i class="iconfont icon-warning"></i>',
  caution: '<i class="iconfont icon-caution"></i>',
};

/**
 * 后处理 alert HTML，将默认标题替换为配置的中文标题
 * 当自定义标题与类型名相同（忽略大小写）时，替换为配置的标题
 */
export function postProcessAlerts(html: string): string {
  return html.replace(
    /class="markdown-alert markdown-alert-(\w+)"[\s\S]*?class="markdown-alert-title"[^>]*>([\s\S]*?)<\/p>/g,
    (match: string, type: string, titleHtml: string) => {
      const configured = alertTitles[type];
      if (!configured) return match;
      const plainText = titleHtml.replace(/<[^>]*>/g, '').trim();
      if (plainText.toLowerCase() === type.toLowerCase()) {
        // 只替换最后一个 > 后面的纯文本，避免替换 HTML 属性中的内容
        const lastGtIndex = titleHtml.lastIndexOf('>');
        if (lastGtIndex !== -1) {
          const beforeTag = titleHtml.substring(0, lastGtIndex + 1);
          const afterTag = titleHtml.substring(lastGtIndex + 1);
          const newAfterTag = afterTag.replace(plainText, configured);
          const newTitleHtml = beforeTag + newAfterTag;
          return match.replace(titleHtml, newTitleHtml);
        }
      }
      return match;
    }
  );
}