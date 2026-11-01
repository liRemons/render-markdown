/**
 * 初始化 Tab 逻辑
 * 交互统一挂在 document 上做事件委托：天然覆盖所有 RenderMarkdown 实例，
 * 多实例不再互相抢占第一个 .markdown 容器；增量渲染重建 DOM 后也无需重绑。
 */

export const tabsName = 'markdown-tabs';

const HEADER_SELECTOR = `.${tabsName}-tabs-header`;
const WRAPPER_SELECTOR = `.${tabsName}-tabs-wrapper`;
const BUTTON_SELECTOR = `.${tabsName}-tab-button`;
const PANEL_SELECTOR = `.${tabsName}-tab-content`;

/**
 * 用户点选的 tab 状态（写在 wrapper 的 data-* 上，增量 patch 会被保留）：
 * - data-md-user-active：点选的下标
 * - data-md-src-active：点选那一刻【源码声明】的激活下标（源码里 @tab:active 那项）
 * - data-md-tabs-count：点选时该组的 tab 总数
 * 三个值合起来才能区分「用户点了别的 tab」与「用户改了源码的 :active」：
 * 后者必须让源码接管（否则用户在源码里换激活项永远看不到效果），
 * 前者才需要跨 patch 还原；tab 总数变化说明结构被动过，按下标配的旧选择已指向别的标签，
 * 一并放弃还原。
 */
const USER_ACTIVE_ATTR = 'data-md-user-active';
const SRC_ACTIVE_ATTR = 'data-md-src-active';
const TABS_COUNT_ATTR = 'data-md-tabs-count';

/** 全局委托只注册一次 */
let delegationInited = false;

/** 按钮下标：优先插件写入的 data-tab（与源码顺序一致），回退 DOM 序 */
const buttonIndex = (item: HTMLElement, header: HTMLElement): number => {
  const raw = item.getAttribute('data-tab');
  if (raw !== null && /^\d+$/.test(raw)) return Number(raw);
  return Array.from(header.querySelectorAll(BUTTON_SELECTOR)).indexOf(item);
};

/** 源码声明的激活下标：[data-active] 只出现在生成的 HTML 里，每次 patch 由 morphdom 同步 */
const getSourceActiveIndex = (wrapper: HTMLElement): number => {
  const header = wrapper.querySelector<HTMLElement>(HEADER_SELECTOR);
  if (!header) return -1;
  const btn = header.querySelector(`${BUTTON_SELECTOR}[data-active]`) as HTMLElement | null;
  return btn ? buttonIndex(btn, header) : -1;
};

/** 只切换激活 class，不做滚动（点击与 patch 后还原共用） */
function applyActive(index: number, header: HTMLElement, contents: Element) {
  const items = header.querySelectorAll(BUTTON_SELECTOR);
  const panels = contents.querySelectorAll(PANEL_SELECTOR);
  items.forEach((i) => i.classList.remove('active'));
  panels.forEach((p) => p.classList.remove('active'));

  const item = items[index] as HTMLElement | undefined;
  if (!item) return;
  item.classList.add('active');
  // 面板优先按 data-index 定位：与按钮下标同源，增删面板时不会错位
  const panel =
    (contents.querySelector(`${PANEL_SELECTOR}[data-index="${index}"]`) as HTMLElement | null) ??
    (panels[index] as HTMLElement | undefined);
  if (panel) panel.classList.add('active');
}

/** 切换 tab */
function activateTab(item: HTMLElement, header: HTMLElement, contents: Element) {
  const index = buttonIndex(item, header);
  applyActive(index, header, contents);

  // 记录用户选择，供增量 patch 覆写 class 后还原
  const wrapper = item.closest(WRAPPER_SELECTOR) as HTMLElement | null;
  if (wrapper) {
    wrapper.setAttribute(USER_ACTIVE_ATTR, String(index));
    wrapper.setAttribute(SRC_ACTIVE_ATTR, String(getSourceActiveIndex(wrapper)));
    wrapper.setAttribute(TABS_COUNT_ATTR, String(header.querySelectorAll(BUTTON_SELECTOR).length));
  }

  // 若所在 .markdown 容器已滚过该 tab 组，回滚到 tab 组顶部
  const container = item.closest('.markdown');
  const parent = item.offsetParent as HTMLElement | null;
  if (container && parent && container.scrollTop > parent.offsetTop) {
    container.scrollTo({ top: parent.offsetTop, behavior: 'smooth' });
  }
}

/**
 * 增量 patch 后还原用户点选的 tab。
 * morphdom 会用新 HTML 的 class 整体覆写按钮与面板，未列入保留名单的 active 会被擦掉，
 * 表现为「输入一个字，选中的 tab 就跳回第一个」。
 * 由 RenderMarkdown 在 patch 完成后同步调用（renderTab 的微任务在 patch 之前执行，管不到）。
 */
