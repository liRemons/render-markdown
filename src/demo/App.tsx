import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RenderMarkdown, {
  MermaidChart,
  ThemeProvider,
  initHighlighter,
  languagesCommon,
  markdownFormat,
  useTheme,
  type ThemeMode,
  type AnchorItem,
} from '../index';
import { SAMPLE_MD, STREAM_MD, UNSAFE_MD, VALIDATE_LINK_MD } from './content';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import './demo.less';

// 语言注册：highlight.js 为 external + peer 依赖，必须由使用方显式注册
initHighlighter({ ...languagesCommon, python, go });

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

/** 统计锚点总数（含子级） */
const countAnchors = (items: AnchorItem[]): number =>
  items.reduce((acc, item) => acc + 1 + countAnchors(item.children || []), 0);

/**
 * 更严的自定义校验：回到 markdown-it 原生名单（不认内联 svg）。
 * 库默认 defaultValidateLink 已经放行 svg，本函数只用来演示“传入即整体接管”；
 * 自定义时想保留库默认可写成 `(url) => myRule(url) || defaultValidateLink(url)`。
 * 注意不要把“方便”写成 () => true —— 那会连带放行 javascript:/file: 等危险协议。
 */
const validateLinkNoSvg = (url: string): boolean => {
  const s = url.trim().toLowerCase();
  if (/^(javascript|vbscript|file):/.test(s)) return false;
  // data: 仍只放行四种位图（svg 不开）
  if (/^data:/.test(s)) return /^data:image\/(gif|png|jpeg|webp);/.test(s);
  return true;
};

