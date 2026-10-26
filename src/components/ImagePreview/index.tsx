import PhotoSwipe from 'photoswipe';
import type { SlideData } from 'photoswipe';
import { MERMAID_ROOT_CLASS } from '@/utils/dom-contract';
import 'photoswipe/style.css';
import './index.global.less';

/**
 * 图片预览（PhotoSwipe v5 实现，替换早期的 viewerjs）
 *
 * 换掉 viewerjs 的原因：
 * - 缩放按固定档位跳（滚轮不看 deltaY 幅度），松手还带 transition 回弹，主观就是"不跟手"；
 * - 触屏无惯性、无下滑关闭、双击放大要靠模拟 dblclick（数百毫秒判定），移动端只能算能用。
 * PhotoSwipe 以 Pointer Events + 指针/手指位置为锚点做连续缩放，拖拽有惯性，
 * 双指外划与竖向拖拽可关闭，UI 按钮命中区 50x60，桌面与移动一套代码。
 *
 * 每个渲染容器一份预览状态：
 * - 预览实例按点击创建、关闭即销毁（PhotoSwipe 关闭动画结束后自行 destroy），
 *   因此不再存在"实例内部图片列表过期"的问题，增量渲染重建 <img> 也无需通知谁；
 * - 容器只保留一份过滤后的图片列表与点击委托，绑定在容器自身，随容器销毁自然消失。
 */
interface PreviewState {
  /** 可预览图片（已按排除名单过滤），顺序即画廊顺序 */
  images: HTMLImageElement[];
  bound: boolean;
  /**
   * 实例级排除名单：每次渲染刷新。
   * 旧实现把它闭包在首次绑定的监听里，excludedSelectors prop 后续变更不生效。
   */
  instanceSelectors: string[];
  /** 当前打开的预览，容器卸载时用于强制关闭遮罩 */
  active: PhotoSwipe | null;
}

const stateMap = new WeakMap<HTMLDivElement, PreviewState>();

/**
 * 模块级排除名单初始值；实例级排除通过 excludedSelectors prop 传入
 * - `pre`：代码块里作为源码展示的图，不是插图
 * - `.mermaid-react-root`：图表挂载点里的装饰图（如标题行的 mermaid 图标）。
 *   它们是 UI 控件而不是文档插图，点它们应该去操作图表，不能弹出一个全屏预览
 * 名单只在「是否进预览」这一层生效，不影响这些图片自身的点击事件派发
 */
const excludedSelectors: string[] = ['pre', `.${MERMAID_ROOT_CLASS}`];

/**
 * 向图片预览全局排除名单中添加选择器
 * 外部自定义渲染器若包含图片，需调用此方法避免与本库预览冲突
 * @param selectors - CSS 选择器或选择器数组，如 '.copy-password-container' 或 ['.a', '.b']
 */
export function addExcludedSelector(selectors: string | string[]) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  list.forEach((selector) => {
    if (!excludedSelectors.includes(selector)) {
      excludedSelectors.push(selector);
    }
  });
}

/** 从全局排除名单移除选择器（与 addExcludedSelector 配对，支持撤销） */
export function removeExcludedSelector(selectors: string | string[]) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  list.forEach((selector) => {
    const i = excludedSelectors.indexOf(selector);
    if (i >= 0) excludedSelectors.splice(i, 1);
  });
}

/** 图片是否位于排除容器内（实例名单 + 全局名单） */
const isExcludedImage = (img: HTMLImageElement, instanceSelectors: string[]): boolean =>
  instanceSelectors.some(selector => img.closest(selector) !== null) ||
  excludedSelectors.some(selector => img.closest(selector) !== null);

/** 该容器是否已绑定过事件（绑定在容器自身，随容器卸载自然消失） */
const INSTANCE_KEY = 'mdImgBound';

/**
 * 把容器内的 <img> 转成 PhotoSwipe 的 slide 数据
 * - msrc 用当前已渲染的缩略图源，打开瞬间就有画面，再换成大图
 * - element 供 PhotoSwipe 计算缩略图位置，做出「从文档里飞出来」的开场动画；
 *   增量渲染可能已经把这个 <img> 换掉，脱离文档的节点不能当锚点
 * - 图片尚未加载完时不传 width/height：0 尺寸会让 fit/fill 缩放级别算出异常值，
 *   留空则由 PhotoSwipe 在加载完成后自行测量
 * - srcset 只认带 w/h 描述符的候选项，markdown 里常见的 "1x, 2x" 会被误判，直接忽略
 */
