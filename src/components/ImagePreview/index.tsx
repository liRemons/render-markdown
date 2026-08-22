import { createRoot, Root } from 'react-dom/client';
import Viewer from 'viewerjs';
import ImageToolbar from './ImageToolbar';
import styles from './index.module.less';

/** 记录图片操作按钮的 React Root，防止内存泄漏 */
const imageRootMap = new Map<HTMLElement, Root>();

/** 记录每个图片对应的 Viewer 实例 */
const imageViewersMap = new Map<HTMLImageElement, Viewer>();

/**
 * 初始化图片工具栏和预览功能
 */
export function initImageToolbars(
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  isPrintPreview?: boolean
) {
  // 排除 pre 标签内的图片(代码块中的装饰性图片)
  const images = document.querySelectorAll('.markdown-html :not(pre) > img');
  
  images.forEach((img) => {
    const imgElement = img as HTMLImageElement;
    
    // 如果是打印模式,跳过工具栏初始化,直接设置大图样式
    if (isPrintPreview) {
      imgElement.style.maxHeight = 'none';
      imgElement.style.width = 'auto';
      imgElement.style.display = 'block';
      return; // 不创建工具栏
    }
    
    // 如果已经有工具栏，跳过
    if (imgElement.parentElement?.querySelector('.image-toolbar')) {
      return;
    }

    // 为图片添加点击事件
    imgElement.style.cursor = 'pointer';
    imgElement.onclick = () => {
      const viewer = imageViewersMap.get(imgElement);
      if (viewer) {
        viewer.show();
      }
    };
    
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
