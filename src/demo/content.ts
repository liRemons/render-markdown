/**
 * 示例页演示内容
 * 图片用内联 data URI，避免示例依赖外部图床
 */

/**
 * 主示例用 canvas 生成 PNG：位图到处都能渲染、体积小，也不依赖校验策略。
 * （markdown-it 原生 validateLink 只放行 `data:image/(gif|png|jpeg|webp);`，内联 svg 会整行退化成
 * 纯文本；本库的默认校验 defaultValidateLink 已额外放行无脚本特征的 svg，但传了更严的
 * validateLink 就会回到不认 —— 用 PNG 可以让主示例不受这个开关影响。
 * svg 的对比效果单独放在示例页第 8 区演示，见 VALIDATE_LINK_MD。）
 */
const FALLBACK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const IMG_WIDTH = 640;
const IMG_HEIGHT = 320;

/** 绘制一张渐变色示例图，返回 data:image/png;base64,... */
const makeSampleImage = (
  label: string,
  from: string,
  to: string,
  [width, height]: [number, number] = [IMG_WIDTH, IMG_HEIGHT]
): string => {
  if (typeof document === 'undefined') return FALLBACK_PNG;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return FALLBACK_PNG;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(width / 18.8)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, height / 2);

  return canvas.toDataURL('image/png');
};

const imgA = makeSampleImage('图片一：点击可预览大图', '#4f6df5', '#9b5cf6');
const imgB = makeSampleImage('图片二：画廊切换（箭头 / 滑动 / ←→）', '#12b981', '#0ea5e9');
// 尺寸大于视口，用来验证预览的缩放与平移（小图会被判为“不可放大”而测不到）
const imgBig = makeSampleImage('图片三：大图（滚轮缩放 / 拖拽平移）', '#f59e0b', '#ef4444', [1920, 1200]);

/**
 * 不可信内容示例里的图片：刻意不用 makeSampleImage()。
 * html=false 时 markdown-it 会把原生标签转义成**文本**输出（已实测），
 * 而 canvas 生成的 640x320 PNG base64 有几万字符，会直接把示例区刷屏、没法看；
 * 这里换成不到 400 字符的 svg data URI，转义后也只是长长的一行。
 * 另外：html_block 是原样透传的，不经过 markdown-it 的 validateLink，
 * 所以 `data:image/svg+xml` 在这种写法里能正常加载（markdown 的 ![]() 语法才受白名单限制）。
 * 图片能加载成功就不会触发 onerror，示例只演示“原生标签是否被渲染”。
 */
const NATIVE_IMG_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='320'><rect width='640' height='320' fill='#f59e0b'/><text x='320' y='170' fill='#fff' font-size='40' font-family='sans-serif' text-anchor='middle'>native img</text></svg>"
  );

/** 完整功能示例文档 */
export const SAMPLE_MD = `# render-markdown 能力总览

这是一个基于 React 的 Markdown 渲染组件库，支持 GFM、代码高亮、Mermaid 图表、Tabs、Alert、公式等。

> [!tip]
> 本页所有开关都在演示**修复后的行为**：多实例互不干扰、TOC 无需写 [[TOC]] 指令、增量渲染为真节流。

## 一、文本与列表

普通段落支持 **加粗**、*斜体*、\`行内代码\`、[外部链接](https://github.com/liRemons/render-markdown)（自动 target="_blank"）。

- 无序列表项
- [x] 已完成的任务项
- [ ] 未完成的任务项

1. 有序列表一
2. 有序列表二

## 二、代码高亮与工具栏

\`\`\`javascript
// 复制按钮 / 语言角标 / 折叠按钮均由库自动注入
async function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
\`\`\`

\`\`\`python
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## 三、公式（KaTeX，CDN 懒加载）

行内公式：$E = mc^2$，以及块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

## 四、Mermaid 图表

\`\`\`mermaid
---
title: 增量渲染流程
---
flowchart TD
    A[content 变化] --> B{首次渲染?}
    B -- 是 --> C[innerHTML 直出]
    B -- 否 --> D[节流窗口检查]
    D --> E[markdown 解析为字符串]
    E --> F[morphdom 差异化 patch]
    F --> G[恢复工具栏 / 插件容器状态]
    G --> H[防抖扫描 mermaid]
    C --> H
\`\`\`

\`\`\`mermaid
---
title: 渲染时序
---
sequenceDiagram
    participant U as 使用者
    participant C as RenderMarkdown
    participant M as markdown-it
    participant P as morphdom
    U->>C: content
    C->>M: parse / render
    M-->>C: html + anchors
    C->>P: patch(仅增量模式)
    P-->>U: DOM 更新（保留状态）
\`\`\`

## 五、Tabs 标签页

:::markdown-tabs

@tab:active JavaScript

\`\`\`javascript
const sum = [1, 2, 3].reduce((a, b) => a + b, 0);
console.log(sum); // 6
\`\`\`

@tab TypeScript

\`\`\`typescript
const sum: number = [1, 2, 3].reduce((a: number, b: number) => a + b, 0);
\`\`\`

@tab 说明

横向标签过多时会出现渐隐蒙层，滚轮可转横向滚动。
:::

## 六、表格与 Alert

| 特性 | 说明 |
| ---- | ---- |
| GFM | 表格、任务列表、删除线 |
| 增量渲染 | morphdom 差异化更新 |
| 图表 | Mermaid + KaTeX |

> [!note]
> 提示信息（note）

> [!warning]
> 注意信息（warning）

> [!caution]
> 警告信息（caution）

## 七、图片预览

![图片一](${imgA})

![图片二](${imgB})

![图片三](${imgBig})

预览基于 PhotoSwipe：桌面滚轮即以指针位置为锚点缩放，双击（触屏双击同效）放大到原始像素、再双击回到适配视口，
未放大时拖拽平移有惯性，触屏双指外划或竖向拖出可关闭，单击图片区域切回原始尺寸、点背景关闭，
Esc 关闭、←/→ 切换；代码块（\`pre\`）内的图片默认不进预览列表。上面“图片三”尺寸大于视口，
用它可以完整试到缩放与平移（最大 2 倍原始像素）；遮罩为半透明毛玻璃，切换主题会跟随。

## 八、锚点与目录

点击右上角的目录按钮可打开侧边目录，滚动时当前章节会高亮（无需在正文写 [[TOC]]）。
`;

