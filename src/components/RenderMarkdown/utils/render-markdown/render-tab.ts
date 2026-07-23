/**
 * 初始化 Tab 逻辑
 * 使用递归思想：只处理当前容器下的直接子元素，互不干扰
 */

export const tabsName = 'markdown-tabs';

function listenScroll() {
  const parentElement = document.querySelector('.markdown');

  parentElement?.addEventListener('wheel', (e: Event) => {
    const wheelEvent = e as WheelEvent;
    // 获取触发事件的子元素
    const target = e.target as HTMLElement;

    // 检查目标元素是否是需要横向滚动的子元素
    // 使用 .closest() 可以兼容事件冒泡到子元素内部的情况
    const scrollableChild = target?.closest(`.${tabsName}-tabs-header`) as HTMLElement | null;

    // 1. 如果没有找到目标子元素，或者没有垂直滚动量，直接放行
    if (!scrollableChild || Math.abs(wheelEvent.deltaY) === 0) {
      return;
    }

    // 2. 关键修复：检查子元素是否真的可以横向滚动
    // scrollWidth > clientWidth 表示内容溢出，存在横向滚动空间
    const canScrollHorizontally = scrollableChild.scrollWidth > scrollableChild.clientWidth;

    if (!canScrollHorizontally) {
      // 如果无法横向滚动，则不阻止默认行为，让浏览器正常处理垂直滚动
      return;
    }

    // 3. 只有当子元素确实可以横向滚动时，才阻止默认行为并执行横向滚动
    e.preventDefault();
    scrollableChild.scrollLeft += wheelEvent.deltaY;
  }, { passive: false });
}


function addMask() {
  // 获取滚动容器
  const parentElement = document.querySelector('.markdown');

  // 1. 封装一个处理单个滚动元素的函数
  function initScrollMask(scrollEl: HTMLElement) {
    // 防止重复初始化
    if (scrollEl.dataset.maskInited) return;
    scrollEl.parentElement!.dataset.maskInited = 'true';

    const updateMaskState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollEl;

      const hasLeft = scrollLeft > 1;
      const hasRight = scrollLeft + clientWidth < scrollWidth - 1;

      // 清除所有状态类
      scrollEl.parentElement!.classList.remove('has-left-mask', 'has-right-mask', 'has-both-masks');

      // 根据条件添加对应的状态类
      if (hasLeft && hasRight) {
        scrollEl.parentElement!.classList.add('has-both-masks');
      } else if (hasLeft) {
        scrollEl.parentElement!.classList.add('has-left-mask');
      } else if (hasRight) {
        scrollEl.parentElement!.classList.add('has-right-mask');
      }
    };

    // 绑定滚动事件
    scrollEl.addEventListener('scroll', updateMaskState);

    // 初始执行一次
    updateMaskState();
  }

  // 2. 初始化页面中已存在的滚动元素
  document.querySelectorAll('.markdown-tabs-tabs-header').forEach(el => initScrollMask(el as HTMLElement));

  // 3. 使用 MutationObserver 监听 DOM 变化
  // 这样即使后续通过 JS 动态插入了新的 .scroll-content，也能自动绑定蒙层逻辑
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return; // 忽略文本节点
        const element = node as HTMLElement;

        // 如果新增的节点本身就是 .markdown-tabs-tabs-header
        if (element.classList.contains('markdown-tabs-tabs-header')) {
          initScrollMask(element);
        }
        // 如果新增的节点内部包含了 .markdown-tabs-tabs-header
        element.querySelectorAll('.markdown-tabs-tabs-header').forEach(el => initScrollMask(el as HTMLElement));
      });
    });
  });

  observer.observe(parentElement!, { childList: true, subtree: true });

  // 4. 窗口大小改变时，重新计算所有滚动元素的蒙层状态
  window.addEventListener('resize', () => {
    document.querySelectorAll('.markdown-tabs-tabs-header').forEach(el => {
      el.dispatchEvent(new Event('scroll'));
    });
  });

}

function renderTab() {
  // 获取页面上所有的 Tab 组容器
  const wrappers = document.querySelectorAll(`.${tabsName}-tabs-wrapper`);

  wrappers.forEach(wrapper => {
    const header = wrapper.querySelector(`.${tabsName}-tabs-header`);
    const contents = wrapper.querySelector(`.${tabsName}-tabs-container`);

    if (!header || !contents) return;

    // 获取该组内的所有内容块（只需获取一次，无需在每次点击时重复查询）
    const panels = contents.querySelectorAll(`.${tabsName}-tab-content`);
    const markdown = document.querySelector('.markdown')
    // 将点击事件绑定在 header 上（事件委托）
    header.addEventListener('click', (e) => {
      // 1. 判断点击的是否为 Tab 按钮（防止点到 header 的其他空白区域）
      const target = e.target as HTMLElement;
      const item = target.closest(`.${tabsName}-tab-button`) as HTMLElement | null;
      if (!item || !header.contains(item)) return;

      // 2. 获取当前点击按钮的索引
      const items = header.querySelectorAll(`.${tabsName}-tab-button`);
      const index = Array.from(items).indexOf(item as HTMLElement);

      // 3. 移除该组内所有按钮和内容块的 active 类
      items.forEach(i => i.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));


      item.classList.add('active');
      if (panels[index]) {
        panels[index].classList.add('active');
      }
      // 4. 激活当前点击的按钮和对应的内容块
      const parent = item.offsetParent as HTMLElement | null;
      if (parent && markdown?.scrollTop && parent.offsetTop && markdown?.scrollTop > parent.offsetTop) {
        markdown?.scrollTo({
          top: parent.offsetTop,
          behavior: 'smooth'
        })
      }
    });
  });

  listenScroll();
  addMask();
}

export default renderTab;