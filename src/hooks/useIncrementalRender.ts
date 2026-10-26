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
 * 为元素节点生成稳定的语义 key，供 morphdom 做 keyed 匹配：
 * - 优先 id（如 markdown-it-anchor 给标题挂的 id），保证语义对应；
 * - 其次"标签名 + 规范化 className"（排除 JS 动态追加的 class），
 *   让插件产出的不同容器（badge / shareCode / linkCard 等）按类型匹配，
 *   避免内容位移时不同类型的块被按位置错配（旧状态挂到错误元素上）；
 * - 无法确定语义时返回 null，回退 morphdom 默认的位置匹配。
 */
function getNodeSignature(node: Node): string | null {
  if (node.nodeType !== 1) return null;
  const el = node as HTMLElement;
  const id = el.getAttribute('id');
  if (id) return `id:${id}`;
  const raw = typeof el.className === 'string' ? el.className : '';
  const normalized = raw
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('copy-') && !JS_ADDED_CLASSES.has(c))
    .join(' ');
  if (!normalized) return null;
  return `${el.tagName.toLowerCase()}#${normalized}`;
}

/** 规范化 class：排除 JS 运行时追加的 class，得到可用于跨渲染匹配的节点身份 */
const normalizeClassName = (el: HTMLElement): string =>
  (typeof el.className === 'string' ? el.className : '')
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('copy-') && !JS_ADDED_CLASSES.has(c))
    .join(' ');

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
 */
const restorePersistentNodes = (inner: HTMLElement, items: PersistSnapshotItem[]) => {
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
    const sig = getNodeSignature(item.el);
    const target = wrappersNow.find(
      (el) =>
        el !== item.el &&
        el.isConnected &&
        !findPersistConfigEl(el) &&
        (getPersistKey(el) === key || getNodeSignature(el) === sig),
    );
    if (target) {
      target.replaceWith(item.el);
    } else {
      inner.appendChild(item.el);
    }
    used.add(item);
  });
};

/** applyPatch 等待容器挂载的最大重试次数（防组件始终未挂载时的无限自旋） */
const MAX_PATCH_RETRIES = 60;

/**
 * 增量渲染 hook，使用 morphdom 进行部分 DOM 更新。
 *
 * - 首次渲染：使用 innerHTML 设置初始内容
 * - 后续渲染：渲染为字符串，然后通过 morphdom patch 容器
 * - 节流 patch 调用（真节流：首次立即执行 + 周期收尾），避免流式输出期间过多 DOM 操作
 * - 渲染序号保证内容变化后，飞行中的渲染结果不会污染新状态
 * - 按"标签 + className"语义 key 匹配节点，保护 customRenderers（插件）产出的容器状态
 * - 保留节点上 JS 添加的 data-* 属性（初始化守卫位），避免 patch 后被重复初始化
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

  const doRenderAndPatch = useCallback(async (rawContent: string, seq: number) => {
    const { codeType: initCodeType, customRenderers: initRenderers, html: initHtml, validateLink: initValidateLink } = initOptionsRef.current;
    const text = (!initCodeType || initCodeType?.toLocaleLowerCase() === 'md')
      ? rawContent
      : '```' + initCodeType + '\n' + rawContent + '\n```';

    const markdownInfo = await renderMarkdown(text, initRenderers, { html: initHtml, validateLink: initValidateLink });
    // 渲染期间内容已变化（或组件卸载），丢弃过期结果
    if (!markdownInfo || seq !== renderSeqRef.current) return;

    const newHtml = markdownInfo.info;
    if (!newHtml) return;

    const applyPatch = (retries = 0) => {
      if (seq !== renderSeqRef.current) return;
      const inner = innerDivRef.current;
      if (!inner) {
        // 首帧 hasContent 置 true 后容器可能尚未 commit 完成，下一轮重试（有上限兜底）
        if (retries < MAX_PATCH_RETRIES) {
          setTimeout(() => applyPatch(retries + 1), 0);
        }
        return;
      }

      setAnchors(markdownInfo.anchor || []);

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

      // data-* 快照：morphdom 会移除旧节点上新 HTML 中不存在的 data-* 属性，
      // 导致 JS 守卫位（如 data-click-inited / data-circleBound）丢失，
      // 同一元素每次 patch 后被重复初始化（重复绑定事件 / 重复 createRoot）。
      // patch 前记录、patch 后写回。
      const dataBackup = new WeakMap<HTMLElement, Map<string, string>>();

      morphdom(inner, wrapper, {
        childrenOnly: true,
        // 插件容器按语义 key 匹配，避免不同容器互相错配
        getNodeKey: (node) => getNodeSignature(node),
        onBeforeElUpdated(fromEl, toEl) {
          const backup = new Map<string, string>();
          for (const attr of Array.from(fromEl.attributes)) {
            if (attr.name.startsWith('data-') && !toEl.hasAttribute(attr.name)) {
              backup.set(attr.name, attr.value);
            }
          }
          if (backup.size) dataBackup.set(fromEl, backup);
          return true;
        },
        onElUpdated(fromEl) {
          const backup = dataBackup.get(fromEl);
          if (backup) {
            backup.forEach((value, name) => fromEl.setAttribute(name, value));
            dataBackup.delete(fromEl);
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
      restorePersistentNodes(inner, persistItems);
      lastContentRef.current = text;
      callbacksRef.current.onPatched?.();
    };

    applyPatch();
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
      isInitialRef.current = true;
      setHasContent(false);
      lastContentRef.current = '';
      if (innerDivRef.current) innerDivRef.current.innerHTML = '';
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
      // 组件卸载：所有在途渲染作废，清理待执行节流窗口
      renderSeqRef.current += 1;
      if (trailingTimerRef.current != null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
    };
  }, []);

  const setInnerRef = useCallback((node: HTMLDivElement | null) => {
    innerDivRef.current = node;
  }, []);

  return { anchors, hasContent, setInnerRef };
}

export default useIncrementalRender;
