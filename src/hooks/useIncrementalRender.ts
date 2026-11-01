import { useRef, useEffect, useState, useCallback } from 'react';
import morphdom from 'morphdom';
import renderMarkdown, { MarkdownPlugin, AnchorItem, RenderMarkdownOptions } from '@/components/RenderMarkdown/utils/render-markdown';
import { MD_PERSIST_ATTR, MD_KEY_ATTR, MERMAID_ROOT_CLASS } from '@/utils/dom-contract';

// 契约常量定义在 @/utils/dom-contract（供 RenderMarkdown / MermaidRenderer 共用），
// 这里继续具名导出以兼容既有引用方（MD_PERSIST_ATTR 属公开 API）
export { MD_PERSIST_ATTR };

interface UseIncrementalRenderOptions {
  /** Markdown 内容 */
  content: string;
  /**
   * 代码类型包装
   * 初始化语义：仅在挂载时读取，渲染途中变更不生效
   */
  codeType?: string;
  /**
   * 自定义 markdown-it 插件
   * 初始化语义：仅在挂载时读取，渲染途中变更不生效
   */
  customRenderers?: MarkdownPlugin[];
  /**
   * 增量渲染节流时间（ms），默认 16（~60fps）
   * 初始化语义：仅在挂载时读取
   * 真节流语义：首个内容变化立即渲染，期间的新变化最多每 throttleMs 渲染一次（含收尾）
   */
  throttleMs?: number;
  /**
   * 是否渲染源码中的原生 HTML（安全开关）。
   * 初始化语义：仅在挂载时读取；缺省 true。
   * 修复前增量模式没把该开关透传给 renderMarkdown，导致 html=false 只在非增量模式下生效。
   */
  html?: RenderMarkdownOptions['html'];
  /**
   * 覆盖链接校验（缺省不传则用本库默认 defaultValidateLink：markdown-it 名单 + 放行内联 svg 图）。
   * 初始化语义：仅在挂载时读取；传入则整体接管，只对可信内容放宽
   */
  validateLink?: RenderMarkdownOptions['validateLink'];
  /**
   * 节点被 morphdom diff 移除后触发（含被移除子树的递归子节点）。
   * 用于清理挂在被移除节点上的 React Root、监听器等状态。
   */
  onNodeDiscarded?: (el: HTMLElement) => void;
  /**
   * 每次 DOM patch 完成后同步触发（浏览器绘制前）。
   * 用于恢复被 diff 丢弃的运行时标记（如代码块工具栏的动态 class / 语言标签）。
   */
  onPatched?: () => void;
}

/**
 * JS 运行时动态追加的 class，不参与节点语义签名计算：
 * 这些 class 每次 diff 都可能变化，计入签名会导致节点无法被复用。
 */
const JS_ADDED_CLASSES = new Set([
  'mermaid-render-noCode',
  'code-collapsed',
  'has-left-mask',
  'has-right-mask',
  'has-both-masks',
  'active',
]);

/**
 * patch 时需要从旧 DOM 保留下来的运行时 class。
 * morphdom 会用新 HTML 的 class 整体覆写旧节点，这类「源码里不存在、纯 JS 状态」的
 * class 一被擦掉就表现为：折叠的代码块每次流式更新都自动弹开、横向滚动的渐隐蒙层闪没、
 * mermaid 源码在围栏闭合后又被显示出来。与上面的签名集合不等同：
 * 不含 tab 的 active —— 那个由源码 @tab:active 决定，新 HTML 才是权威来源。
 */
const PRESERVED_JS_CLASSES: string[] = [
  'mermaid-render-noCode',
  'code-collapsed',
  'has-left-mask',
  'has-right-mask',
  'has-both-masks',
];

/**
 * 源码拥有的 data-*：取值由生成的 HTML 决定，patch 后必须完全跟随新 HTML（该消失的就消失），
 * 不能像 JS 守卫位那样回填。否则源码把 @tab:active 换到另一个标签后，旧标签上被回填的
 * data-active 会让「源码态」永远读回第一项。
 * （@mdit/plugin-tab 是本库输出 HTML 里唯一写 data-* 的第三方插件）
 */
const SOURCE_OWNED_DATA_ATTRS = new Set(['data-tab', 'data-index', 'data-id', 'data-active']);

