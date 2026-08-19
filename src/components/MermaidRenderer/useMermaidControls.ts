import { useState, useEffect, useCallback, RefObject } from "react";

interface UseMermaidControlsParams {
  showCollapse: boolean;
  showSourceView: boolean;
  defaultCollapsed: boolean;
  isPrintPreview: boolean;
  svg: string;
  error: string;
  loading: boolean;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

export default function useMermaidControls({
  showCollapse,
  showSourceView,
  defaultCollapsed,
  isPrintPreview,
  svg,
  error,
  loading,
  wrapperRef,
}: UseMermaidControlsParams) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showSource, setShowSource] = useState(false);
  const [isMinimize, setIsMinimize] = useState(showSourceView);
  const [isPanzoomEnabled, setIsPanzoomEnabled] = useState(false);

  // 打印模式下自动展开
  useEffect(() => {
    if (isPrintPreview && svg && !error && !loading) {
      setIsCollapsed(false);
    }
  }, [isPrintPreview, svg, error, loading]);

  // 监听原生全屏状态
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && showCollapse) {
        setIsCollapsed(true);
      }
    };
    if (!isPrintPreview) {
      document.addEventListener("fullscreenchange", handler);
    }
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [showCollapse, isPrintPreview]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current?.requestFullscreen?.();
    }
  }, [wrapperRef]);

  return {
    isFullscreen,
    setIsFullscreen,
    isCollapsed,
    setIsCollapsed,
    showSource,
    setShowSource,
    isMinimize,
    setIsMinimize,
    isPanzoomEnabled,
    setIsPanzoomEnabled,
    toggleFullscreen,
  };
}
