// 带圈序号「钉字体」渲染插件。
//
// 正文里的 ①⑩㉑ 这类圈号，同一视觉序号可能落在多套码位（文本圈号 U+2460-249B、
// ⓪/实心/双圈 U+24EA-24FF、Dingbats U+2776-2793、CJK 符号块 ㉑-㊿，以及数字 +
// U+FE0F + 组合键帽 U+20E3 的 emoji keycap）。本库正文字体栈打头的 Inter 不含这些字形，
// 浏览器会**逐字符**回退到不同字体 —— 相邻两个圈一个正常一个大一圈，keycap 还按 emoji
// 渲染再大一档。调 .markdown 的 font-size/font-family 治不了，因为“大”来自字形来源漂移。
//
// 做法与 newsFlash 的 wrapCircledNumbers 同构：把圈号逐个包成 span，由样式把字体栈与
// 字号钉死。区别只在挂载点 —— markdown 的文本是 token 流里的 text token，不是 HTML 串，
// 因此在 core ruler 上（inline 之后）拆 token，不存在“插进标签属性里破坏结构”的问题。

/** 匹配三类目标：emoji keycap 序列、圈号码位族（可带尾随 U+FE0F） */
const CIRCLED_RE =
  /(\d\uFE0F?\u20E3)|([\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u3251-\u325F\u32B1-\u32BF])\uFE0F?/g;

/** 三套 Dingbats 圈号各自的「10」，圈内已是两位 */
const WIDE_DINGBATS: number[] = [0x277f, 0x2789, 0x2793];

/**
 * 带圈序号三档的类名，与 newsFlash 的 ICircledClass 同构，便于两处共用同一份分档逻辑。
 * 本库三档在 index.global.less 里是全局类名（非 CSS Module 哈希），故给出默认值；
 * 使用方若要挂自己的类名，通过插件第二参覆盖即可（markdown-it 的 .use(plugin, opts)）。
 */
export interface ICircledClass {
  /** 圈内一位数字（①-⑨、⓪、❶-❾ 等） */
  base: string;
  /** 圈内两位数字（⑩-⑳ 等），字形为装下两位数字把圈画得更大 */
  wide: string;
  /** ㉑-㊿（CJK 符号块）：西文字体普遍不收这批码位，落到中文字体按全角字身画圈，需单独一档；缺省退回 wide */
  cjk?: string;
}

/** 库内默认类名，对应 index.global.less 的 .mdNum / .mdNumWide / .mdNumCjk */
export const DEFAULT_CIRCLED_CLASS: ICircledClass = { base: 'mdNum', wide: 'mdNumWide', cjk: 'mdNumCjk' };

/** ㉑-㉟（U+3251-325F）与 ㊱-㊿（U+32B1-32BF）；32-35 圈号 Unicode 本身未收录 */
function isCjkBlock(cp: number): boolean {
  return (cp >= 0x3251 && cp <= 0x325f) || (cp >= 0x32b1 && cp <= 0x32bf);
}

/**
 * 码位是否属于「圈内两位数」一档
 * 逐段列出而不取一个上限：每段圈号都是「1-9 连续 + 10-20 连续」，两段之间还夹着字母圈号
 */
function isWideCircled(cp: number): boolean {
  return (
    (cp >= 0x2469 && cp <= 0x2473) || // ⑩-⑳
    (cp >= 0x247d && cp <= 0x2487) || // ⑽-⒇（括号式）
    (cp >= 0x2491 && cp <= 0x249b) || // ⒑-⒙（点号式）
    (cp >= 0x24eb && cp <= 0x24f4) || // ⓫-⓴（实心圈）
    (cp >= 0x3251 && cp <= 0x325f) || // ㉑-㉟
    (cp >= 0x32b1 && cp <= 0x32bf) || // ㊱-㊿
    WIDE_DINGBATS.indexOf(cp) >= 0
  );
}

/** emoji keycap（数字 + U+FE0F? + 组合键帽 U+20E3，如 9️⃣）换成对应文本圈号，顺带去掉 emoji 呈现 */
function keycapToCircled(seq: string): string {
  const digit: number = Number(seq.charAt(0));
  return digit === 0 ? '⓪' : String.fromCharCode(0x2460 + digit - 1);
}

/**
 * 序号分三档取类名：一位数字 / 两位数字 / ㉑ 起的 CJK 符号块
 * 前两档同一字体，只差字号微调；第三档是换了字体（圈按全角字身画），同字号下明显偏大，
 * 不单独给一档就会在 20 以里正常、从 21 开始又探出来。样式见 index.global.less 的
 * .mdNum / .mdNumWide / .mdNumCjk
 */
function circledClassOf(cp: number, cls: ICircledClass): string {
  if (isCjkBlock(cp)) return cls.cjk || cls.wide;
  return isWideCircled(cp) ? cls.wide : cls.base;
}

/** 包成 span 的 html_inline token 内容（圈号本身已被码位校验，无需再转义） */
function wrapGlyph(glyph: string, cls: ICircledClass): string {
  return `<span class="${circledClassOf(glyph.codePointAt(0) || 0, cls)}">${glyph}</span>`;
}

export function circledNumbers(md: any, cls: ICircledClass = DEFAULT_CIRCLED_CLASS) {
  md.core.ruler.after('inline', 'circled-numbers', (state: any) => {
    for (let i = 0; i < state.tokens.length; i++) {
      const inline = state.tokens[i];
      if (inline.type !== 'inline' || !inline.children) continue;
      splitChildren(state, inline.children, cls);
    }
  });
}

/**
 * 把 inline children 里的 text token 按圈号拆成「text / html_inline」交替序列。
 * 只动 text token：code_inline、math_inline 等非 text 类型天然不经过这里，
 * 代码与公式里的圈号保持原样，不被套上正文字体。
 */
function splitChildren(state: any, children: any[], cls: ICircledClass) {
  const TokenCtor = state.Token;
  // 预筛：绝大多数文本没有圈号，整段跳过正则
  for (let c = 0; c < children.length; c++) {
    const child = children[c];
    if (child.type !== 'text' || !CIRCLED_RE.test(child.content)) continue;
    // lastIndex 是正则对象上的全局状态，test/exec 交替使用前必须复位
    CIRCLED_RE.lastIndex = 0;

    const parts: any[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = CIRCLED_RE.exec(child.content))) {
      const glyph: string = match[1] ? keycapToCircled(match[1]) : match[2];
      if (match.index > cursor) {
        const plain = new TokenCtor('text', '', 0);
        plain.content = child.content.slice(cursor, match.index);
        parts.push(plain);
      }
      const html = new TokenCtor('html_inline', '', 0);
      html.content = wrapGlyph(glyph, cls);
      parts.push(html);
      cursor = match.index + match[0].length;
    }
    if (cursor < child.content.length) {
      const tail = new TokenCtor('text', '', 0);
      tail.content = child.content.slice(cursor);
      parts.push(tail);
    }
    // 原位替换：删掉原 text token，把拆出的序列插回同一位置
    children.splice(c, 1, ...parts);
    c += parts.length - 1;
  }
}

export default circledNumbers;