/** 规范化 class：排除 JS 运行时追加的 class，得到可用于跨渲染匹配的节点身份 */
const normalizeClassName = (el: HTMLElement): string => {
  // 快路径：无 class 的节点（纯文本容器、p/ul/pre 等）直接参与不了语义签名，
  // 不必为每个节点做一次 split + filter（key 索引会遍历整棵树，流式场景每帧都跑）
  const raw = typeof el.className === 'string' ? el.className : '';
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('copy-') && !JS_ADDED_CLASSES.has(c))
    .join(' ');
};

/** 基础签名：标签名 + 规范化 class；无 class 时返回空串（无法确定语义身份） */
const getBaseSignature = (el: HTMLElement): string => {
  const normalized = normalizeClassName(el);
  return normalized ? `${el.tagName.toLowerCase()}#${normalized}` : '';
};

/**
 * 元素的基础语义 key：优先 id（markdown-it-anchor 给标题挂的 id，slug 已保证同文档唯一），
 * 其次「标签名 + 规范化 className」，让插件产出的不同容器（badge / shareCode / linkCard 等）
 * 按类型匹配，避免内容位移时不同类型的块被按位置错配（旧状态挂到错误元素上）。
 * 返回空串表示无法确定语义身份，交回 morphdom 默认的位置匹配。
 */
const getElementKey = (el: HTMLElement): string => {
  const id = el.getAttribute('id');
  if (id) return `id:${id}`;
  return getBaseSignature(el);
};

/**
 * 一次 patch 的 key 索引：为参与 diff 的两棵树分别分配「树内全局唯一」的语义 key。
 *
 * 为什么必须消歧（这是「源码已删除、渲染还在」的根因）：
 * morphdom 的 fromNodesLookup 是「一个 key 只存一个节点」的单槽映射（indexTree 递归时
 * 后来者直接覆盖前者），而 keyed 节点的删除延迟到 patch 结尾按 key 回查执行；同一棵树里
 * 只要有两个元素的基础 key 相同（同段两个序号 span、两个同类 Alert、三个 tab 按钮、
 * 跨段落的两行内公式……），被覆盖的那个就永远回查不到，一直留在 DOM 里且不会自愈，
 * 每次 patch 还可能多留一个。反向同理：handleNodeAdded 也会按 key 把远处的同名旧节点
 * 拽进新增子树，表现为内容张冠李戴。
 *
 * 消歧方式：按「该 key 在文档序中第几次出现」加 [n] 后缀，首个保持裸 key ——
 * 签名唯一时行为与消歧前完全相同，只有重名节点才多出确定性身份。
 * 两个要点：
 * - 计数范围是整棵树而不是同一个父级：indexTree 会递归索引所有后代，跨父级的同名节点
 *   同样会撞槽（KaTeX 内层 .base/.katex-mathml 每个公式都有，必然跨段撞）；
 * - 自己用 TreeWalker 预遍历两棵树，不靠 morphdom 的访问顺序：morphdom 遇到 textarea /
 *   select 等特殊元素会跳过子树，惰性计数会让两棵树的序号错位。
 */
const buildKeyIndex = (fromRoot: HTMLElement, toRoot: HTMLElement): WeakMap<Element, string> => {
  const index = new WeakMap<Element, string>();
  // 每棵树独立计数：同一文档序位置的元素在两棵树中拿到相同后缀，才能按类型对齐复用
  const assign = (root: HTMLElement) => {
    const counts = new Map<string, number>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node as HTMLElement;
      const base = getElementKey(el);
      if (!base) continue;
      const seen = counts.get(base);
      index.set(el, seen === undefined ? base : `${base}[${seen}]`);
      counts.set(base, (seen ?? 0) + 1);
    }
  };
  // 容器根自身不参与（childrenOnly 模式下只 diff 子节点，根被索引反而会与 to 根互删）
  assign(fromRoot);
  assign(toRoot);
  return index;
};

/**
 * 插件协议：占位符元素被 React 接管后会带上 data-md-mounted。
 * 与 markdown-plugins 的 MD_MOUNTED_ATTR 取值一致（该包依赖本库，不能反向 import，
 * 修改属性名时需两侧同步）。
 */
const MD_MOUNTED_ATTR = 'data-md-mounted';

/** 持久节点身份：优先 mount 时记录的原始 class，否则用当前 class */
const getPersistKey = (el: HTMLElement): string => {
  const custom = el.getAttribute(MD_KEY_ATTR);
  return `${el.tagName.toLowerCase()}#${custom ?? normalizeClassName(el)}`;
};

