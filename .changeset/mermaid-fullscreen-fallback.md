---
"remons-render-markdown": patch
---

Mermaid 全屏：当宿主不支持 Fullscreen API（VSCode 等 Electron webview、http 非安全上下文）时降级为 CSS 伪全屏（fixed 铺满视口），并支持 Esc / 再次点击按钮退出；原生全屏路径行为不变。
