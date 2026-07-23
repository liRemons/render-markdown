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

declare module 'uslug';
declare module 'markdown-it';
declare module 'markdown-it-anchor';
declare module 'markdown-it-toc-done-right';
declare module 'markdown-it-link-attributes';
declare module '@mdit/plugin-tab';
declare module '@mdit/plugin-alert';
declare module 'lodash.clonedeep';
declare module 'dayjs';
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