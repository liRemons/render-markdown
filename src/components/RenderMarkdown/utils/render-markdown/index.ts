import markdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItTOC from 'markdown-it-toc-done-right';
import mila from 'markdown-it-link-attributes';
import clonedeep from 'lodash.clonedeep'
import hljs from 'highlight.js/lib/core';
import { tab } from "@mdit/plugin-tab";
import { alert } from "@mdit/plugin-alert";
import renderAlert from './render-alert';
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

export type AnchorItem = {
  title: string;
  nodeTitle: string;
  href: string;
  nodeName: string;
  children: AnchorItem[];
}

interface RawAnchorNode {
  n: string;  // 标题文本
  l: number;  // 标题层级
  c?: RawAnchorNode[];  // 子节点
}

/** 将原始锚点树递归展平为 AnchorItem 列表 */
function formatAnchors(data: RawAnchorNode[]): AnchorItem[] {
  if (!data) return [];
  return data.map((item) => ({
    href: slugify(item.n.trim()),
    title: item.n.trim(),
    children: formatAnchors(item.c || []),
    nodeName: `H${item.l}`,
    nodeTitle: `<h${item.l}>${item.n.trim()}</h${item.l}>`,
  }));
}

// ==================== 核心渲染 ====================

async function renderMarkdown(content: string) {
  
  await ensureKatexLoaded();
  let rawAnchors: RawAnchorNode[] = [];

  const md = new markdownIt({
    langPrefix: 'language-',
    html: true,
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
    .use(markdownItAnchor, {
      permalink: true,
      permalinkBefore: false,
      permalinkSymbol: '#',
      slugify,
    })
    .use(markdownItTOC, {
      callback: (_html: string, ast: { c?: RawAnchorNode[] }) => {
        if (!rawAnchors.length && ast.c) {
          rawAnchors = ast.c;
        }
      },
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
    .use(alert, { titleRenderer: renderAlert })
    .use(katexPlugin, {
      strict: false,
      throwOnError: false,
    });

  const info = md.render(content);
  setTimeout(() => {
    requestAnimationFrame(() => renderTab());
  }, 0);

  return {
    anchor: formatAnchors(clonedeep(rawAnchors)),
    info,
  };
}


/**
 * 初始化高亮语言包
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
