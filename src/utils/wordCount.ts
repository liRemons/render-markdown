/**
 * wordCount
 * Markdown 感知的字数统计：先剥离语法壳（围栏代码块、行内代码、图片、链接地址、
 * HTML 标签、强调/列表/表格等标记），只对正文文本计数。
 * 中英文分别统计：CJK 按字符计，西文按空白分词计。
 */

/** CJK 统一表意文字（含扩展 A、兼容表意文字）+ 日文假名 + 韩文谚文 */
const CJK_RE = /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
/** 西文单词：字母/数字串，允许词内连字符与撇号（don't、e-mail） */
const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

/** 剥离 markdown 语法标记，返回参与统计的纯正文 */
function stripMarkdown(src: string): string {
  return (
    src
      // 围栏代码块``` / ~~~ 整体剔除（不属于正文）
      .replace(/^(`{3,}|~{3,})[\s\S]*?^\1[ \t]*$/gm, '')
      // 行内代码 `code` 整体剔除
      .replace(/`[^`]*`/g, '')
      // 图片 ![alt](url)：保留 alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 链接 [text](url)：保留 text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 引用式链接 [text][ref] / [text]：保留 text
      .replace(/\[([^\]]*)\](?:\[[^\]]*\])?/g, '$1')
      // 自动链接 <https://...>
      .replace(/<((?:https?):\/\/[^>\s]+)>/gi, '$1')
      // 原生 HTML 标签（html:false 时也会被 markdown-it 转义，这里按源码剔除）
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      // ATX 标题前缀 #
      .replace(/^#{1,6}[ \t]+/gm, '')
      // 引用前缀 >
      .replace(/^>[ \t]?/gm, '')
      // 无序列表与任务列表标记
      .replace(/^[ \t]*[-*+][ \t]+(\[[ xX]\][ \t]+)?/gm, '')
      // 有序列表标记
      .replace(/^[ \t]*\d+[.()][ \t]+/gm, '')
      // 水平分割线
      .replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, '')
      // 表格分隔行与单元格竖线
      .replace(/^[ \t]*\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/gm, '')
      .replace(/\|/g, '')
      // 强调/删除线/高亮标记（成对符号，去掉符号保留文本）
      .replace(/(\*\*\*|\*\*|\*|___|__|_){1,3}/g, '')
      .replace(/~~|\+\+/g, '')
  );
}

export interface WordCountResult {
  /** CJK 字符数（中日韩文，按字计） */
  chinese: number;
  /** 西文单词数（按词计） */
  words: number;
  /** 正文总字数 = chinese + words */
  total: number;
  /** 剥离语法标记后的正文字符数（含空白） */
  characters: number;
  /** 正文字符数（不含空白） */
  charactersWithoutSpaces: number;
}

/**
 * 统计 Markdown 正文字数（语法标记不计入）
 * @param content - Markdown 源码
 */
export function countWords(content: string): WordCountResult {
  const text = typeof content === 'string' ? stripMarkdown(content) : '';
  const chineseMatches = text.match(CJK_RE);
  const chinese = chineseMatches ? chineseMatches.length : 0;
  // 去掉 CJK 后再匹配西文词，避免中文串里的全角字符干扰分词边界
  const wordMatches = text.replace(CJK_RE, ' ').match(WORD_RE);
  const words = wordMatches ? wordMatches.length : 0;
  const noSpace = text.replace(/\s/g, '');

  return {
    chinese,
    words,
    total: chinese + words,
    characters: text.length,
    charactersWithoutSpaces: noSpace.length,
  };
}

/** 内置模板，供组件默认展示与文档引用同一口径 */
export const DEFAULT_WORD_COUNT_TEMPLATE = '字数统计 {total}';

/**
 * 占位符别名：均指向 {total}。`{wordCount}` / `{count}` 是最自然的拼写，
 * 不兜底的话写的人只会看到未替换的占位符，比多两行映射更费解
 */
const TEMPLATE_ALIASES: Record<string, keyof WordCountResult> = {
  wordCount: 'total',
  count: 'total',
};

/**
 * 按模板渲染字数统计文案，占位符为 `{WordCountResult 字段名}`：
 * `{total}` / `{chinese}` / `{words}` / `{characters}` / `{charactersWithoutSpaces}`，
 * 其中 `{total}` 另有 `{wordCount}` / `{count}` 两个别名。
 * 非字符串或空串一律降级为内置模板，未知占位符原样保留，让写错的字段名可见而非静默消失。
 * @param template - 模板字符串
 * @param result - 计数结果
 */
export function formatWordCount(
  template: unknown,
  result: WordCountResult,
): string {
  const tpl = typeof template === 'string' && template ? template : DEFAULT_WORD_COUNT_TEMPLATE;
  // 别名表与结果对象都先查自有属性、不用 in 也不直接取下标：
  // 否则 {constructor} / {toString} 这类写法会从原型链上拿到函数，拼出一段源码
  return tpl.replace(/\{(\w+)\}/g, (placeholder, raw: string) => {
    if (Object.prototype.hasOwnProperty.call(TEMPLATE_ALIASES, raw)) {
      return String(result[TEMPLATE_ALIASES[raw]]);
    }
    return Object.prototype.hasOwnProperty.call(result, raw)
      ? String(result[raw as keyof WordCountResult])
      : placeholder;
  });
}