/** 是否插件占位符元素（带 xxx-placeholder 属性） */
const isPlaceholderEl = (el: HTMLElement): boolean =>
  Array.from(el.attributes).some((attr) => attr.name.endsWith('-placeholder'));

/** 读取节点的业务配置属性（排除占位符 / 持久标记等运行时属性） */
const getPersistConfig = (el: HTMLElement): Record<string, string> => {
  const config: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (!attr.name.startsWith('data-')) continue;
    if (attr.name === MD_PERSIST_ATTR || attr.name === MD_KEY_ATTR) continue;
    if (attr.name.endsWith('-placeholder')) continue;
    config[attr.name] = attr.value;
  }
  return config;
};

/** 新占位符的配置与旧组件完全一致时才复用旧节点，保证配置修改后会重新挂载 */
const isSamePersistConfig = (a: HTMLElement, b: HTMLElement): boolean => {
  const next = getPersistConfig(b);
  const prev = getPersistConfig(a);
  return Object.keys(next).every((name) => prev[name] === next[name]);
};

interface PersistSnapshotItem {
  /** 持久容器（带 data-md-persist 的最外层包装），插件 DOM 协议中即含占位符的外层 div */
  el: HTMLElement;
  key: string;
  /** 占位符（未挂载）或已挂载组件根（React 接管后的占位符）上的业务配置元素；
   *  非插件的 JS 动态持久节点（收起按钮等）为 null */
  configEl: HTMLElement | null;
  mounted: boolean;
}

/** 在持久容器内定位占位符 / 已挂载组件根（两者互斥：mount 时占位符属性会被摘除） */
const findPersistConfigEl = (root: HTMLElement): HTMLElement | null => {
  const mounted = root.querySelector<HTMLElement>(`[${MD_MOUNTED_ATTR}]`);
  if (mounted) return mounted;
  return Array.from(root.querySelectorAll<HTMLElement>('*')).find(isPlaceholderEl) ?? null;
};

/**
 * patch 前把已挂载的插件容器从 DOM 摘除。
 * 否则 morphdom 会按 className 把新占位符匹配成同一个节点，并用空占位符的子节点
 * 覆盖组件已渲染的 DOM，且 MutationObserver 不会重新挂载，表现为插件“打不开”。
 * 代码块工具栏（.pre-handle）由 onBeforeNodeDiscarded 保护，不在此处理。
 * Mermaid 图表挂载点同理：它不是占位符，摘出去就没有位置可回来（restore 只认
 * *-placeholder），一旦摘除图表就会每帧消失，故同样只靠 onBeforeNodeDiscarded 保留。
 */
const detachPersistentNodes = (inner: HTMLElement): PersistSnapshotItem[] => {
  const candidates: HTMLElement[] = [];
  inner.querySelectorAll(`[${MD_PERSIST_ATTR}]`).forEach((node) => {
    const el = node as HTMLElement;
    if (el.classList.contains('pre-handle')) return;
    if (el.classList.contains(MERMAID_ROOT_CLASS)) return;
    // 嵌套容器随最外层一起摘除，避免重复处理
    if (el.parentElement?.closest(`[${MD_PERSIST_ATTR}]`)) return;
    candidates.push(el);
  });
  // 先收集再摘除：恢复阶段会把无匹配目标的节点原位放回，避免边遍历实时 NodeList 边 remove
  const items = candidates.map((el) => {
    const configEl = findPersistConfigEl(el);
    return {
      el,
      key: getPersistKey(el),
      configEl,
      mounted: configEl?.hasAttribute(MD_MOUNTED_ATTR) ?? false,
    };
  });
  items.forEach((item) => item.el.remove());
  return items;
};

/**
 * patch 后把旧持久容器换回到对应占位符所在的容器位置：
 * - 同 key、同配置 → 旧容器（含已挂载的 React Root）整体换回，组件不重挂、不闪动；
 * - 配置变化 → 新容器留在原位（占位符完好），由插件的 MutationObserver 重新挂载；
 * - 未挂载的快照容器与无归属节点（如 JS 动态插入的持久控件）→ 原位放回，
 *   等待 observer 挂载 / 保持既有行为不被破坏。
 * @param onDiscarded 没换回 DOM 的快照容器回调（它们是在 patch 前被我们自己 remove 的，
 *                    morphdom 生命周期看不见，不通知就是使用方 React Root 永久泄漏）
 */
