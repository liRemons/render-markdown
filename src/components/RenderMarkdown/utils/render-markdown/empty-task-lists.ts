// 兜底「空任务列表项」渲染插件。
//
// markdown-it-task-lists 只会把 [ ]/[x]/[X] 后面还带正文的项转成复选框；
// 空项（如 `- [ ]`，标记后没有任何内容）会被它漏掉，于是原样输出 `[ ]`。
// 本插件在其之后运行，把这些空项补成与正常项完全一致的复选框 HTML。
// 复选的 input 片段、class 名均取自 markdown-it-task-lists 默认配置的真实产出，
// 以保证样式对齐（不要随意改字面量）。

/** 未勾选的真实 input（markdown-it-task-lists 默认产出） */
const UNCHECKED = '<input class="task-list-item-checkbox" disabled="" type="checkbox">';
/** 已勾选的真实 input */
const CHECKED = '<input class="task-list-item-checkbox" checked="" disabled="" type="checkbox">';

/** 空任务标记：整格正文恰好只有这三种之一、后面不再有任何字符 */
const EMPTY_MARKERS = new Set(['[ ]', '[x]', '[X]']);

export function emptyTaskLists(md: any) {
  md.core.ruler.after('inline', 'github-task-lists-empty', (state: any) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type !== 'inline') continue;

      const content: string = token.content;
      if (!EMPTY_MARKERS.has(content)) continue;

      // 定位该 inline 所属的 list item：跳过可能存在的 paragraph_open 后取最近的 list_item_open
      let liIdx = i - 1;
      if (liIdx >= 0 && tokens[liIdx].type === 'paragraph_open') liIdx -= 1;
      if (liIdx < 0 || tokens[liIdx].type !== 'list_item_open') continue;

      // list item 打上 task-list-item（幂等）
      ensureAttrClass(tokens[liIdx], 'task-list-item');

      // 其所属的外层列表打上 contains-task-list（幂等），交给最近的列表 open token
      for (let j = liIdx - 1; j >= 0; j--) {
        if (
          tokens[j].type === 'bullet_list_open' ||
          tokens[j].type === 'ordered_list_open'
        ) {
          ensureAttrClass(tokens[j], 'contains-task-list');
          break;
        }
      }

      // 用真实 checkbox 替换残留的 "[ ]" 文本
      // 复用当前内联 token 的构造函数（markdown-it 实例未暴露公开 Token 类）
      const checkbox = new token.constructor('html_inline', '', 0);
      checkbox.content = content === '[ ]' ? UNCHECKED : CHECKED;
      token.children = [checkbox];
      token.content = '';
    }
  });
}

/** 幂等地给 token 追加一个 class（避免与已有 class 冲突或重复） */
function ensureAttrClass(token: any, cls: string) {
  const current: string = token.attrGet('class') || '';
  const existing = current.split(/\s+/).filter(Boolean);
  if (existing.includes(cls)) return;
  token.attrSet('class', [...existing, cls].join(' '));
}

export default emptyTaskLists;