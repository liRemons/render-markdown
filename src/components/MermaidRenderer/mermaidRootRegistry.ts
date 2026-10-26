import type { Root } from 'react-dom/client';
import { MERMAID_ROOT_CLASS, MERMAID_SRC_ATTR } from '@/utils/dom-contract';

/**
 * Mermaid 图表 React Root 注册表（独立轻量子模块）：
 * 只依赖类型，不引入任何组件，供 RenderMarkdown 侧安全静态导入，
 * 不会破坏 MermaidRenderer 的懒加载分包。
 */
const mermaidRoots = new Map<Element, Root[]>();

/** 注册一个挂载点与其 React Root */
export function registerMermaidRoot(el: Element, root: Root) {
  const list = mermaidRoots.get(el);
  if (list) list.push(root);
  else mermaidRoots.set(el, [root]);
}

/** 卸载并清空指定元素上挂载过的图表 root */
export function unmountMermaidRootsAt(el: Element) {
  const roots = mermaidRoots.get(el);
  if (!roots) return;
  roots.forEach((root) => {
    try {
      root.unmount();
    } catch { /* 已卸载 */ }
  });
  mermaidRoots.delete(el);
}

/** 取挂载点上的 React Root：源码变化时用它原地更新 props，避免卸载重建 */
export function getMermaidRoot(el: Element): Root | undefined {
  return mermaidRoots.get(el)?.[0];
}

/**
 * 回收已脱离文档的挂载点。
 * 非增量模式整块重建、内容为空时 React 直接移除子树，这些节点
 * 不在任何作用域内、扫描再也找不到，不主动回收就是永久泄漏的 Root。
 */
export function pruneDetachedMermaidRoots() {
  mermaidRoots.forEach((_roots, el) => {
    if (!el.isConnected) unmountMermaidRootsAt(el);
  });
}

/**
 * 源码指纹（FNV-1a 32 位 + 长度）：用于判断图表源码是否真的变了。
 * 长度入摘要以降低碰撞概率；只用于“是否相等”判定，不用于还原源码。
 */
export function hashMermaidSource(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(36)}-${text.length.toString(36)}`;
}

/** 是否由扫描挂载的图表节点（兼作锚点定位与孤儿回收的判据） */
export function isMermaidChartRoot(el: Element | null | undefined): el is HTMLElement {
  return !!el && el.classList.contains(MERMAID_ROOT_CLASS) && el.hasAttribute(MERMAID_SRC_ATTR);
}

/**
 * 回收某棵子树内所有图表 root 并移除挂载点节点。
 * 组件卸载 / 增量 diff 丢弃节点时调用，防止 React Root 泄漏。
 */
export function cleanupMermaidRoots(scope: ParentNode | null) {
  if (!scope) return;
  if (scope.nodeType === 1 && (scope as Element).classList?.contains(MERMAID_ROOT_CLASS)) {
    unmountMermaidRootsAt(scope as Element);
    (scope as Element).remove();
    return;
  }
  scope.querySelectorAll(`.${MERMAID_ROOT_CLASS}`).forEach((el) => {
    unmountMermaidRootsAt(el);
    el.remove();
  });
}
