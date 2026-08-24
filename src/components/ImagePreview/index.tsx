import { createRoot, Root } from 'react-dom/client';
import Viewer from 'viewerjs';
import ImageToolbar from './ImageToolbar';
import styles from './index.module.less';

/** 记录图片操作按钮的 React Root，防止内存泄漏 */
const imageRootMap = new Map<HTMLElement, Root>();

/** 记录每个图片对应的 Viewer 实例 */
const imageViewersMap = new Map<HTMLImageElement, Viewer>();

/** 排除白名单容器内的图片 */
const excludedSelectors = ['.amap-container', 'pre'];

/** 捕获阶段拦截 excluded 容器内图片的点击，阻止 Viewer.js 处理 */
const handleCaptureClick = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.tagName !== 'IMG') return;

  const isExcluded = excludedSelectors.some(selector =>
    target.closest(selector) !== null
  );
  if (isExcluded) {
    e.stopImmediatePropagation();
  }
};

/** 容器点击事件处理函数（用于事件委托） */
const handleContainerClick = (e: Event) => {
  const target = e.target as HTMLElement;

  if (target.tagName !== 'IMG') return;

  // 检查是否在排除容器内
  const isExcluded = excludedSelectors.some(selector =>
    target.closest(selector) !== null
  );
  if (isExcluded) return;

  const viewer = imageViewersMap.get(target as HTMLImageElement);

  if (viewer) {
    viewer.show();
  }
};

/** 记录是否已添加事件委托 */
let containerClickBound = false;

/**
 * 初始化图片工具栏和预览功能
 */
export function initImageToolbars(
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  isPrintPreview?: boolean
) {
  const container = containerRef.current;
  if (!container) return;

  // 使用事件委托，在容器上统一处理图片点击
  if (!containerClickBound) {
    // 捕获阶段：拦截 excluded 容器内图片的点击，阻止 Viewer.js 处理
    container.addEventListener('click', handleCaptureClick, true);
    // 冒泡阶段：处理正常图片的预览
    container.addEventListener('click', handleContainerClick);
    containerClickBound = true;
  }

  const allImages = container.querySelectorAll('img');

  // 清除所有 img 的旧 onclick 事件，确保只通过事件委托处理点击
  allImages.forEach((img) => {
    (img as HTMLImageElement).onclick = null;
  });

  allImages.forEach((img) => {
    const imgElement = img as HTMLImageElement;

    // 如果是打印模式,跳过工具栏初始化,直接设置大图样式
    if (isPrintPreview) {
      imgElement.style.maxHeight = 'none';
      imgElement.style.width = 'auto';
      imgElement.style.display = 'block';
      return;
    }

    // 如果已经有工具栏，跳过
    if (imgElement.parentElement?.querySelector('.image-toolbar')) {
      return;
    }

    // 排除白名单容器内的图片（不创建工具栏）
    const isExcluded = excludedSelectors.some(selector =>
      imgElement.closest(selector) !== null
    );
    if (isExcluded) return;

    // 创建包裹容器
    const wrapper = document.createElement('div');
    wrapper.className = styles['image-preview-wrapper'];

    // 将图片替换为 wrapper
    imgElement.parentNode?.insertBefore(wrapper, imgElement);
    wrapper.appendChild(imgElement);

    // 创建工具栏容器
    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = styles['image-toolbar-wrapper'];

    // 将工具栏添加到 wrapper
    wrapper.appendChild(toolbarContainer);

    // 创建 React Root
    const root = createRoot(toolbarContainer);
    imageRootMap.set(toolbarContainer, root);

    // 渲染工具栏组件
    root.render(
      <ImageToolbar
        imgElement={imgElement}
        containerRef={containerRef}
        onViewerReady={(imgEl, viewer) => {
          imageViewersMap.set(imgEl, viewer);
        }}
      />
    );

    // 设置默认缩略图样式
    imgElement.style.maxHeight = '100px';
    imgElement.style.width = 'auto';
    imgElement.style.display = 'block';
    imgElement.style.overflow = 'hidden';
  });
}

/**
 * 清理所有图片工具栏和 Viewer 实例
 */
export function cleanupImageToolbars() {
  // 移除事件委托
  const container = document.querySelector('.markdown-html');
  if (container && containerClickBound) {
    container.removeEventListener('click', handleCaptureClick, true);
    container.removeEventListener('click', handleContainerClick);
    containerClickBound = false;
  }

  // 卸载图片工具栏 React Root
  imageRootMap.forEach((root, toolbarContainer) => {
    root.unmount();
    toolbarContainer.remove();
  });
  imageRootMap.clear();

  // 清理所有 Viewer 实例
  imageViewersMap.forEach((viewer) => {
    viewer.destroy();
  });
  imageViewersMap.clear();
}
