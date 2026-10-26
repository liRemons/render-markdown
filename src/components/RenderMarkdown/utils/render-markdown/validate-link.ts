/**
 * 本库默认的链接校验（覆盖 markdown-it 的 validateLink）
 *
 * markdown-it 原生只放行 `data:image/(gif|png|jpeg|webp);`，`data:image/svg+xml` 会被判为不安全链接，
 * 结果是 `![](data:image/svg+xml,...)` 整行退化成源码文本 —— 图标、图表、AI 产出的内联 svg 全中招。
 * 这里在原生名单之上**只额外**放行内联 svg，其余协议（javascript:/vbscript:/file: 与其它 data:）
 * 一律照旧拒绝。
 *
 * 为什么放行 svg 还需要额外过滤：validateLink 同时作用于图片语法和链接语法，
 * `<img src="data:image/svg+xml,...">` 本身是惰性的（规范里 SVG 作为图片不执行脚本、不加载外部资源），
 * 但 `<a href="data:image/svg+xml,...">` 被导航时 SVG 会作为**文档**渲染，脚本可执行。
 * 因此对 svg 载荷做一次可执行特征检查，命中就拒。这是纵深防御的启发式过滤，不是沙箱；
 * 渲染真正不可信的内容仍应把 `html={false}` 打开，必要时传入更严的 validateLink。
 */

/** markdown-it 判定为危险、需要走白名单复核的协议 */
const BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
/** markdown-it 原生就放行的四种位图 data URI */
const BITMAP_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
/** 本库额外放行的内联 svg（`;` 带 charset/base64，`,` 直接跟载荷） */
const SVG_DATA_RE = /^data:image\/svg\+xml[;,]/i;
/** svg 载荷里的可执行特征：脚本标签、事件属性、外部实体、foreignObject 中嵌 HTML */
const SVG_ACTIVE_RE = /<\s*script|\bon[a-z]+\s*=|<!ENTITY|foreignobject/i;

/**
 * 取出 data URI 的可读载荷
 * base64 形态必须先解码再查特征，否则脚本正藏在编码里查不出来
 * @returns 解码后的文本；无法解码（缺逗号、非法 base64/转义、无 atob 环境）时返回 null
 */
function decodeDataUriPayload(url: string): string | null {
  const commaIndex = url.indexOf(',');
  if (commaIndex < 0) return null;
  const meta = url.slice(0, commaIndex);
  const payload = url.slice(commaIndex + 1);
  try {
    if (/;base64/i.test(meta)) {
      return typeof atob === 'function' ? atob(payload) : null;
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

/** 本库默认链接校验：markdown-it 名单 + 无脚本特征的内联 svg */
export function defaultValidateLink(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  // 非危险协议（http/https/mailto/相对路径等）保持 markdown-it 的放行行为
  if (!BAD_PROTO_RE.test(normalized)) return true;
  if (BITMAP_DATA_RE.test(normalized)) return true;
  if (!SVG_DATA_RE.test(normalized)) return false;
  // 解不出来就当作不可信，宁可不显示
  const payload = decodeDataUriPayload(url);
  return payload !== null && !SVG_ACTIVE_RE.test(payload);
}