function toSlideData(img: HTMLImageElement): SlideData {
  const src = img.currentSrc || img.src;
  const data: SlideData = {
    src,
    msrc: src,
    alt: img.alt || undefined,
    element: img.isConnected ? img : undefined,
  };
  if (img.naturalWidth && img.naturalHeight) {
    data.width = img.naturalWidth;
    data.height = img.naturalHeight;
  }
  const srcset = img.getAttribute('srcset') || '';
  if (/\d+w/.test(srcset)) data.srcset = srcset;
  return data;
}

/**
 * 预览打开期间锁住正文滚动：PhotoSwipe v5 是挂在 body 上的 fixed 遮罩（非 <dialog> 模态），
 * 自身不锁滚动。不锁的后果：移动端遮罩背后仍能橡皮筋滚动/触发下拉刷新，
 * 以及关闭动画期间正文滚走了、缩略图锚点错位。
 * 用引用计数兼容极端情况（多个容器同时打开）。
 */
let lockDepth = 0;
let lockedOverflow: string | null = null;

function lockPageScroll() {
  if (typeof document === 'undefined') return;
  lockDepth += 1;
  if (lockDepth > 1) return;
  const root = document.documentElement;
  lockedOverflow = root.style.overflow;
  root.style.overflow = 'hidden';
}

function unlockPageScroll() {
  lockDepth = Math.max(0, lockDepth - 1);
  if (lockDepth > 0 || lockedOverflow === null) return;
  document.documentElement.style.overflow = lockedOverflow;
  lockedOverflow = null;
}

/**
 * 缩放下限。PhotoSwipe 的 min = min(fit, initial, secondary)，而它的 fit = `Math.min(1, 视口/图片)`，
 * 两个后果：图片不比视口大时 100% 就是最小值、完全缩不下去；图片比视口大时最小也只到「长边贴屏边」。
 * 官方没有 minZoomLevel 选项，但 `slide.zoomLevels.min` 是公开字段，只被手势结束时的
 * correctZoomPan 与平移边界读取，这里把下限放到 fit 的一半，让「缩小到看清整张图」做得成
 * （缩到小于视口后走的本来就是「图片比视口小」那条既有分支：居中、不可平移）。
 * 要恢复官方行为，把下面的系数改成 1 即可。
 */
const MIN_ZOOM_FACTOR_OF_FIT = 0.5;

/** 打开某张图片对应的画廊 */
function openPreview(state: PreviewState, img: HTMLImageElement) {
  // 已有遮罩未关（连点、外部再次触发）时不叠第二层
  if (state.active) return;
  const index = state.images.indexOf(img);
  if (index < 0) return;

  const pswp = new PhotoSwipe({
    dataSource: state.images.map(toSlideData),
    index,
    // 遮罩颜色不走这里（始终用 bgOpacity=1 做开/关的透明度动画），
    // 具体黑度由 index.global.less 里的 --pswp-bg 控制（半透明 + 毛玻璃，跟主题）
    bgOpacity: 1,
    // 缩放级必须显式配置：PhotoSwipe 的 secondaryZoomLevel / maxZoomLevel 默认都是 'fill'
    // （短边铺满视口），于是双击放大一到就碰上限、再滚轮也纹丝不动，大图看起来“撑开全屏”；
    // 小图更糟：fit 与 fill 都被 100% 封顶，直接被判为不可缩放（放大按钮都不出现）。
    // 这里固定为：初始适配视口 → 双击到原始像素 → 可继续放大到 2 倍原始像素。
    initialZoomLevel: 'fit',
    secondaryZoomLevel: 1,
    maxZoomLevel: 2,
    // 图不紧贴视口边缘，也给顶部工具条留出视觉空间
    padding: { top: 24, bottom: 24, left: 24, right: 24 },
    // 有缩略图节点就走位移动画，拿不到（脱离文档/未连接）时 PhotoSwipe 自动退化为淡入
    showHideAnimationType: 'zoom',
    preload: [1, 2],
    loop: false,
    // 与旧实现一致：滚轮用于缩放而非翻图（多图切换交给箭头/滑动/键盘）
    wheelToZoom: true,
    imageClickAction: 'zoom-or-close',
    bgClickAction: 'close',
    // 触屏单击只收起工具条，避免误触关闭；双击按 secondaryZoomLevel 放大到原始像素
    tapAction: 'toggle-controls',
    doubleTapAction: 'zoom',
    // 移动端两个原生相册式关闭手势
    pinchToClose: true,
    closeOnVerticalDrag: true,
    clickToCloseNonZoomable: true,
    escKey: true,
    arrowKeys: true,
    trapFocus: true,
    returnFocus: true,
    mainClass: 'md-image-preview',
    errorMsg: '图片加载失败',
    closeTitle: '关闭',
    zoomTitle: '放大 / 缩小',
    arrowPrevTitle: '上一张',
    arrowNextTitle: '下一张',
    counterTitle: '当前图片序号',
  });

  state.active = pswp;
  let released = false;
  let detachMinZoom = () => {};
  const releaseScrollLock = () => {
    if (released) return;
    released = true;
    unlockPageScroll();
    detachMinZoom();
  };
  // close 与 destroy 都可能先行结束（Esc 关闭 / 容器卸载强制销毁），取幂等的那个
  pswp.on('close', releaseScrollLock);
  // PhotoSwipe 在关闭动画结束后自行 destroy 并解绑，这里只回收引用
  pswp.on('destroy', () => {
    releaseScrollLock();
    if (state.active === pswp) state.active = null;
  });
  // init 返回 false 表示根本没打开（如 slide 数为 0），必须回收引用，
  // 否则本容器的 state.active 永久占位，之后所有图片点击都失效
  if (pswp.init() === false) {
    state.active = null;
    return;
  }
  lockPageScroll();

  // 放宽缩放下限：切换图片、图片加载完拿到真实尺寸（我们拿不到 naturalWidth 时不传宽高）、
  // 以及窗口尺寸变化重算缩放级后，都得重新压一次；这些重算只会把 min 写回更高的值，
  // 所以重复调用是幂等的。resize 时 PhotoSwipe 自己先绑先跑，我们后跑覆盖回来。
  const relaxMinZoom = () => {
    const zoomLevels = pswp.currSlide?.zoomLevels;
    if (!zoomLevels || !zoomLevels.fit) return;
    zoomLevels.min = Math.min(zoomLevels.min, zoomLevels.fit * MIN_ZOOM_FACTOR_OF_FIT);
  };
  pswp.on('change', relaxMinZoom);
  pswp.on('loadComplete', relaxMinZoom);
  window.addEventListener('resize', relaxMinZoom);
  relaxMinZoom();
  detachMinZoom = () => window.removeEventListener('resize', relaxMinZoom);
}

