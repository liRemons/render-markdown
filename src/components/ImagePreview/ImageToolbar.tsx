import React, { useEffect, useRef, useState } from 'react';
import { ZoomInOutlined, ZoomOutOutlined, EyeOutlined } from '@ant-design/icons';
import Viewer from 'viewerjs';
import 'viewerjs/dist/viewer.css';
import styles from './index.module.less';

interface ImageToolbarProps {
  imgElement: HTMLImageElement;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  onViewerReady: (imgElement: HTMLImageElement, viewer: Viewer) => void;
}

export default function ImageToolbar({
  imgElement,
  containerRef,
  onViewerReady
}: ImageToolbarProps) {
  const [isThumbnail, setIsThumbnail] = useState(true);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    // 初始化 Viewer.js
    if (containerRef.current) {
      const viewer = new Viewer(containerRef.current, {
        toolbar: true,
        navbar: true,
        title: false,
        tooltip: true,
        zoomable: true,
        rotatable: false,
        scalable: false,
        transition: true,
        fullscreen: true,
        keyboard: true,
      });
      viewerRef.current = viewer;

      // 通知父组件 viewer 已就绪
      onViewerReady(imgElement, viewer);
    }

    return () => {
      // 清理 Viewer 实例
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  const handleToggleClick = () => {
    if (isThumbnail) {
      // 切换到大图
      setIsThumbnail(false);
      imgElement.style.maxHeight = 'none';
      imgElement.style.height = 'auto';
    } else {
      // 切换到缩略图
      setIsThumbnail(true);
      imgElement.style.maxHeight = '100px';
      imgElement.style.height = 'auto';
    }
  };

  const handlePreviewClick = () => {
    if (viewerRef.current && containerRef.current) {
      // 找到当前图片在容器中的索引，确保预览打开的是当前图片
      const allImages = containerRef.current.querySelectorAll('img');
      const index = Array.from(allImages).indexOf(imgElement);
      if (index >= 0) {
        viewerRef.current.view(index);
      }
      viewerRef.current.show();
    }
  };

  return (
    <div className={styles['image-toolbar-wrapper']}>
      {/* 切换按钮 */}
      <span
        className={`${styles['image-toolbar-btn']} remons-markdown-circle`}
        onClick={handleToggleClick}
        title={isThumbnail ? '查看大图' : '查看缩略图'}
      >
        {isThumbnail ? <ZoomInOutlined /> : <ZoomOutOutlined />}
      </span>

      {/* 预览按钮 */}
      <span
        className={`${styles['image-toolbar-btn']} remons-markdown-circle`}
        onClick={handlePreviewClick}
        title="预览"
      >
        <EyeOutlined />
      </span>
    </div>
  );
}
