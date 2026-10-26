import markdownIt from 'markdown-it';
import type { Token as MdToken } from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import mila from 'markdown-it-link-attributes';
import hljs from 'highlight.js/lib/core';
import { tab } from "@mdit/plugin-tab";
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts';
import taskList from 'markdown-it-task-lists';
import { emptyTaskLists } from './empty-task-lists';
import { markUnclosedFence } from './fence-state';
import { defaultValidateLink } from './validate-link';
import { alertTitles, alertIcons, postProcessAlerts } from './render-alert';
import renderTab, { tabsName } from './render-tab';
import { ensureKatexLoaded, katexPlugin } from '../markdown-it-katex';
// ==================== 工具函数 ====================

/** 轻量级 slugify，替代 uslug */
function slugify(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

/** 与 markdown-it-anchor 默认 uniqueSlug 行为一致：重复 slug 追加 -1、-2 … */
function makeUniqueSlugifier() {
  const seen = new Set<string>();
  return (s: string): string => {
    let base = s;
    let suffix = 1;
    while (seen.has(base)) {
      base = `${s}-${suffix}`;
      suffix += 1;
    }
    seen.add(base);
    return base;
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type AnchorItem = {
  title: string;
  nodeTitle: string;
  href: string;
  nodeName: string;
  children: AnchorItem[];
}

export interface RenderMarkdownOptions {
  /**
   * 是否渲染源码中的原生 HTML 标签。
   * 默认 true（历史行为）。渲染不可信内容（AI 输出、用户上传）时建议设为 false。
   */
  html?: boolean;
  /**
   * 覆盖链接校验。
   * 缺省用本库默认（`defaultValidateLink`）：markdown-it 原生名单 + 额外放行无脚本特征的
   * `data:image/svg+xml` 内联图（原生不认 svg，`![](data:image/svg+xml,...)` 会退化成源码）。
   * 传入本项则**整体接管**：要保留库默认可用
   * `validateLink={(url) => myRule(url) || defaultValidateLink(url)}`。
   * 不要把“方便”写成 `() => true` —— 那会连带放行 javascript:/vbscript:/file: 等危险协议。
   * 初始化语义：随本次渲染调用生效，不保留上一例的覆盖。
   */
  validateLink?: (url: string) => boolean;
}

// ==================== 核心渲染 ====================

/** markdown-it 插件函数类型 */
export type MarkdownPlugin = (md: any) => void;

/* Token 类型直接取自 markdown-it 15 自带的声明（global.d.ts 中不再把它覆盖为 any，
   这样 md.render(tokens) 这类误用才能被 tsc 拦住） */

/**
 * 从渲染 token 流中自动采集标题，构建锚点树。
 * 不依赖内容中的 [[TOC]] 指令（markdown-it-toc-done-right 仅在指令存在时才回调），
 * id 与 markdown-it-anchor 挂在标题上的 id 一致。
 */
function collectAnchors(tokens: MdToken[]): AnchorItem[] {
  const roots: AnchorItem[] = [];
  // stack 内层级严格小于后续兄弟，用于寻找父节点
  const stack: { level: number; item: AnchorItem }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'heading_open') continue;
    const level = Number((t.tag || '').slice(1)); // h1..h6
    if (!Number.isInteger(level) || level < 1 || level > 6) continue;
    const inline = tokens[i + 1];
    const rawTitle = inline?.type === 'inline' ? (inline.content || '').trim() : '';
    if (!rawTitle) continue;
    // attrGet 的返回值可能是数字（markdown-it 允许 [id=1] 这类属性值），需收窄为字符串
    const anchorId = t.attrGet('id');
    const href = (typeof anchorId === 'string' ? anchorId : '') || slugify(rawTitle);

    const item: AnchorItem = {
      title: rawTitle,
      href,
      nodeName: `H${level}`,
      // nodeTitle 携带原始 HTML，消费方展示 title 请用文本渲染，勿直接 innerHTML
      nodeTitle: `<h${level}>${escapeHtml(rawTitle)}</h${level}>`,
      children: [],
    };

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.item.children.push(item);
    } else {
      roots.push(item);
    }
    stack.push({ level, item });
  }
  return roots;
}

/**
 * 渲染 Markdown 为 HTML，并返回自动采集的标题锚点树。
 * KaTeX 为 CDN 懒加载：加载失败不抛错，公式降级为原文并 console.warn。
 */
