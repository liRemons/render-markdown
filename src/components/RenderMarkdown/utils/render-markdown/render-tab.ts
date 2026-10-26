/**
 * 初始化 Tab 逻辑
 * 交互统一挂在 document 上做事件委托：天然覆盖所有 RenderMarkdown 实例，
 * 多实例不再互相抢占第一个 .markdown 容器；增量渲染重建 DOM 后也无需重绑。
 */

export const tabsName = 'markdown-tabs';

const HEADER_SELECTOR = `.${tabsName}-tabs-header`;

/** 全局委托只注册一次 */
let delegationInited = false;

/** 切换 tab：实时查询内容块（增量渲染增删 tab 后，缓存的 NodeList 索引会错位） */
function activateTab(item: HTMLElement, header: HTMLElement, contents: Element) {
  const items = header.querySelectorAll(`.${tabsName}-tab-button`);
  const index = Array.from(items).indexOf(item);

  const panels = contents.querySelectorAll(`.${tabsName}-tab-content`);
  items.forEach(i => i.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));

  item.classList.add('active');
  if (panels[index]) {
    panels[index].classList.add('active');
  }

  // 若所在 .markdown 容器已滚过该 tab 组，回滚到 tab 组顶部
  const container = item.closest('.markdown');
  const parent = item.offsetParent as HTMLElement | null;
  if (container && parent && container.scrollTop > parent.offsetTop) {
    container.scrollTo({ top: parent.offsetTop, behavior: 'smooth' });
  }
}

/** tab 按钮点击（document 冒泡委托） */
const handleClick = (e: Event) => {
  const target = e.target as HTMLElement | null;
  const item = target?.closest(`.${tabsName}-tab-button`) as HTMLElement | null;
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