const restorePersistentNodes = (
  inner: HTMLElement,
  items: PersistSnapshotItem[],
  onDiscarded?: (el: HTMLElement) => void,
) => {
  if (items.length === 0) return;
  const used = new Set<PersistSnapshotItem>();

  // 已挂载组件的恢复：按占位符所在持久容器的 key + 占位符配置与快照逐项匹配
  const placeholders = Array.from(inner.querySelectorAll('*')).filter((node) =>
    isPlaceholderEl(node as HTMLElement),
  ) as HTMLElement[];

  placeholders.forEach((placeholder) => {
    const target = placeholder.closest(`[${MD_PERSIST_ATTR}]`) as HTMLElement | null;
    if (!target) return;
    const key = getPersistKey(target);
    const match = items.find(
      (item) =>
        item.key === key &&
        !used.has(item) &&
        !!item.configEl &&
        // 未挂载快照的配置在占位符上；已挂载快照的配置在 React 接管的组件根上。
        // React 渲染会改写 DOM，配置变化时旧节点必然被重新挂载，此时挂载态与占位符不一致，
        // 据此自然落到"不匹配 → 保留占位符重挂"分支
        isSamePersistConfig(item.configEl, placeholder),
    );
    if (!match) return;
    used.add(match);
    // 无论快照是否已挂载，都是整个旧容器换回新容器位置：
    // 已挂载时 React Root 随 DOM 移动保持存活（不重挂、不闪动）；
    // 未挂载时占位符原样回到原位，等待 observer 挂载
    target.replaceWith(match.el);
  });

  // JS 动态插入的持久节点（无占位符配置元素，如插件收起按钮）：快照阶段随外层容器一起
  // 被摘除，patch 后按语义 key / 签名换回到同身份的新持久节点位置；
  // 找不到对应新节点则放回末尾，保持"patch 不移除持久节点"的既有语义
  const wrappersNow = Array.from(inner.querySelectorAll(`[${MD_PERSIST_ATTR}]`)) as HTMLElement[];
  items.forEach((item) => {
    if (used.has(item) || item.configEl) return;
    if (item.el.isConnected) return;
    const key = getPersistKey(item.el);
    const sig = getElementKey(item.el);
    const target = wrappersNow.find(
      (el) =>
        el !== item.el &&
        el.isConnected &&
        !findPersistConfigEl(el) &&
        (getPersistKey(el) === key || getElementKey(el) === sig),
    );
    if (target) {
      target.replaceWith(item.el);
    } else {
      inner.appendChild(item.el);
    }
    used.add(item);
  });
  // 未换回 DOM 的快照容器（插件块被删、或配置变化后交给 observer 重挂）：
  // 通知一次，让使用方有机会 unmount 挂在其中的 React Root / 事件监听
  if (onDiscarded) {
    items.forEach((item) => {
      if (!item.el.isConnected) onDiscarded(item.el);
    });
  }
};

/** applyPatch 等待容器挂载的最大重试次数（防组件始终未挂载时的无限自旋） */
const MAX_PATCH_RETRIES = 60;

/**
 * 清空容器并逐个通知销毁。
 * innerHTML 直清不经过 morphdom 生命周期，不通知就是挂在其中的 React Root
 *（代码工具栏 / 图表 / 插件容器）永久泄漏。
 */
const clearContainer = (inner: HTMLElement, onDiscarded?: (el: HTMLElement) => void) => {
  const children = Array.from(inner.children) as HTMLElement[];
  inner.innerHTML = '';
  if (onDiscarded) children.forEach((el) => onDiscarded(el));
};

/**
 * 渲染抛错后的补偿重试：最多 MAX_RENDER_RETRIES 次、每次间隔 RENDER_RETRY_DELAY_MS。
 * 只重试一次窗口内的最新内容（seq 已前进则放弃，新内容自带调度），避免确定性报错时自旋。
 */
const MAX_RENDER_RETRIES = 2;
const RENDER_RETRY_DELAY_MS = 300;

