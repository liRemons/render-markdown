import markdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItTOC from 'markdown-it-toc-done-right';
import mila from 'markdown-it-link-attributes';
import clonedeep from 'lodash.clonedeep'
import hljs from 'highlight.js/lib/core';
import { tab } from "@mdit/plugin-tab";

// 轻量级 slugify 函数，替代 uslug
function slugify(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}
import { alert } from "@mdit/plugin-alert";
import renderAlert from './render-alert';
import renderTab, { tabsName } from './render-tab';

// 默认支持的语言列表 - 使用动态导入
const defaultLanguages: Record<string, () => Promise<any>> = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  bash: () => import('highlight.js/lib/languages/bash'),
  json: () => import('highlight.js/lib/languages/json'),
  nginx: () => import('highlight.js/lib/languages/nginx'),
  xml: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  plaintext: () => import('highlight.js/lib/languages/plaintext'),
  less: () => import('highlight.js/lib/languages/less'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
};

// 已加载语言缓存
const loadedLanguages = new Set<string>();

// 注册默认语言（异步预加载）
Object.entries(defaultLanguages).forEach(([lang, loader]) => {
  const registerLang = async () => {
    const module = await loader();
    hljs.registerLanguage(lang, module.default || module);
    loadedLanguages.add(lang);
  };
  registerLang();
});

/**
 * 动态加载并注册高亮语言
 * @param lang 语言名称
 */
export async function registerLanguage(lang: string): Promise<void> {
  if (!lang || loadedLanguages.has(lang) || hljs.getLanguage(lang)) return;

  const loader = defaultLanguages[lang];
  if (loader) {
    try {
      const module = await loader();
      hljs.registerLanguage(lang, module.default || module);
      loadedLanguages.add(lang);
    } catch (e) {
      console.warn(`加载高亮语言失败: ${lang}`, e);
    }
  }
}

/**
 * 从逗号分隔的字符串注册多个语言
 * @param codeType 逗号分隔的语言名称，例如 "python,java,go"
 */
export async function registerLanguages(codeType?: string): Promise<void> {
  if (!codeType) return;

  const langs = codeType.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
  await Promise.all(langs.map(lang => registerLanguage(lang)));
}

/**
 * 从 Markdown 内容中提取唯一的语言名称（从 ```lang 代码块）
 */
export function extractLanguagesFromMarkdown(content: string): string[] {
  const regex = /```(\w+)/g;
  const langs: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    langs.push(match[1].toLowerCase());
  }
  return [...new Set(langs)];
}


type AnchorItem = {
  title: string;
  nodeTitle: string;
  href: string;
  nodeName: string;
}

function renderMarkdown(content: string) {
  let anchor: Array<AnchorItem & { children: Array<AnchorItem> }> = [];
  const uslugify = (s: string) => slugify(s);
  const MD = new markdownIt({
    langPrefix: 'language-',
    html: true,
    highlight: function (str: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlightedCode = hljs.highlight(str, { language: lang }).value;
          return highlightedCode;
        } catch (__) { }
      }
      return '';
    },
  })
    .use(tab, {
      name: tabsName,
    })
    .use(markdownItAnchor, {
      permalink: true,
      permalinkBefore: false,
      permalinkSymbol: '#',
      slugify: uslugify,
    })
    .use(markdownItTOC, {
      callback: (_html: string, ast: any) => {
        if (anchor.length) {
          return;
        }
        anchor = ast.c;
      },
    })
    .use(mila, {
      matcher(href: string) {
        return href.match(/^https?:\/\//);
      },
      attrs: {
        target: "_blank",
        rel: "noopener", // 增加此属性可提升安全性
      },
    })
    .use(alert, {
      titleRender: renderAlert
    });
  ;

  const info = MD.render(content);
  setTimeout(() => {
    renderTab();
  }, 10)

  const format = (data: Array<any>) => {
    if (!data) {
      return []
    }

    return data.map((item): AnchorItem => {
      const obj = {
        href: uslugify(item.n.trim()),
        title: item.n.trim(),
        children: format(item.c),
        nodeName: `H${item.l}`,
        nodeTitle: `<h${item.l}>${item.n.trim()}</h${item.l}>`
      };
      delete item.c;
      return obj;
    });
  };

  return {
    anchor: format(clonedeep(anchor)),
    info,
  }
}

export default renderMarkdown;
