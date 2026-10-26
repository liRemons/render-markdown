/** 默认 CDN 配置（可通过 registerCdn 覆盖，供库使用方全局定制） */
const defaultCdn: Record<string, string> = {
  mermaid: "https://registry.npmmirror.com/mermaid/11.17.2/files/dist/mermaid.min.js",
};

/**
 * 注册/覆盖全局默认 CDN 地址（初始化时调用一次，全局生效）
 * @param name CDN 名称，如 'mermaid'
 * @param url 完整脚本 URL；传空字符串视为删除该注册
 */
export function registerCdn(name: string, url: string): void {
  if (url) {
    defaultCdn[name] = url;
  } else {
    delete defaultCdn[name];
  }
}

/**
 * 获取 CDN URL
 * @param name CDN 名称，如 'mermaid'
 * @param cdn 外部传入的 CDN 配置，如 { mermaid: 'https://...' }
 * @returns CDN URL，优先使用外部传入的配置
 * @throws 当外部配置与默认配置均无该名称时抛错，避免静默加载失败
 */
export function getCdnUrl(name: string, cdn?: Record<string, string>): string {
  const url = cdn?.[name] ?? defaultCdn[name];
  if (!url) {
    throw new Error(
      `[render-markdown] 未找到名为 "${name}" 的 CDN 配置，请通过 cdn 属性或 registerCdn() 注册`
    );
  }
  return url;
}

export default defaultCdn;