/**
 * 增量渲染 hook，使用 morphdom 进行部分 DOM 更新。
 *
 * - 首次渲染：使用 innerHTML 设置初始内容
 * - 后续渲染：渲染为字符串，然后通过 morphdom patch 容器
 * - 节流 patch 调用（真节流：首次立即执行 + 周期收尾），避免流式输出期间过多 DOM 操作
 * - 渲染序号保证内容变化后，飞行中的渲染结果不会污染新状态
 * - 按"标签 + className"语义 key 匹配节点，保护 customRenderers（插件）产出的容器状态；
 *   树内重名 key 会加 [n] 后缀消歧，避免 morphdom 单槽 key 映射让被删节点逃过销毁
 * - 保留节点上 JS 添加的 data-* 属性（初始化守卫位）与运行时 class（折叠态/蒙层），
 *   避免 patch 后被重复初始化或状态被新 HTML 覆写；源码拥有的 data-*（tab 的 data-active 等）
 *   不回填，以新 HTML 为准
 * - 渲染结果为空串、或渲染抛错，都会让 DOM 与源码保持一致（不静默丢弃本轮更新）；
 *   空输出同时把 hasContent 置假，与全量模式一样回退到 Empty 占位
 * - 返回 inner 内容 <div> 的 ref 回调
 *
 * 注意：除 content 外的所有选项均为**初始化语义**——仅在挂载时读取一次，
 * 渲染途中变更不生效（customRenderers / codeType / throttleMs 等）。
 */