function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  return (
    <div className="demo-themeSwitcher">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className={mode === m.value ? 'demo-chip demo-chip-active' : 'demo-chip'}
          onClick={() => setMode(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** 流式（打字机）演示：同一份内容分别走增量 / 全量渲染，便于对比闪烁与状态丢失 */
function StreamingDemo() {
  const [incremental, setIncremental] = useState(true);
  const [streamText, setStreamText] = useState('');
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    stop();
    setStreamText('');
    setRunning(true);
    let i = 0;
    timerRef.current = setInterval(() => {
      // 每次推送 3~7 个字符，模拟 SSE 分片（间隔小于默认节流窗口 16ms 的量级）
      i += 3 + Math.floor(Math.random() * 5);
      setStreamText(STREAM_MD.slice(0, i));
      if (i >= STREAM_MD.length) stop();
    }, 30);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return (
    <section className="demo-section">
      <h2 className="demo-sectionTitle">3. 流式渲染对比（增量 / 全量）</h2>
      <p className="demo-desc">
        点击「开始推送」观察代码块工具栏与 Mermaid 图表的表现。<code>incremental</code>{' '}
        等配置项为<strong>初始化语义</strong>：切换开关会重新挂载组件（key 变化），这是预期行为。
      </p>
      <p className="demo-desc">
        看点：mermaid 围栏闭合前只显示逐字源码（不拿残缺源码去渲染）；闭合后出图，此时后面正文仍在追加，
        图表也不会重挂/闪白——可以先展开或缩放图表再让流继续跑，状态应保持在展开后的样子。
      </p>
      <div className="demo-controls">
        <button type="button" className="demo-btn" onClick={start} disabled={running}>
          {running ? '推送中…' : '开始推送'}
        </button>
        <button type="button" className="demo-btn" onClick={stop} disabled={!running}>
          停止
        </button>
        <label className="demo-switch">
          <input
            type="checkbox"
            checked={incremental}
            onChange={(e) => {
              setIncremental(e.target.checked);
              stop();
              setStreamText('');
            }}
          />
          增量渲染（morphdom）
        </label>
        <span className="demo-progress">{Math.round((streamText.length / STREAM_MD.length) * 100)}%</span>
      </div>
      <div className="demo-card" key={incremental ? 'inc' : 'full'}>
        <RenderMarkdown
          content={streamText}
          incremental={incremental}
          incrementalThrottleMs={16}
          showToc
          toolbarDebounceMs={120}
        />
      </div>
    </section>
  );
}

/** markdownFormat 独立 API：拿到 HTML 与锚点树自行渲染 */
function MarkdownFormatDemo() {
  const [stat, setStat] = useState('');
  const run = async () => {
    const { anchor, info } = await markdownFormat(SAMPLE_MD);
    setStat(`锚点 ${countAnchors(anchor)} 个 / HTML ${info.length} 字符（无需 [[TOC]] 指令即可采集）`);
  };
  return (
    <section className="demo-section">
      <h2 className="demo-sectionTitle">4. markdownFormat 独立解析 API</h2>
      <p className="demo-desc">
        异步函数（内部等待 KaTeX CDN 就绪；加载失败时公式降级为文本，不抛错）。
      </p>
      <div className="demo-controls">
        <button type="button" className="demo-btn" onClick={run}>
          解析示例文档
        </button>
        {stat && <span className="demo-stat">{stat}</span>}
      </div>
    </section>
  );
}

function Demo() {
  const [multiInstance, setMultiInstance] = useState(true);
  const [unsafeMode, setUnsafeMode] = useState(false);
  // 默认走库默认校验（已放行内联 svg）；关掉则演示“传入自定义 validateLink 即整体接管”
  const [allowSvgLink, setAllowSvgLink] = useState(true);

  const sampleContent = useMemo(() => SAMPLE_MD, []);

  return (
    <div className="demo-page">
      <header className="demo-header">
        <div>
          <h1 className="demo-title">remons-render-markdown 示例</h1>
          <p className="demo-subtitle">GFM · 代码高亮 · Mermaid · Tabs · Alert · KaTeX · 增量渲染</p>
        </div>
        <ThemeSwitcher />
      </header>

      <section className="demo-section">
        <h2 className="demo-sectionTitle">1. 完整能力示例</h2>
        <p className="demo-desc">
          含目录（TOC）、返回顶部、footer、代码折叠、图片预览。目录按钮在该卡片右上角。
          验证全屏隔离：先点本文两个图表的「展开」（下拉箭头），再对其中一个点「全屏」并退出，
          另一个图表的展开状态不应被连带重置；图片预览全屏同理。
        </p>
        <div className="demo-card demo-card--tall">
          <RenderMarkdown
            content={sampleContent}
            showToc
            showBackTop
            footer={<span>—— 以上为示例内容 ——</span>}
            defaultCollapsed={false}
          />
        </div>
      </section>

      <section className="demo-section">
        <h2 className="demo-sectionTitle">2. 多实例隔离</h2>
        <p className="demo-desc">
          修复前：工具栏用 <code>document.querySelectorAll</code> 全局扫描，A 实例会按自己的 props
          初始化 B 实例的代码块，复制也会拷错。修复后：每个实例只在自己的容器内工作。
        </p>
        <label className="demo-switch">
          <input type="checkbox" checked={multiInstance} onChange={(e) => setMultiInstance(e.target.checked)} />
          并排展示两个实例
        </label>
        <div className={`demo-grid ${multiInstance ? 'demo-grid--2' : ''}`}>
          <div className="demo-card">
            <h3 className="demo-cardTitle">实例 A（折叠按钮开启）</h3>
            <RenderMarkdown content={sampleContent} showCollapseButton defaultCollapsed={false} enableMermaid={false} />
          </div>
          {multiInstance && (
            <div className="demo-card">
              <h3 className="demo-cardTitle">实例 B（折叠按钮关闭）</h3>
              <RenderMarkdown content={sampleContent} showCollapseButton={false} enableMermaid={false} />
            </div>
          )}
        </div>
      </section>

      <StreamingDemo />

      <MarkdownFormatDemo />

      <section className="demo-section">
        <h2 className="demo-sectionTitle">5. MermaidChart 组件用法（推荐）</h2>
        <p className="demo-desc">
          旧 API <code>renderMermaid{`({...})`}</code> 每次调用返回新元素类型，父组件重渲染会导致子树卸载重建；
          新增稳定组件 <code>&lt;MermaidChart /&gt;</code>，旧函数保留并标废。
        </p>
        <div className="demo-card">
          <MermaidChart
            source={`---
title: 独立组件
---
graph LR
  A[markdown-it] --> B[HTML]
  B --> C[morphdom patch]
  C --> D[保留交互状态]`}
            showSourceView
            showCollapse
            defaultCollapsed={false}
            minHeight={240}
          />
        </div>
      </section>

      <section className="demo-section">
        <h2 className="demo-sectionTitle">6. 纯代码模式（codeType）</h2>
        <div className="demo-card">
          <RenderMarkdown
            content={`package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, render-markdown")\n}`}
            codeType="go"
            enableMermaid={false}
          />
        </div>
      </section>

      <section className="demo-section">
        <h2 className="demo-sectionTitle">7. HTML 安全开关</h2>
        <p className="demo-desc">
          默认 <code>html=true</code>（历史行为，存在 XSS 风险）。渲染不可信来源时关闭：
          <code>html</code> 与其他渲染选项一样是<strong>初始化语义</strong>（增量/非增量均只在挂载时读取），
          因此这里用 <code>key</code> 重挂载来切换。
        </p>
        <label className="demo-switch">
          <input type="checkbox" checked={unsafeMode} onChange={(e) => setUnsafeMode(e.target.checked)} />
          允许渲染原生 HTML（html=true）
        </label>
        <div className="demo-card" key={unsafeMode ? 'html-on' : 'html-off'}>
          <RenderMarkdown content={UNSAFE_MD} html={unsafeMode} enableMermaid={false} />
        </div>
      </section>

      <section className="demo-section">
        <h2 className="demo-sectionTitle">8. 自定义链接校验（validateLink）</h2>
        <p className="demo-desc">
          markdown-it 原生只放行 <code>data:image/(gif|png|jpeg|webp)</code>，所以
          <code>data:image/svg+xml</code> 的内联图会退化为源码文本。本库默认已额外放行 svg
          （仍拒 <code>javascript:/vbscript:/file:</code>，并且会拒掉载荷里带脚本特征的 svg，因为
          <code>&lt;a href&gt;</code> 里的 svg 被导航时会当作文档执行脚本）。开关另一侧演示“传入即整体接管”：
          不传则用库默认，传则用下面的更严名单（回到不认 svg）。该 prop 是<strong>初始化语义</strong>，
          因此同样用 <code>key</code> 重挂载；放宽校验请只用于可信内容。
        </p>
        <label className="demo-switch">
          <input
            type="checkbox"
            checked={allowSvgLink}
            onChange={(e) => setAllowSvgLink(e.target.checked)}
          />
          {allowSvgLink ? '用库默认校验（放行内联 svg）' : '传入更严的自定义校验（不认 svg）'}
        </label>
        <div className="demo-card" key={allowSvgLink ? 'link-svg-on' : 'link-svg-off'}>
          <RenderMarkdown
            content={VALIDATE_LINK_MD}
            validateLink={allowSvgLink ? undefined : validateLinkNoSvg}
            enableMermaid={false}
          />
        </div>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Demo />
    </ThemeProvider>
  );
}
