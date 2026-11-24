/** 脚注开关配置 */
export interface FootnoteCollapsibleOptions {
  /**
   * 展开/收起开关的文案（`<summary>` 文本），默认 `'注释'`。
   * 有脚注时会自动追加条数，如 `脚注（3）`。作为 HTML 输出前会转义。
   */
  label?: string;
}

/** 转义写入 HTML 的文本（label 属开发者配置，仍做一次转义兜底） */
function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 脚注折叠开关（纯标记，无 JS）
 *
 * markdown-it-footnote 默认把脚注区渲染成常显的 `hr.footnotes-sep` + `section.footnotes`。
 * 这里在其之后覆盖 block 的开/合渲染规则，把脚注区包进原生 `<details>`（默认 closed = 收起），
 * `<summary>` 即用户可点击的「展开/收起」开关 —— 依赖浏览器原生交互，不需要任何脚本。
 * 同时不再输出 `hr.footnotes-sep`（summary 就是分隔行）。
 *
 * 依赖：必须在 `.use(markdownItFootnote)` 之后 `.use(footnoteCollapsible, opts)`，
 * 因为要覆盖的是它注册的 `footnote_block_open` / `footnote_block_close` 规则。
 */
export function footnoteCollapsible(md: any, opts?: FootnoteCollapsibleOptions) {
  const label = escapeText(opts?.label ?? '注释');
  md.renderer.rules.footnote_block_open = (
    _tokens: any,
    _idx: number,
    _options: any,
    env: any
  ) => {
    const count: number = env?.footnotes?.list?.length || 0;
    // 不再输出默认的 `hr.footnotes-sep`：summary 开关本身就是分隔行
    return (
      '<details class="footnotes-details">\n' +
      `<summary class="footnotes-summary">${label}${count ? `（${count}）` : ''}</summary>\n` +
      '<section class="footnotes">\n' +
      '<ol class="footnotes-list">\n'
    );
  };

  md.renderer.rules.footnote_block_close = () =>
    '</ol>\n</section>\n</details>\n';
}