/**
 * 初始化图片预览：绑定容器内的图片点击委托，并刷新可预览列表
 * @param container - 渲染容器（.markdown-html），只处理其内部图片
 * @param options.instanceSelectors - 实例级排除名单（excludedSelectors prop）
 * @param options.isPrintPreview - 打印模式：跳过交互，仅展开图片样式
 */
export function initImageToolbars(
  container: HTMLDivElement | null,
  options: { instanceSelectors?: string[]; isPrintPreview?: boolean } = {}
) {
  if (!container) return;
  const { instanceSelectors = [], isPrintPreview = false } = options;

  const allImages = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];

  // 打印模式：不建交互，直接展开图片
  if (isPrintPreview) {
    allImages.forEach((img) => {
      img.style.maxHeight = 'none';
      img.style.width = 'auto';
      img.style.display = 'block';
    });
    return;
  }

  let state = stateMap.get(container);
  if (!state) {
    state = { images: [], bound: false, instanceSelectors, active: null };
    stateMap.set(container, state);
  } else {
    // prop 可能在后续渲染中变化，实时读取
    state.instanceSelectors = instanceSelectors;
  }

  // 排除名单每次渲染重新判定；图片列表顺序跟随文档流
  state.images = allImages.filter((img) => !isExcludedImage(img, instanceSelectors));

  if (!state.bound) {
    state.bound = true;
    container.setAttribute(INSTANCE_KEY, '1');
    // 只绑一条冒泡阶段的委托：排除名单直接在本监听的判断里生效，不需要额外的捕获阶段拦截。
    // 早期版本在捕获阶段对排除容器内的图片调 stopImmediatePropagation()：预览本来就不会为它
    // 打开（下面的判断已经拦住），这一拦却会把后续所有监听者一起停掉 —— 包括 React 绑在
    // 图表挂载点上的事件委托，相当于把图表内部的图片点击交互弄失效
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== 'IMG') return;
      const img = target as HTMLImageElement;
      const current = stateMap.get(container);
      if (!current || isExcludedImage(img, current.instanceSelectors)) return;
      openPreview(current, img);
    });
  }
}

/**
 * 销毁指定容器的预览状态（容器卸载/隐藏前调用）
 * 遮罩是挂在 body 上的独立节点，不属于容器子树，必须显式关掉
 */
export function cleanupImageToolbars(container?: HTMLElement | null) {
  if (!container) {
    // 兼容旧调用：无参时不做全局清理（WeakMap 无法遍历），由容器卸载钩子负责
    return;
  }
  const key = container as HTMLDivElement;
  const state = stateMap.get(key);
  if (!state) return;
  if (state.active) {
    // destroy 立即关闭：解绑事件 + 从 DOM 移除遮罩（同时触发上面的滚动锁回收）
    state.active.destroy();
    state.active = null;
  }
  state.images = [];
  stateMap.delete(key);
}
