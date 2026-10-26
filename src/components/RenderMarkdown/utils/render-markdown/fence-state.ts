import type { Token } from 'markdown-it';

/** 未闭合围栏的 <code> 上追加的标记 class（无样式，仅供上层判断"这段还没写完"） */
export const FENCE_OPEN_CLASS = 'md-fence-open';

/**
 * 给「源码末尾尚未闭合」的围栏代码块打标记。
 *
 * 为什么需要：流式（打字机/SSE）输出时，最后一个 ``` 围栏常常只有开头没有结尾，
 * 而 markdown-it 的 fence 规则在找不到闭合行时会吞到输入末尾、照常产出一个 code token
 * （见其源码：haveEndMarker 只用于推进 state.line，**不会记录到 token 上**）。
 * 于是残缺的 Mermaid 源码被当成完整图表送去 mermaid.render()，
 * 每个增量片段都必然抛 Parse error（实测 67 个前缀里 31 个失败），表现为控制台刷屏 + 红框闪现。
 *
 * 判定规则按 CommonMark：只有最后一个 fence token 可能未闭合（未闭合围栏会吞掉其后全部内容），
 * 闭合行需与起始行同种标记、长度不小于起始行、且该行之后只有空白。
 */
export function markUnclosedFence(tokens: Token[], src: string): void {
  let fence: Token | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === 'fence') {
      fence = tokens[i];
      break;
    }
  }
  if (!fence || !fence.map) return;

  const lines = src.split('\n');
  const startLine = fence.map[0];
  const markup = fence.markup || '```';
  const marker = markup[0] === '~' ? '~' : '`';
  const len = Math.max(3, markup.length);
  // marker 在正则里不是元字符，直接拼接即可；不要用模板字符串写反引号（会截断模板）
  const closing = new RegExp('^ {0,3}' + marker + '{' + len + ',}[ \\t]*$');

  // 从内容首行起找闭合行：找到即已闭合（第一个匹配行就是真正的闭合行）
  for (let i = startLine + 1; i < lines.length; i++) {
    if (closing.test(lines[i])) return;
  }
  fence.attrJoin('class', FENCE_OPEN_CLASS);
}
