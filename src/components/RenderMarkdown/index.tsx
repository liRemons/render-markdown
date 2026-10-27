import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { CopyFilled, CaretRightOutlined, CaretDownOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { createRoot, Root } from 'react-dom/client';
import customMessage from '@/components/CustomMessage';
import CustomBackTop from '@/components/CustomBackTop';
import Empty from '@/components/Empty';
import TocSidebar, { AnchorItem } from '../TocSidebar';
import { copy } from 'methods-r';
import classnames from 'classnames';
import renderMarkdown, { MarkdownPlugin } from './utils/render-markdown';
import { FENCE_OPEN_CLASS } from './utils/render-markdown/fence-state';
import { initImageToolbars, cleanupImageToolbars } from '../ImagePreview';
import {
  cleanupMermaidRoots,
  isMermaidChartRoot,
  pruneDetachedMermaidRoots,
} from '../MermaidRenderer/mermaidRootRegistry';
// 注意：MermaidRenderer 内部会反向使用本组件（源码预览弹窗），此处必须用 dynamic import 打断循环依赖；
// 单入口产物下不会真正分包（构建会有 INEFFECTIVE_DYNAMIC_IMPORT 提示），属预期行为
import { useIncrementalRender, MD_PERSIST_ATTR } from '@/hooks/useIncrementalRender';
import { MERMAID_ROOT_CLASS } from '@/utils/dom-contract';
import './markdown.global.less';
import './index.global.less';
import styles from './index.module.less';

/** 记录 initCodeToolbars 中为每个 <pre> 创建的 React Root，防止内存泄漏 */
const codeRootMap = new Map<HTMLElement, Root>();

type CodeBlockSnapshot = {
  exact: Map<string, HTMLElement[]>;
  byLanguage: Map<string, HTMLElement[]>;
  /**
   * 快照时锚定在某个 <pre> 之后的 mermaid 图表挂载点。
   * 非增量模式下 innerHTML 会整块重建，图表作为 <pre> 的兄弟节点不在快照链上，
   * 若不随 pre 一起搬回就会被重建掉，表现为每次内容变化都重挂、整图重新渲染。
   */
  charts: Map<HTMLElement, HTMLElement>;
};

/** 取 <pre> 右侧由扫描挂载的图表节点（没有则 null） */
const chartOfPre = (pre: HTMLElement): HTMLElement | null => {
  const next = pre.nextElementSibling;
  return isMermaidChartRoot(next) ? next : null;
};

/** 取 <pre> 内代码语言（无 language- 前缀时为空串）；与下方 getCodeLanguage(code) 保持同一解析口径 */
const getPreLanguage = (pre: HTMLElement): string => {
  const code = pre.querySelector('code');
  return code ? getCodeLanguage(code as HTMLElement) : '';
};

/** 代码块身份 key：语言 + 代码原文，用于在重渲染之间匹配代码块 */
const getCodeBlockKey = (pre: HTMLElement): string | null => {
  const code = pre.querySelector('code');
  if (!code) return null;
  return getPreLanguage(pre) + '\u0000' + (code.textContent ?? '');
};

/** 重渲染前快照当前 DOM 中的代码块，供非增量模式复用 */
const snapshotCodeBlocks = (root: HTMLElement | null): CodeBlockSnapshot => {
  const exact = new Map<string, HTMLElement[]>();
  const byLanguage = new Map<string, HTMLElement[]>();
  const charts = new Map<HTMLElement, HTMLElement>();
  root?.querySelectorAll('pre').forEach((node) => {
    const pre = node as HTMLElement;
    const code = pre.querySelector('code');
    if (!code) return;
    const chart = chartOfPre(pre);
    if (chart) charts.set(pre, chart);
    const key = getCodeBlockKey(pre);
    if (key) {
      const list = exact.get(key);
      if (list) list.push(pre);
      else exact.set(key, [pre]);
    }
    const language = getPreLanguage(pre);
    const langList = byLanguage.get(language);
    if (langList) langList.push(pre);
    else byLanguage.set(language, [pre]);
  });
  return { exact, byLanguage, charts };
};

/**
 * 非增量模式每次内容变化都会整体替换 innerHTML，代码块连同复制/折叠工具栏
 * 会被销毁重建，表现为代码区域闪烁。这里把未变化的 <pre> 节点换回；
 * 内容变化但语言相同的代码块复用节点并原地更新 <code>，保住工具栏与语言图标。
 *
 * 第 2 级复用基于「同语言内的文档顺序」这一启发式配对，因此加了一道护栏：
 * 仅当该语言的代码块数量前后一致时才复用。数量变化意味着中间有插块/删块，
 * 顺序配对会整体错位一格，新块会继承另一个块的工具栏折叠态与 React Root；
 * 此时宁可不复用（该块重建、短暂闪烁）也不错配状态。
 */
const restoreCodeBlocks = (inner: HTMLDivElement | null, snapshot: CodeBlockSnapshot | null) => {
  if (!inner || !snapshot) return;
  const pres = Array.from(inner.querySelectorAll('pre')) as HTMLElement[];
  const reused = new Set<HTMLElement>();

  /** 旧节点被复用时，把它右侧的图表一起搬到新位置，避免卸载重建 */
  const reattachChart = (oldPre: HTMLElement) => {
    const chart = snapshot.charts.get(oldPre);
    if (!chart) return;
    snapshot.charts.delete(oldPre);
    oldPre.after(chart);
  };

  /* 在任何 shift() 修改队列前先把两侧数量算出来，用于护栏判定 */
  const countByLang = (list: HTMLElement[]) => {
    const map = new Map<string, number>();
    list.forEach((pre) => {
      const lang = getPreLanguage(pre);
      map.set(lang, (map.get(lang) ?? 0) + 1);
    });
    return map;
  };
  const newCountByLang = countByLang(pres);
  const oldCountByLang = new Map<string, number>();
  snapshot.byLanguage.forEach((list, lang) => oldCountByLang.set(lang, list.length));

  // 1) 语言 + 内容都相同：直接复用旧节点
  pres.forEach((newPre) => {
    const key = getCodeBlockKey(newPre);
    if (!key) return;
    const oldPre = snapshot.exact.get(key)?.shift();
    if (!oldPre || oldPre === newPre) return;
    reused.add(oldPre);
    newPre.replaceWith(oldPre);
    reattachChart(oldPre);
  });

  // 2) 内容变化的代码块：同语言块数量一致时按顺序复用旧节点，只替换 <code> 内部
  pres.forEach((newPre) => {
    if (!newPre.isConnected) return;
    const newCode = newPre.querySelector('code');
    if (!newCode) return;
    const language = getPreLanguage(newPre);
    const queue = snapshot.byLanguage.get(language);
    if (!queue?.length) return;
    // 护栏：数量变了 => 顺序配对不可信，放弃本级复用
    if (newCountByLang.get(language) !== oldCountByLang.get(language)) return;
    let oldPre: HTMLElement | undefined;
    while (queue.length) {
      const candidate = queue.shift()!;
      if (candidate !== newPre && !reused.has(candidate)) {
        oldPre = candidate;
        break;
      }
    }
    if (!oldPre) return;
    reused.add(oldPre);
    const oldCode = oldPre.querySelector('code');
    if (oldCode) oldCode.innerHTML = newCode.innerHTML;
    newPre.replaceWith(oldPre);
    reattachChart(oldPre);
  });

  // 未被复用的旧图表已随 innerHTML 重建脱离文档，交给下一次扫描的
  // pruneDetachedMermaidRoots 回收（此处源码块若已消失，留着只会显示陈旧图表）
};

/** 生成工具栏 copy-id：crypto.randomUUID 仅在安全上下文可用，http 部署时回退 */
let copyIdSeq = 0;
const genCopyId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `copy-${uuid}` : `copy-${Date.now().toString(36)}-${(copyIdSeq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

/** 解析 props（包含新名优先、旧名 deprecated 别名兼容）；接受部分 props 以便工具栏复用 */
const resolveProps = (props: Partial<RenderMarkdownProps>) => ({
  /** enableMermaid ← isSlotMermaid（旧名） */
  enableMermaid: props.enableMermaid ?? props.isSlotMermaid ?? true,
  /** showCollapseButton ← isShowCollapsed（旧名） */
  showCollapseButton: props.showCollapseButton ?? props.isShowCollapsed ?? true,
  /** toolbarDebounceMs ← mermaidDebounce（旧名） */
  toolbarDebounceMs: props.toolbarDebounceMs ?? props.mermaidDebounce ?? DEFAULT_TOOLBAR_DEBOUNCE,
  /** incremental ← useIncremental（旧名） */
  incremental: props.incremental ?? props.useIncremental ?? false,
  /** transformSource ← chartConfig（旧名） */
  transformSource: props.transformSource ?? props.chartConfig,
  html: props.html ?? true,
});

/** 代码块语言角标图标（远程资源） */
const CODE_ICON_URL = 'https://remons.cn:3008/upload/md_assets/code_icon.png';

/** content 变化后，工具栏/图片/mermaid 扫描的防抖延迟（ms）默认值 */
const DEFAULT_TOOLBAR_DEBOUNCE = 100;


/** 折叠态下 <pre> 的可见高度，与 index.global.less 里 `pre.code-collapsed` 的 max-height 对齐 */
const CODE_COLLAPSED_HEIGHT = 32;

/**
 * 代码折叠/展开切换组件。
 *
 * 动画靠 Web Animations API 补间 `height`，而不是 CSS `transition: max-height`：
 * 展开态是 `max-height: none`（auto），而 `none` 不可插值，transition 到 32px 只会硬切。
 * 折叠动画期间延迟挂 `code-collapsed`（否则 max-height 立刻封顶、看不到收缩），
 * 展开动画则先摘掉该 class 才能测到真实内容高度。
 */
function CodeToggle({ preNode }: { preNode: HTMLElement }) {
  const [isCollapsed, setIsCollapsed] = useState(() => preNode.classList.contains('code-collapsed'));
  const animRef = useRef<Animation | null>(null);

  // 卸载时若有在跑的动画，取消以免 then() 回调操作已卸载节点
  useEffect(() => () => animRef.current?.cancel(), []);

  const handleClick = () => {
    // 以 class 是否存在的“下一态”为准：当前折叠 -> 展开，当前展开 -> 折叠
    const collapse = !preNode.classList.contains('code-collapsed');
    const from = preNode.getBoundingClientRect().height;
    // scrollHeight 始终返回未裁剪的内容高度（即便当前被 max-height 压着）
    const to = collapse ? CODE_COLLAPSED_HEIGHT : preNode.scrollHeight;
    animRef.current?.cancel();
    if (to === from) {
      preNode.classList.toggle('code-collapsed', collapse);
      setIsCollapsed(collapse);
      return;
    }
    if (!collapse) preNode.classList.remove('code-collapsed');
    const anim = preNode.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      { duration: 280, easing: 'ease-in-out' },
    );
    animRef.current = anim;
    if (collapse) {
      // 收缩结束后再封顶：与动画末帧同为 32px，无跳变
      anim.finished.then(() => {
        if (animRef.current !== anim) return;
        preNode.classList.add('code-collapsed');
        anim.cancel();
      });
    }
    setIsCollapsed(collapse);
  };

  return (
    <span className="code-toggle" onClick={handleClick}>
      {isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
    </span>
  );
}


export interface RenderMarkdownProps {
  /**
   * Markdown 内容
   */
  content: string;
  /**
  * 是否显示返回顶部
  */
  showBackTop?: boolean;
  /**
  * 是否将 mermaid 代码块渲染为图表
  */
  enableMermaid?: boolean;
  /**
  * @deprecated 旧名，等价于 enableMermaid
  */
  isSlotMermaid?: boolean;
  /**
  * 是否显示代码折叠按钮
  */
  showCollapseButton?: boolean;
  /**
  * @deprecated 旧名，等价于 showCollapseButton
  */
  isShowCollapsed?: boolean;
  /**
  * 代码类型
  */
  codeType?: string;
  /**
  * 自定义底部内容
  */
  footer?: React.ReactNode;
  /**
   * 返回顶部所依赖的容器，默认 document.body（仅在首次渲染时读取）
   */
  backTopTarget?: HTMLElement | null;
  /**
  * 是否显示新手引导
  */
  showDriverGuide?: boolean;
  /**
   * 是否为打印模式
   */
  isPrintPreview?: boolean;
  /**
   * 渲染前对 mermaid 源码进行改写（初始化语义：仅首次传入生效）
   */
  transformSource?: (text: string) => string;
  /**
   * @deprecated 旧名，等价于 transformSource
   */
  chartConfig?: (text: string) => string;
  /**
  * 代码块默认是否折叠
  */
  defaultCollapsed?: boolean;
  /**
   * content 变化后工具栏/mermaid 扫描的防抖延迟（ms），默认 100（初始化语义）
   */
  toolbarDebounceMs?: number;
  /**
   * @deprecated 旧名，等价于 toolbarDebounceMs
   */
  mermaidDebounce?: number;
  /**
   * 自定义 CDN 配置，如 { mermaid: 'https://...' }（初始化语义：mermaid 库全局仅加载一次）
   */
  cdn?: Record<string, string>;
  /**
   * 自定义 markdown-it 渲染器插件列表，在内部渲染器之后按序执行（初始化语义）
   */
  customRenderers?: MarkdownPlugin[];
  /**
   * 图片预览排除名单（实例级）：位于这些容器内的图片不会进入预览列表，
   * 如：['.copy-password-container']。全局名单请用 addExcludedSelector/removeExcludedSelector
   */
  excludedSelectors?: string[];
  /**
   * 是否显示目录（TOC）按钮和侧边栏
   */
  showToc?: boolean;
  /**
   * 是否启用增量渲染（使用 morphdom 进行 DOM 差异化更新）
   * 适用于流式输出或编辑器场景，避免全量重绘导致的状态丢失。
   * 初始化语义：渲染途中变更不生效
   */
  incremental?: boolean;
  /**
   * @deprecated 旧名，等价于 incremental
   */
  useIncremental?: boolean;
  /**
   * 增量渲染节流时间（ms），默认 16（初始化语义）
   */
  incrementalThrottleMs?: number;
  /**
   * 是否渲染源码中的原生 HTML。默认 true（历史行为）；
   * 渲染不可信内容（AI 输出/用户上传）时建议设为 false
   */
  html?: boolean;
  /**
   * 覆盖链接校验（初始化语义）。不传则用本库默认 `defaultValidateLink`：
   * markdown-it 原生名单（拒 javascript:/vbscript:/file: 与绝大多数 data: URI，仅放行
   * `data:image/(gif|png|jpeg|webp);`）+ 额外放行无脚本特征的 `data:image/svg+xml` 内联图。
   * 传入则整体接管，要保留库默认可写
   * `validateLink={(url) => myRule(url) || defaultValidateLink(url)}`
   */
  validateLink?: (url: string) => boolean;
}


/** 从 class 中提取代码语言（code 上还会挂 copy-id / mermaid 等动态 class） */
const getCodeLanguage = (code: HTMLElement): string =>
  code.className.match(/language-([^\s]+)/)?.[1] ?? '';

/**
 * 初始化代码块工具栏（复制/语言角标/折叠）。
 * @param scope - 查找作用域：传入当前实例容器，避免多实例互相初始化对方的代码块
 */
const initCodeToolbars = (
  scope: ParentNode,
  props: Pick<RenderMarkdownProps, 'enableMermaid' | 'isSlotMermaid' | 'showCollapseButton' | 'isShowCollapsed'>
) => {
  const { enableMermaid, showCollapseButton } = resolveProps(props);
  scope.querySelectorAll('code[class*="language-"]').forEach((item) => {
    const code = item as HTMLElement;
    const codeType = getCodeLanguage(code);
    // 围栏未闭合（流式输出中）时不隐藏源码：此时不挂图表，应当让用户看到逐步输入的 mermaid 源码
    const mermaidHideClassName = (enableMermaid && codeType === 'mermaid' && !code.classList.contains(FENCE_OPEN_CLASS)) ? 'mermaid-render-noCode' : ''
    const preNode = code.parentNode as HTMLElement | null;
    if (!preNode) return;

    const existing = preNode.querySelector('.pre-handle') as HTMLElement | null;
    if (existing) {
      // 增量 patch 后同步：morphdom 会用新 HTML 的 class 覆盖 <code>，
      // 导致复制按钮依赖的 copy-id 与 mermaid 标记被删除
      const copyId = existing.getAttribute('data-md-copy-id');
      if (copyId && !code.classList.contains(copyId)) {
        code.classList.add(copyId);
      }
      if (mermaidHideClassName) {
        code.classList.add(mermaidHideClassName);
      } else {
        code.classList.remove('mermaid-render-noCode');
      }
      const langEl = existing.querySelector('[data-md-lang]');
      if (langEl && langEl.textContent !== codeType) {
        langEl.textContent = codeType;
      }
      // 折叠按钮配置未变化时保持复用；变化时重建该工具栏
      if (existing.getAttribute('data-md-show-collapsed') === String(showCollapseButton)) {
        return;
      }
      codeRootMap.get(existing)?.unmount();
      codeRootMap.delete(existing);
      existing.remove();
    }

    const copyId = genCopyId();
    code.classList.add(copyId);
    if (mermaidHideClassName) {
      code.classList.add(mermaidHideClassName);
    }
    const handleDOM = document.createElement('div');
    handleDOM.className = 'pre-handle';
    // 持久节点标记：增量 patch 时 morphdom 不会丢弃工具栏，避免每键重建
    handleDOM.setAttribute(MD_PERSIST_ATTR, '');
    handleDOM.setAttribute('data-md-copy-id', copyId);
    handleDOM.setAttribute('data-md-show-collapsed', String(showCollapseButton));
    preNode.insertBefore(handleDOM, code);

    const codeTypeDOM = <>
      <img src={CODE_ICON_URL} alt="" />
      <span data-md-lang>{codeType}</span>
    </>

    // 复制时在所属 <pre> 内查找 <code>：不依赖 document 全局查询，多实例下不会拷错
    const copyDOM = <span className="copy" onClick={() => {
      const target = preNode.querySelector('code');
      if (target) {
        copy(target);
        customMessage.success('复制成功');
      }
    }}><CopyFilled /></span>
    const root = createRoot(handleDOM)
    codeRootMap.set(handleDOM, root)

    root.render(<>
      <span>
        {codeTypeDOM}
      </span>
      <span className="code-handle">
        {copyDOM}
        {showCollapseButton && <CodeToggle preNode={preNode} />}
      </span>
    </>)
  });
};

export default function RenderMarkdown(props: RenderMarkdownProps) {
  const {
    content,
    showBackTop,
    showToc: enableToc,
    footer,
    incrementalThrottleMs,
  } = props;

  // 新名优先、旧名兼容的统一取值（初始化语义的配置均仅首次读取）
  const resolved = resolveProps(props);
  const { incremental, toolbarDebounceMs } = resolved;

  const [html, setHtml] = useState('');
  const [anchors, setAnchors] = useState<AnchorItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [showToc, setShowToc] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerDivRef = useRef<HTMLDivElement | null>(null);
  const preSnapshotRef = useRef<CodeBlockSnapshot | null>(null);

  // 用 ref 存储最新 props，避免 useEffect 闭包陈旧问题
  const propsRef = useRef(props);
  propsRef.current = props;

  // 返回顶部监听目标：首次渲染时固定（初始化语义），并避免在 render 阶段读 document
  const backTopTargetRef = useRef<HTMLElement | null>(null);
  if (backTopTargetRef.current === null) {
    backTopTargetRef.current = props.backTopTarget ?? (typeof document !== 'undefined' ? document.body : null);
  }

  // 传给 memo 子组件（TocSidebar / CustomBackTop）的回调必须引用稳定，
  // 否则 content 变化时内联新函数会击穿 memo，导致整棵目录递归树每次按键重渲染
  const toggleToc = useCallback(() => setShowToc((v) => !v), []);
  const closeToc = useCallback(() => setShowToc(false), []);
  const getBackTopTarget = useCallback(() => backTopTargetRef.current as HTMLElement, []);

  // 增量渲染：diff 移除节点时清理其中的代码工具栏 React Root，避免 Root 泄漏
  const handleNodeDiscarded = useCallback((el: HTMLElement) => {
    const handles: HTMLElement[] = [];
    if (el.classList?.contains('pre-handle')) {
      handles.push(el);
    }
    el.querySelectorAll('.pre-handle').forEach((n) => handles.push(n as HTMLElement));
    // 被移除的 mermaid 图表挂载点：卸载其 React Root，防止泄漏
    // （增量 diff 中顶层图表靠 MD_PERSIST_ATTR 免于移除，这里主要覆盖“随父级插件容器一起被删”的情形）
    if (el.classList?.contains(MERMAID_ROOT_CLASS)) {
      cleanupMermaidRoots(el);
    }
    el.querySelectorAll(`.${MERMAID_ROOT_CLASS}`).forEach((n) => cleanupMermaidRoots(n));
    handles.forEach((h) => {
      const root = codeRootMap.get(h);
      if (root) {
        root.unmount();
        codeRootMap.delete(h);
      }
    });
  }, []);

  // 增量 patch 完成后立即同步代码块工具栏：
  // morphdom 会用新 HTML 的 class 覆盖 <code>，导致 copy-id / mermaid 标记丢失
  const handlePatched = useCallback(() => {
    if (containerRef.current) {
      initCodeToolbars(containerRef.current, propsRef.current);
    }
  }, []);

  // 增量渲染：使用 morphdom 进行 DOM 差异化更新
  const { anchors: incAnchors, hasContent, setInnerRef } = useIncrementalRender({
    content,
    codeType: props.codeType,
    customRenderers: props.customRenderers,
    throttleMs: incrementalThrottleMs,
    // 初始化语义：增量模式下 html 只在挂载时取一次（非增量模式每次渲染读取）
    html: resolved.html,
    validateLink: props.validateLink,
    onNodeDiscarded: handleNodeDiscarded,
    onPatched: handlePatched,
  });

  // 合并两种模式的 anchors
  const effectiveAnchors = incremental ? incAnchors : anchors;
  // 合并两种模式的内容判断
  const showContent = incremental ? hasContent : !!html;

  // 合并渲染逻辑：content 变化时，先渲染 markdown，再防抖初始化工具栏 + Mermaid
  useEffect(() => {
    let toolbarMermaidTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const init = async () => {
      // 非增量模式：先渲染 markdown，增量模式在 hook 中处理
      if (!incremental) {
        // 替换前快照代码块节点，供 layout 阶段复用，避免代码区域整体重建
        preSnapshotRef.current = snapshotCodeBlocks(containerRef.current);
        const { codeType } = propsRef.current;
        let text = '';
        if (!codeType || codeType?.toLocaleLowerCase() === 'md') {
          text = content;
        } else {
          text = '```' + codeType + '\n' + content + '\n```';
        }

        const markdownInfo = await renderMarkdown(
          text,
          propsRef.current.customRenderers,
          {
            html: resolveProps(propsRef.current).html,
            validateLink: propsRef.current.validateLink,
          }
        );
        if (cancelled) return;
        setHtml(markdownInfo?.info);
        setAnchors(markdownInfo?.anchor || []);
      }

      // 两种模式共用：防抖初始化代码工具栏、图片工具栏和 Mermaid
      toolbarMermaidTimer = setTimeout(async () => {
        if (cancelled) return;
        // 先回收脱离文档的图表 Root：内容为空时 .markdown-html 整个不被渲染，
        // 下面拿不到 container，挂在里面的图表只能靠注册表找到并卸载
        if (resolveProps(propsRef.current).enableMermaid) pruneDetachedMermaidRoots();
        const container = containerRef.current;
        if (!container) return;
        initCodeToolbars(container, propsRef.current);

        const { isPrintPreview, excludedSelectors } = propsRef.current;
        initImageToolbars(container, { isPrintPreview, instanceSelectors: excludedSelectors });

        const {
          enableMermaid,
          transformSource,
        } = resolveProps(propsRef.current);
        const { showDriverGuide, defaultCollapsed, cdn } = propsRef.current;
        if (enableMermaid) {
          // DOM 稳定后统一渲染本容器内的 Mermaid 图表
          const { renderMermaidWithControls } = await import('../MermaidRenderer');
          await renderMermaidWithControls({
            showDriverGuide,
            isPrintPreview,
            transformSource,
            defaultCollapsed,
            cdn,
            rootElement: container,
          });
        }
      }, toolbarDebounceMs);
    };

    init();

    return () => {
      cancelled = true;
      if (toolbarMermaidTimer) clearTimeout(toolbarMermaidTimer);
    };
    // 仅依赖 content：其余配置项均为初始化语义，渲染途中变更不感知
    // （注：项目未装 eslint-plugin-react-hooks，不要在此写 exhaustive-deps 的 disable 指令，
    //   指令指向未注册的规则会被 eslint 报 "Definition for rule ... was not found"）
  }, [content]);

  // 非增量模式：dangerouslySetInnerHTML 会整体重建预览 DOM。在浏览器绘制前
  // 把未变化的代码块节点（含工具栏）换回，避免代码区域闪烁。
  useLayoutEffect(() => {
    if (incremental || !html) return;
    restoreCodeBlocks(innerDivRef.current, preSnapshotRef.current);
    preSnapshotRef.current = null;
    // 清理未被复用、已随旧 DOM 一起被替换掉的代码块工具栏 Root
    codeRootMap.forEach((root, handle) => {
      if (!handle.isConnected) {
        root.unmount();
        codeRootMap.delete(handle);
      }
    });
  }, [html, incremental]);

  // 组件卸载：清理本容器内的代码工具栏 Root、Mermaid Root 与图片预览实例
  // （codeRootMap 是模块级的，只清理当前容器，避免误伤其他实例）
  const unmountSnapshotRef = useRef<HTMLElement | null>(null);
  unmountSnapshotRef.current = containerRef.current;
  useEffect(() => {
    return () => {
      const container = unmountSnapshotRef.current;
      if (!container) return;
      container.querySelectorAll('.pre-handle').forEach((h) => {
        const handle = h as HTMLElement;
        const root = codeRootMap.get(handle);
        if (root) {
          root.unmount();
          codeRootMap.delete(handle);
        }
      });
      // 图表 root 在 .mermaid-react-root 节点上（.pre-handle 的兄弟），需单独回收
      cleanupMermaidRoots(container);
      // 销毁本容器的图片预览实例
      cleanupImageToolbars(container);
    };
  }, []);

  // IntersectionObserver 监听标题滚动，更新 activeId
  useEffect(() => {
    if (effectiveAnchors.length === 0) return;

    const allHrefs: string[] = [];
    const collectHrefs = (items: AnchorItem[]) => {
      items.forEach(item => {
        allHrefs.push(item.href);
        if (item.children?.length) {
          collectHrefs(item.children);
        }
      });
    };
    collectHrefs(effectiveAnchors);

    const elements = allHrefs.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 多个标题可能同时进入检测区域，取最靠近视口顶部的那个
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top ? entry : closest
        );
        setActiveId(topMost.target.id);
      },
      { rootMargin: '0px 0px -90% 0px', threshold: 0 }
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [effectiveAnchors]);

  // 页面 hash 支持：初始定位 + 监听 hash 变化
  useEffect(() => {
    // 根据当前 hash 滚动到对应元素
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(hash);
      }
    };

    // DOM 渲染后执行初始定位
    const timer = setTimeout(scrollToHash, 100);

    // 监听 hash 变化（浏览器前进/后退按钮）
    const handleHashChange = () => scrollToHash();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [effectiveAnchors]);

  // 根据模式确定 inner div 的属性
  const innerProps = incremental
    ? { ref: setInnerRef }
    : { ref: innerDivRef, dangerouslySetInnerHTML: { __html: html } };

  return (
    <div className='markdown'>
      {showContent ? (
        <div className='markdown-html' ref={containerRef}>
          <div style={{ width: '100%' }} {...innerProps} />
          {footer && <div className="markdown-footer">{footer}</div>}
        </div>
      ) : (
        <Empty />
      )}
      {showBackTop && <CustomBackTop target={getBackTopTarget} />}

      {/* 目录按钮 */}
      {enableToc && effectiveAnchors.length > 0 && (
        <div className={classnames(styles.tocToggle, 'md-toc-toggle', 'remons-markdown-circle')} onClick={toggleToc}>
          <UnorderedListOutlined />
        </div>
      )}

      {/* 目录面板 */}
      {enableToc && (
        <TocSidebar
          anchors={effectiveAnchors}
          activeId={activeId}
          visible={showToc}
          onClose={closeToc}
        />
      )}
    </div>
  );
}