# remons-render-markdown

## 2.1.0

### Minor Changes

- 0b68029: 新增脚注渲染支持（markdown-it-footnote）：正文 `[^1]` 引用渲染为上标，文末自动生成脚注区与回链。脚注区默认收起，包进原生 `<details>`（`summary` 为展开/收起开关，无 JS）；开关文案新增 `footnoteLabel` 配置（组件 prop 与 `markdownFormat` 选项，默认 `'注释'`）。配套样式见 index.global.less。

### Patch Changes

- 修复块级 KaTeX 单行语法：`$$ ... $$` 在同一行闭合时现在会正确解析为 display 公式。此前只识别“单独一行 `$$`”的闭合方式，AI/接口输出常见的单行块级公式会被漏解析或原样显示；多行 `$$` 分隔与首行带内容的形式保持兼容。
- ae62361: Mermaid 全屏：当宿主不支持 Fullscreen API（VSCode 等 Electron webview、http 非安全上下文）时降级为 CSS 伪全屏（fixed 铺满视口），并支持 Esc / 再次点击按钮退出；原生全屏路径行为不变。
