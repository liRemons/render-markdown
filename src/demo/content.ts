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

### 极小图表与缩放下限（回归示例）

下面两个是修复「小图表塌缩到按钮高度被浮层工具栏遮挡」与「无法缩到比原图更小」的验证用例
（需先点「启用拖拽」后再缩放）：

1. 极小的状态图：图本身只有一个节点，修复前会被右上角按钮整个盖住；现在图表区有最小高度（64px），圆点应完整可见且位于按钮行下方。
2. 缩小下限：对下面的流程图启用拖拽后，滚轮或「−」按钮应能缩到明显小于原图（minScale 0.1）；修复前 contain: 'outside' 会把 minScale 抬到 1，缩到铺满容器就卡住了；拖出视野后用「重置」回中。

\`\`\`mermaid
---
title: 极小状态图
---
stateDiagram-v2
    [*] --> 就绪
\`\`\`

\`\`\`mermaid
---
title: 缩小验证
---
flowchart LR
    A[缩到 0.1x] --> B[再放回 1x] --> C[重置回中]
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

/**
 * 带圈序号 mock：0-50 每行一个序号 + 文案，序号独占一行（只用来目测大小是否被钉齐）
 * 只按码位取 ①② 这类带圈序号：0 → ⓪、1-20 → U+2460-2473、21-50 → CJK 块 ㉑-㊿
 * （32-35 Unicode 本身未收录圈号，退回普通数字）。行尾不带空格：正文 <p> 是 pre-line，换行即断行。
 */
const circledChar = (n: number): string => {
  if (n === 0) return String.fromCodePoint(0x24ea); // ⓪
  if (n <= 20) return String.fromCodePoint(0x2460 + (n - 1)); // ①-⑳
  if (n <= 31) return String.fromCodePoint(0x3251 + (n - 21)); // ㉑-㉟
  if (n <= 35) return String(n); // 32-35 无圈号字形
  return String.fromCodePoint(0x32b1 + (n - 36)); // ㊱-㊿ = 36-50
};

const CIRCLED_LINES: string[] = Array.from({ length: 51 }, (_, n) => `${circledChar(n)} 第 ${n} 条序号文案。`);

export const CIRCLED_MD = `## 0-50 序号逐行比对

${CIRCLED_LINES.join('\n')}
`;

/**
 * 增量渲染残留自检用例（见 demo/App.tsx 第 10 节）
 * 每个用例给 before / after 两份源码：一次 content 更新从 before 直接切到 after，
 * 保证【恰好一次 morphdom patch】，不靠手速撞时序。
 * 形状都刻意凑成「同一父级下 normalized class 完全相同的兄弟节点」：
 * className 语义 key 会撞 key（morphdom 的 fromNodesLookup 每个 key 只存一个节点，
 * 删除又按 key 回查），回查不到 key 的那个节点就永久留在 DOM。
 * 注意：class 不同（①与⑩、NOTE与TIP、行内 katex 与块级 katex-display）就不撞 key，
 * 也不会残留 —— 这是肉手测不出来的主要原因。
 */
export interface ResidueCase {
  id: string;
  title: string;
  /** 撞 key 的节点，供自检表统计左右两栏数量 */
  suspect: string;
  steps: string;
  /** 起点源码 */
  before: string;
  /** 注入后的源码（一般就是删掉一个同名兄弟节点） */
  after: string;
}

const TABS_THREE = [
  ':::markdown-tabs',
  '',
  '@tab:active 标签甲',
  '',
  '甲内容',
  '',
  '@tab 标签乙',
  '',
  '乙内容',
  '',
  '@tab 标签丙',
  '',
  '丙内容',
  ':::',
  '',
].join('\n');

const TABS_TWO = [
  ':::markdown-tabs',
  '',
  '@tab:active 标签甲',
  '',
  '甲内容',
  '',
  '@tab 标签丙',
  '',
  '丙内容',
  ':::',
  '',
].join('\n');

export const RESIDUE_CASES: ResidueCase[] = [
  {
    id: 'num',
    title: '序号 span（同段三个）',
    suspect: '.mdNum / .mdNumWide / .mdNumCjk',
    steps: '注入删除「② 第二条」。三个序号 class 都是 mdNum（一位数字），同父级同 key；期望右栏剩两个、左栏也剩两个。',
    before: ['① 第一条序号文案', '② 第二条序号文案', '③ 第三条序号文案'].join(' '),
    after: ['① 第一条序号文案', '③ 第三条序号文案'].join(' '),
  },
  {
    id: 'katex',
    title: '行内公式（同段两个 .katex）',
    suspect: '.katex（含内部 katex-mathml / katex-html / base 同名嵌套）',
    steps: '注入删掉第二个公式。两个行内公式在同一段落里是同名兄弟，公式内部还有一堆同名嵌套，会跨公式互摆。',
    before: '公式一 $a+b=c$ 与公式二 $x-y=z$ 写在同一段里。',
    after: '公式一 $a+b=c$ 写在同一段里。',
  },
  {
    id: 'alert',
    title: '两个同类 Alert 块',
    suspect: 'div.markdown-alert.markdown-alert-note',
    steps: '注入删掉第二个 NOTE（两个都是 note，class 完全一致；如果删的是 TIP 跟 NOTE 则不撞 key）。',
    before: [
      '> [!NOTE]',
      '> 第一块：aaa',
      '',
      '> [!NOTE]',
      '> 第二块：bbb',
      '',
      '尾部段落，保证删块时文档结构不变。',
      '',
    ].join('\n'),
    after: [
      '> [!NOTE]',
      '> 第一块：aaa',
      '',
      '尾部段落，保证删块时文档结构不变。',
      '',
    ].join('\n'),
  },
  {
    id: 'tabs',
    title: 'Tabs（同 header 三个同名按钮）',
    suspect: '.markdown-tabs-tab-button / .markdown-tabs-tab-content',
    steps: '注入删掉中间那个 tab（active 不参与签名，所以三个按钮 normalized class 相同）。',
    before: TABS_THREE,
    after: TABS_TWO,
  },
  {
    id: 'task',
    title: '任务列表（两个同名 ul）',
    suspect: 'ul.contains-task-list / li.task-list-item',
    steps: '注入删掉第二个列表。两组 ul、四个 li 各自同名。',
    before: ['- [ ] 甲一', '- [ ] 甲二', '', '- [ ] 乙一', '- [ ] 乙二', ''].join('\n'),
    after: ['- [ ] 甲一', '- [ ] 甲二', ''].join('\n'),
  },
  {
    id: 'blank',
    title: '渲染空输出（空串早退）',
    suspect: '整块内容',
    steps: 'after 是一个空格：源码非空但渲染结果是空串。修复前增量链路在 if (!newHtml) return 处跳过本轮 patch，左栏会挂着整片旧内容；现在空输出会清空容器并回退到与右栏同一个 Empty 占位（两栏都是「暂无数据」）。',
    before: ['这一段全部删光只留一个空格试试。', '', '第二段用于确认左右两栏一开始是一致的。'].join('\n'),
    after: ' ',
  },
];