export function useIncrementalRender({
  content,
  codeType,
  customRenderers,
  throttleMs = 16,
  html = true,
  validateLink,
  onNodeDiscarded,
  onPatched,
}: UseIncrementalRenderOptions) {
  const [anchors, setAnchors] = useState<AnchorItem[]>([]);
  const [hasContent, setHasContent] = useState(false);

  const lastContentRef = useRef('');
  const innerDivRef = useRef<HTMLDivElement | null>(null);
  const isInitialRef = useRef(true);
  /** 渲染序号：content 变化后使其自增，飞行中的旧渲染结果据此作废 */
  const renderSeqRef = useRef(0);

  // 初始化语义：选项在挂载时固定，后续变更不感知；
  // 同时让 doRenderAndPatch/schedulePatch 保持稳定引用，避免 effect 依赖抖动丢失节流定时器
  const initOptionsRef = useRef({ codeType, customRenderers, throttleMs, html, validateLink });

  const callbacksRef = useRef({ onNodeDiscarded, onPatched });
  callbacksRef.current = { onNodeDiscarded, onPatched };

  /** 渲染报错后的补偿重试定时器（卸载时一并清除） */
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRenderAndPatch = useCallback(async (rawContent: string, seq: number, retries = 0) => {
    const { codeType: initCodeType, customRenderers: initRenderers, html: initHtml, validateLink: initValidateLink } = initOptionsRef.current;
    const text = (!initCodeType || initCodeType?.toLocaleLowerCase() === 'md')
      ? rawContent
      : '```' + initCodeType + '\n' + rawContent + '\n```';

    let markdownInfo: Awaited<ReturnType<typeof renderMarkdown>> | undefined;
    /*
     * 有界补偿重试：仅当仍是最新内容时重跑一轮（渲染 + patch）。
     * 不确定这个 seq 后续会不会再来新内容，所以新内容一来就不重试（它自带调度）。
     */
    const scheduleRetry = () => {
      if (seq !== renderSeqRef.current || retries >= MAX_RENDER_RETRIES) return;
      if (retryTimerRef.current != null) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (seq === renderSeqRef.current) doRenderAndPatch(rawContent, seq, retries + 1);
      }, RENDER_RETRY_DELAY_MS);
    };

    try {
      markdownInfo = await renderMarkdown(text, initRenderers, { html: initHtml, validateLink: initValidateLink });
    } catch (err) {
      /*
       * 渲染抛错（自定义插件报错、CDN 抖动、后台标签页里网络被挂起等）不能静默放弃：
       * 旧 DOM 会停在上一版，用户看到的正是「源码已改/已删、渲染还在」。
       * 这里保留上一版 DOM（不做半截清空），并重试一次。
       */
      console.error('[useIncrementalRender] markdown 渲染失败，保留上一版 DOM:', err);
      scheduleRetry();
      return;
    }
    // 渲染期间内容已变化（或组件卸载），丢弃过期结果
    if (!markdownInfo || seq !== renderSeqRef.current) return;

    /*
     * 空串是合法渲染结果，必须照样走到容器上（见下方 applyPatch 里的空输出分支）：
     * 不能回到旧语义「没内容就不动 DOM」，那正是残留的来源。
     */
    const newHtml = markdownInfo.info ?? '';

    const applyPatch = (mountTries = 0) => {
      if (seq !== renderSeqRef.current) return;
      const inner = innerDivRef.current;
      if (!inner) {
        // 首帧 hasContent 置 true 后容器可能尚未 commit 完成，下一轮重试（有上限兜底）
        if (mountTries < MAX_PATCH_RETRIES) {
          setTimeout(() => applyPatch(mountTries + 1), 0);
        } else {
          /* 容器长期拿不到：本轮更新就此丢失，必须说一声，否则源码与渲染不一致会被当成静默 bug */
          console.warn('[useIncrementalRender] 容器未挂载，放弃本轮 patch（源码与渲染可能不一致）');
        }
        return;
      }

      setAnchors(markdownInfo.anchor || []);

      /*
       * 渲染结果为空（正文只剩空白/换行，或 html=false 时源码只有标签）：
       * 容器里一个节点都不得留下，包括 morphdom 因 MD_PERSIST_ATTR 而免于移除的图表挂载点、
       * 以及 patch 前摘出去、已没有占位符可回去的插件容器（搬回来就是残留）。
       * 同时把 hasContent 也置假，与全量模式（html='' → Empty 占位）的表现对齐：
       * 否则一边是空白区域、一边是占位文案，两栏文本长度永远对不上。
       * 修复前这里直接 return，于是「删光正文只留一个空格」会让渲染区继续挂着整片旧内容。
       */
      if (newHtml.trim() === '') {
        const discarded = detachPersistentNodes(inner);
        clearContainer(inner, callbacksRef.current.onNodeDiscarded);
        discarded.forEach((item) => {
          if (!item.el.isConnected) callbacksRef.current.onNodeDiscarded?.(item.el);
        });
        lastContentRef.current = text;
        // 交还占位后容器会被 React 卸载重建，下一轮按首帧 innerHTML 走最稳
        isInitialRef.current = true;
        setHasContent(false);
        callbacksRef.current.onPatched?.();
        return;
      }

      if (isInitialRef.current) {
        inner.innerHTML = newHtml;
        isInitialRef.current = false;
        lastContentRef.current = text;
        return;
      }

      // childrenOnly 模式：包裹 HTML，只更新子节点
      const wrapper = document.createElement('div');
      wrapper.innerHTML = newHtml;

      // 已挂载插件容器先摘除，patch 后再按配置恢复，避免被占位符清空
      const persistItems = detachPersistentNodes(inner);

      // 语义 key 必须在摘除之后建立：快照容器已不在 from 树中，参与计数会让后缀错位
      const keyIndex = buildKeyIndex(inner, wrapper);

      // data-* / 运行时 class 快照：morphdom 会移除旧节点上新 HTML 中不存在的 data-* 属性，
      // 导致 JS 守卫位（如 data-click-inited / data-circleBound）丢失，同一元素每次 patch 后
      // 被重复初始化（重复绑定事件 / 重复 createRoot）；class 同理会被整体覆写，
      // 折叠态、渐隐蒙层这类纯运行时状态会弹回默认值。patch 前记录、patch 后写回。
      const dataBackup = new WeakMap<HTMLElement, Map<string, string>>();
      const classBackup = new WeakMap<HTMLElement, string[]>();

      morphdom(inner, wrapper, {
        childrenOnly: true,
        // 插件容器按语义 key 匹配，避免不同容器互相错配；重名 key 已在 keyIndex 中消歧
        getNodeKey: (node) => (node.nodeType === 1 ? keyIndex.get(node as Element) ?? null : null),
        onBeforeElUpdated(fromEl, toEl) {
          const backup = new Map<string, string>();
          for (const attr of Array.from(fromEl.attributes)) {
            if (!attr.name.startsWith('data-') || SOURCE_OWNED_DATA_ATTRS.has(attr.name)) continue;
            if (toEl.hasAttribute(attr.name)) continue;
            backup.set(attr.name, attr.value);
          }
          if (backup.size) dataBackup.set(fromEl, backup);

          const kept = PRESERVED_JS_CLASSES.filter(
            (cls) => fromEl.classList.contains(cls) && !toEl.classList.contains(cls),
          );
          if (kept.length) classBackup.set(fromEl, kept);
          return true;
        },
        onElUpdated(fromEl) {
          const backup = dataBackup.get(fromEl);
          if (backup) {
            backup.forEach((value, name) => fromEl.setAttribute(name, value));
            dataBackup.delete(fromEl);
          }
          const kept = classBackup.get(fromEl);
          if (kept) {
            kept.forEach((cls) => fromEl.classList.add(cls));
            classBackup.delete(fromEl);
          }
        },
        onBeforeNodeAdded(el) {
          // 跳过 .pre-handle 元素（包含 React 工具栏），会在 patch 后由 initCodeToolbars 重新初始化
          if (el.nodeType === 1 && (el as HTMLElement).classList.contains('pre-handle')) {
            return false;
          }
          // 返回 el，允许节点正常添加
          return el;
        },
        onBeforeNodeDiscarded(el) {
          // 带 MD_PERSIST_ATTR 标记的节点由 JS 动态插入（插件收起按钮等），diff 不移除
          if (el.nodeType === 1 && (el as HTMLElement).hasAttribute(MD_PERSIST_ATTR)) {
            return false;
          }
          return true;
        },
        onNodeDiscarded(el) {
          if (el.nodeType === 1 && callbacksRef.current.onNodeDiscarded) {
            callbacksRef.current.onNodeDiscarded(el as HTMLElement);
          }
        },
      });
      restorePersistentNodes(inner, persistItems, callbacksRef.current.onNodeDiscarded);
      lastContentRef.current = text;
      callbacksRef.current.onPatched?.();
    };

    try {
      applyPatch();
    } catch (err) {
      /*
       * morphdom 或消费方回调报错：lastContentRef 在 applyPatch 末尾才写，这里不写就是
       * “本轮未完成”，下一次内容变化会自然重画；同时做一次重试，避免用户停手后停在半截 DOM。
       */
      console.error('[useIncrementalRender] DOM patch 失败:', err);
      scheduleRetry();
    }
  }, []);

  // 真节流：leading 立即执行；窗口期内的新内容合并为一次 trailing 渲染
  const lastRunAtRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRender = useCallback((rawContent: string, seq: number) => {
    const windowMs = initOptionsRef.current.throttleMs;
    const now = Date.now();
    const elapsed = now - lastRunAtRef.current;

    const run = () => {
      lastRunAtRef.current = Date.now();
      doRenderAndPatch(rawContent, seq);
    };

    if (elapsed >= windowMs) {
      if (trailingTimerRef.current != null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
      run();
      return;
    }

    // 窗口期内：仅保留最后一次待执行内容（流式场景旧内容必然被新内容取代）
    if (trailingTimerRef.current != null) {
      clearTimeout(trailingTimerRef.current);
    }
    trailingTimerRef.current = setTimeout(() => {
      trailingTimerRef.current = null;
      // 期间内容若已被更新（seq 前进），旧 seq 的渲染会被 doRenderAndPatch 序号校验作废，
      // 而新内容已自带调度，这里只需按当前 seq 判断
      if (seq === renderSeqRef.current) {
        run();
      }
    }, windowMs - elapsed);
  }, [doRenderAndPatch]);

  useEffect(() => {
    const { codeType: initCodeType } = initOptionsRef.current;
    if (!content) {
      // 内容清空也在渲染序号上作废一切在途渲染
      renderSeqRef.current += 1;
      if (retryTimerRef.current != null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      isInitialRef.current = true;
      setHasContent(false);
      // 锚点同步清空：否则 TOC 按钮与面板继续挂着已删除标题的死链接
      setAnchors([]);
      lastContentRef.current = '';
      const inner = innerDivRef.current;
      if (inner) clearContainer(inner, callbacksRef.current.onNodeDiscarded);
      return;
    }

    const wrappedContent = (!initCodeType || initCodeType?.toLocaleLowerCase() === 'md')
      ? content
      : '```' + initCodeType + '\n' + content + '\n```';

    if (lastContentRef.current === wrappedContent) {
      return;
    }

    renderSeqRef.current += 1;
    const seq = renderSeqRef.current;
    setHasContent(true);

    // 首次内容直接渲染，不节流
    if (isInitialRef.current) {
      doRenderAndPatch(content, seq);
      return;
    }

    scheduleRender(content, seq);
  }, [content, doRenderAndPatch, scheduleRender]);

  useEffect(() => {
    return () => {
      // 组件卸载：所有在途渲染作废，清理待执行节流窗口与重试定时器
      renderSeqRef.current += 1;
      if (trailingTimerRef.current != null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
      if (retryTimerRef.current != null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const setInnerRef = useCallback((node: HTMLDivElement | null) => {
    innerDivRef.current = node;
  }, []);

  return { anchors, hasContent, setInnerRef };
}

export default useIncrementalRender;
