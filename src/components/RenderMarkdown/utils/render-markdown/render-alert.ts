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
 * 清理字符串中的 emoji 和前后空格
 */
function cleanText(text: string): string {
  return text
    // 移除常见的 emoji 范围
    .replace(/[\u{1F000}-\u{1FFFF}\u{200D}\u{FE0F}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

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
      const plainText = titleHtml.replace(/<[^>]*>/g, '');
      const cleanedText = cleanText(plainText);
      if (cleanedText.toLowerCase() === type.toLowerCase()) {
        // 只替换最后一个 > 后面的内容，移除前后空格和 emoji
        const lastGtIndex = titleHtml.lastIndexOf('>');
        if (lastGtIndex !== -1) {
          const beforeTag = titleHtml.substring(0, lastGtIndex + 1);
          const afterTag = titleHtml.substring(lastGtIndex + 1);
          // 清理 afterTag 中的 emoji 和前后空格，然后替换
          const cleanedAfterTag = cleanText(afterTag);
          const newAfterTag = cleanedAfterTag.replace(cleanedText, configured);
          const newTitleHtml = beforeTag + newAfterTag;
          return match.replace(titleHtml, newTitleHtml);
        }
      }
      return match;
    }
  );
}