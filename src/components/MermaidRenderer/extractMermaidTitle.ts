/**
 * 从 Mermaid 源码中提取 title 字段
 * @param source - Mermaid 源码字符串
 * @returns 提取到的标题，未找到时返回默认值
 */
export function extractMermaidTitle(source: string): string {
  const titleMatch = source.match(/---\s*\n\s*title:\s*(.+)\s*\n\s*---/);
  return titleMatch ? titleMatch[1].trim() : 'mermaid 图表';
}
