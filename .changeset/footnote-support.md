---
"remons-render-markdown": minor
---

新增脚注渲染支持（markdown-it-footnote）：正文 `[^1]` 引用渲染为上标，文末自动生成脚注区与回链。脚注区默认收起，包进原生 `<details>`（`summary` 为展开/收起开关，无 JS）；开关文案新增 `footnoteLabel` 配置（组件 prop 与 `markdownFormat` 选项，默认 `'注释'`）。配套样式见 index.global.less。