async function renderMarkdown(content: string, customPlugins?: MarkdownPlugin[], options?: RenderMarkdownOptions) {
  /* 防御：非字符串入参直接交给 markdown-it 会抛 "Input data should be a String"，
     异常被上层 catch 后表现为整页「暂无数据」且难以定位，这里显式归一化 */
  const src = typeof content === 'string' ? content : (content == null ? '' : String(content));
  let katexAvailable = true;
  try {
    await ensureKatexLoaded();
  } catch (err) {
    katexAvailable = false;
    console.warn('[render-markdown] KaTeX 加载失败，公式将降级为纯文本:', err);
  }
  const uniqueSlug = makeUniqueSlugifier();

  const md = new markdownIt({
    langPrefix: 'language-',
    html: options?.html ?? true,
    highlight: function (str: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch (_) { /* 忽略高亮异常 */ }
      }
      return '';
    },
  })
    .use(tab, { name: tabsName })
    // markdown-it-anchor 9.x：permalink 的布尔写法已废弃，其内部就是
    // linkInsideHeader 的同源实现（class 取 .header-anchor，样式依赖它）。
    // 已逐字节对比：以下写法与旧的
    // { permalink: true, permalinkBefore: false, permalinkSymbol: '#' }
    // 输出完全一致，仅不再向控制台打 deprecated 警告
    .use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.linkInsideHeader({
        class: 'header-anchor',
        symbol: '#',
        placement: 'after',
      }),
      slugify: (s: string) => uniqueSlug(slugify(s)),
    })
    .use(mila, {
      matcher(href: string) {
        return href.match(/^https?:\/\//);
      },
      attrs: {
        target: "_blank",
        rel: "noopener",
      },
    })
    .use(MarkdownItGitHubAlerts, {
      titles: alertTitles,
      icons: alertIcons,
    })
    .use(taskList)
    .use(emptyTaskLists)

  if (katexAvailable) {
    md.use(katexPlugin, {
      strict: false,
      throwOnError: false,
    });
  }

  // 应用外部传入的自定义渲染器
  if (customPlugins) {
    customPlugins.forEach((plugin) => md.use(plugin));
  }

  // 链接校验覆盖必须在 parse 之前生效（它在 inline link/image 规则里判定）。
  // 不传也接管：markdown-it 自带的默认不认内联 svg，这里换成本库默认
  md.validateLink = options?.validateLink ?? defaultValidateLink;

  const tokens = md.parse(src, {});

  // 流式输出时末尾的半截围栏会被 markdown-it 当成完整代码块输出，
  // 这里打标记供上层判断“不该拿残缺内容去渲染（如 Mermaid）”
  markUnclosedFence(tokens, src);

  // KaTeX 不可用时，math token 无渲染规则会原样输出，这里显式降级为转义文本
  if (!katexAvailable) {
    md.renderer.rules.katex_inline = (tk: MdToken[], idx: number) => escapeHtml(tk[idx].content || '');
    md.renderer.rules.katex_block = (tk: MdToken[], idx: number) => `<code>${escapeHtml(tk[idx].content || '')}</code>\n`;
  }

  // 渲染 markdown 并后处理 alert 标题。
  // 注意：必须用 md.renderer.render(tokens, ...) 消费上面已解析的 tokens，
  // 不能写成 md.render(tokens)——后者会把入参当源码再 parse 一次并抛
  // "Input data should be a String"，导致整篇渲染为空
  const info = postProcessAlerts(md.renderer.render(tokens, md.options, {}));
  // DOM 由消费方挂载完成后再初始化 tab 交互
  queueMicrotask(() => renderTab());

  return {
    anchor: collectAnchors(tokens),
    info,
  };
}

/**
 * 初始化高亮语言包（hljs 为 external 依赖，需由使用方注册语言后才会高亮）
 * @param {Object} languages - 语言包对象，如 { javascript: javascriptModule, css: cssModule }
 */
export function initHighlighter(languages: Record<string, any> | null | undefined) {
  if (!languages || typeof languages !== 'object') {
    console.warn('[render-markdown] initHighlighter 需要传入一个语言包对象');
    return;
  }

  Object.entries(languages).forEach(([name, lang]) => {
    // 防止重复注册
    if (!hljs.getLanguage(name)) {
      hljs.registerLanguage(name, lang);
    }
  });
}

export default renderMarkdown;
