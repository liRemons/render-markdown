// global.d.ts
declare module '*.css' {
  const content: any;
  export default content;
}

declare module '*.less' {
  const content: any;
  export default content;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

/* markdown-it 15 自带 TypeScript 类型，不再用 declare module 覆盖为 any
   （之前覆盖后，md.render(tokens) 这类误用无法被 tsc 拦住） */
declare module 'markdown-it-anchor';
declare module 'markdown-it-link-attributes';
declare module '@mdit/plugin-tab';
declare module 'methods-r';
declare module 'highlight.js/lib/core';
declare module 'highlight.js/lib/languages/javascript';
declare module 'highlight.js/lib/languages/bash';
declare module 'highlight.js/lib/languages/json';
declare module 'highlight.js/lib/languages/nginx';
declare module 'highlight.js/lib/languages/xml';
declare module 'highlight.js/lib/languages/css';
declare module 'highlight.js/lib/languages/plaintext';
declare module 'highlight.js/lib/languages/less';
declare module 'highlight.js/lib/languages/typescript';
declare module 'highlight.js/lib/languages/python';
declare module 'highlight.js/lib/languages/go';
declare module 'markdown-it-task-lists';
declare module 'markdown-it-github-alerts';
