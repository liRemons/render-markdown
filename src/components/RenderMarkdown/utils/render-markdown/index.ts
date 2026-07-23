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
// languages
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import nginx from 'highlight.js/lib/languages/nginx';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import plaintext from 'highlight.js/lib/languages/plaintext';
import less from 'highlight.js/lib/languages/less';
import typescript from 'highlight.js/lib/languages/typescript';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('less', less);
hljs.registerLanguage('typescript', typescript);

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

type AnchorItem = {
  title: string;
  nodeTitle: string;
  href: string;
  nodeName: string;
}

function renderMarkdown(content: string) {
  let anchor: Array<AnchorItem & { children: Array<AnchorItem> }> = [];
  const uslugify = (s: any) => slugify(s);
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
