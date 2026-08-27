/** 默认 CDN 配置 */
const defaultCdn: Record<string, string> = {
  mermaid: "https://registry.npmmirror.com/mermaid/11.17.2/files/dist/mermaid.min.js",
};

/**
 * 获取 CDN URL
 * @param name CDN 名称，如 'mermaid'
 * @param cdn 外部传入的 CDN 配置，如 { mermaid: 'https://...' }
 * @returns CDN URL，优先使用外部传入的配置
 */
export function getCdnUrl(name: string, cdn?: Record<string, string>): string {
  return cdn?.[name] ?? defaultCdn[name] ?? '';
}

export default defaultCdn;