/** 用于流式（打字机）演示的短文档 */
export const STREAM_MD = `# 流式输出演示

> [!tip]
> 模拟 SSE 打字机：观察代码块工具栏、图表、目录在增量渲染下是否闪烁或丢失。

## 场景说明

增量渲染（morphdom）会复用未变化的节点，因此：

- 代码块上的复制 / 折叠工具栏不会被销毁重建
- 已渲染的 Mermaid 图表不会反复闪白
- 目录高亮状态得以保留

\`\`\`javascript
const tick = (n) => (n <= 1 ? 1 : n * tick(n - 1));
console.log(tick(10)); // 3628800
\`\`\`

## 图表

\`\`\`mermaid
---
title: 流式渲染
---
journey
    title 一次 SSE 推送
    section 接收片段
      解析 Markdown: 5: markdown-it
      生成 tokens: 4: markdown-it
    section 增量更新
      diff 新旧节点: 5: morphdom
      patch DOM: 4: 浏览器
\`\`\`

## 结尾

- [x] 工具栏状态保持
- [x] 图表不重复渲染
- [ ] 目录跟随高亮
`;

/** 不可信内容样例：演示 html={false} 的防护效果 */
export const UNSAFE_MD = `## 不可信内容（html=false 时不生效）

<img src="${NATIVE_IMG_URI}" onerror="alert('XSS')" />

<script>alert('XSS')</script>

<div onclick="alert('XSS')">点击我试试（html=false 时该标签不会被渲染）</div>

安全段落：**加粗**仍然可用。
`;

/**
 * 链接校验示例：SVG data URI
 * markdown-it 原生 validateLink 不认 svg+xml（图片语法会原样显示为源码），
 * 本库默认 defaultValidateLink 已额外放行它；传入更严的 validateLink 又会退回源码形态
 * —— 两种结果都能用示例页第 8 区的开关切出来。
 */
const svgDataUri = (label: string, from: string, to: string): string =>
  'data:image/svg+xml;charset=utf-8,' +
  // 单行紧凑写法：换行和缩进会被 encodeURIComponent 编成 %0A%20%20，白白拉长源码
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='320'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='640' height='320' fill='url(#g)'/><text x='320' y='170' fill='#fff' font-size='34' font-family='sans-serif' text-anchor='middle'>${label}</text></svg>`
  )
    // encodeURIComponent 不会转义 ( ) ' ! *，而这里的结果要写进 markdown 的 ![](…)：
    // 链接地址里的括号会被 markdown-it 配对规则吃掉，所以再手动编一次括号和单引号
    .replace(/[()]/g, (ch) => (ch === '(' ? '%28' : '%29'))
    .replace(/'/g, '%27');

export const VALIDATE_LINK_MD = `## 两种内联 data URI 图片

下面这张是 **svg data URI**，markdown-it 原生不认，本库默认校验已额外放行，所以直接渲染成图；把示例页第 8 区的开关切到「传入更严的自定义校验」，它就会退回源码：

![SVG 内联图](${svgDataUri('SVG data URI：由库默认校验放行', '#6366f1', '#ec4899')})

下面这张是 **png data URI**，两套校验都放行：

![PNG 内联图](${makeSampleImage('PNG data URI：默认即渲染', '#0ea5e9', '#22c55e')})
`;