export function syncTabState(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>(WRAPPER_SELECTOR).forEach((wrapper) => {
    const user = wrapper.getAttribute(USER_ACTIVE_ATTR);
    if (user === null || !/^\d+$/.test(user)) return;

    const header = wrapper.querySelector<HTMLElement>(HEADER_SELECTOR);
    const contents = wrapper.querySelector(`.${tabsName}-tabs-container`);
    if (!header || !contents) return;

    const release = () => {
      wrapper.removeAttribute(USER_ACTIVE_ATTR);
      wrapper.removeAttribute(SRC_ACTIVE_ATTR);
      wrapper.removeAttribute(TABS_COUNT_ATTR);
    };

    // 源码里 @tab:active 变了：用户这次编辑就是要换激活项，让源码接管
    if (Number(wrapper.getAttribute(SRC_ACTIVE_ATTR)) !== getSourceActiveIndex(wrapper)) {
      release();
      return;
    }
    // 结构变了（增删 tab）：下标已指向别的标签，不做还原
    if (Number(wrapper.getAttribute(TABS_COUNT_ATTR)) !== header.querySelectorAll(BUTTON_SELECTOR).length) {
      release();
      return;
    }

    const index = Number(user);
    if (!header.querySelectorAll(BUTTON_SELECTOR)[index]) return;
    const active = header.querySelector(`${BUTTON_SELECTOR}.active`) as HTMLElement | null;
    // 新 HTML 已经把该项标为激活（或一个都没激活时交由源码态）则无需干预
    if (!active || buttonIndex(active, header) === index) return;
    applyActive(index, header, contents);
  });
}

/** tab 按钮点击（document 冒泡委托） */
const handleClick = (e: Event) => {
  const target = e.target as HTMLElement | null;
  const item = target?.closest(BUTTON_SELECTOR) as HTMLElement | null;
  if (!item) return;
  const header = item.closest(HEADER_SELECTOR) as HTMLElement | null;
  if (!header) return;
  const wrapper = header.closest(`.${tabsName}-tabs-wrapper`);
  const contents = wrapper?.querySelector(`.${tabsName}-tabs-container`);
  if (!contents) return;
  activateTab(item, header, contents);
};

/** 纵向滚轮转横向滚动（document 捕获委托，仅处理可横向滚动的 tab header） */
const handleWheel = (e: WheelEvent) => {
  const header = (e.target as HTMLElement | null)?.closest(HEADER_SELECTOR) as HTMLElement | null;
  if (!header || Math.abs(e.deltaY) === 0) return;
  // 内容未溢出时放行，让浏览器正常处理垂直滚动
  if (header.scrollWidth <= header.clientWidth) return;
  e.preventDefault();
  header.scrollLeft += e.deltaY;
};

/**
 * 为单个滚动 header 绑定渐隐蒙层。
 * 修复：守卫位必须写在 scrollEl 自身（旧版写在 parentElement 导致守卫永不命中、
 * 每次 renderTab 都重复叠加 scroll 监听器）。
 */
function initScrollMask(scrollEl: HTMLElement) {
  if (scrollEl.dataset.maskInited) return;
  scrollEl.dataset.maskInited = '1';
  const host = scrollEl.parentElement;
  if (!host) return;

  const updateMaskState = () => {
    const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
    const hasLeft = scrollLeft > 1;
    const hasRight = scrollLeft + clientWidth < scrollWidth - 1;

    host.classList.remove('has-left-mask', 'has-right-mask', 'has-both-masks');

    if (hasLeft && hasRight) {
      host.classList.add('has-both-masks');
    } else if (hasLeft) {
      host.classList.add('has-left-mask');
    } else if (hasRight) {
      host.classList.add('has-right-mask');
    }
  };

  scrollEl.addEventListener('scroll', updateMaskState);
  updateMaskState();
}

/** 自愈式 observer：监听 body 新增节点，为动态插入的 tab header 补挂蒙层（已挂载的跳过） */
let observerStarted = false;

function ensureMaskObserver() {
  if (observerStarted || typeof MutationObserver === 'undefined') return;
  observerStarted = true;
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const element = node as HTMLElement;
        if (element.classList.contains(`${tabsName}-tabs-header`)) {
          initScrollMask(element);
        }
        element.querySelectorAll(HEADER_SELECTOR).forEach(el => initScrollMask(el as HTMLElement));
      });
    });
  });
  // observer 挂到 body 后不受任何 .markdown 容器重建影响，无需重复创建
  observer.observe(document.body, { childList: true, subtree: true });
}

/** 窗口尺寸变化时重算所有 header 的蒙层状态（只注册一次） */
let resizeBound = false;

function ensureResizeHandler() {
  if (resizeBound) return;
  resizeBound = true;
  window.addEventListener('resize', () => {
    document.querySelectorAll<HTMLElement>(HEADER_SELECTOR).forEach(el => {
      el.dispatchEvent(new Event('scroll'));
    });
  });
}

function renderTab() {
  if (!delegationInited) {
    delegationInited = true;
    document.addEventListener('click', handleClick);
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
  }

  // 已存在的 header 直接初始化（observer 只覆盖"之后新增"的节点）
  document.querySelectorAll<HTMLElement>(HEADER_SELECTOR).forEach(el => initScrollMask(el));

  ensureMaskObserver();
  ensureResizeHandler();
}

export default renderTab;
