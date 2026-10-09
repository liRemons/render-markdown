import React, { useEffect, useRef } from 'react';
import Viewer from 'viewerjs';
import 'viewerjs/dist/viewer.css';

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
}
