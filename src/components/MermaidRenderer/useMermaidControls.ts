import { useState, useEffect, useCallback, useRef, RefObject } from "react";

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

  /** 本实例当前是否处于全屏：fullscreenchange 是页面级事件，用它判定“退出全屏是否由我触发” */
  const ownFullscreenRef = useRef(false);
  /** 进入全屏前的展开状态，退出时原样还原 */
  const collapsedBeforeFullscreenRef = useRef<boolean | null>(null);
  const isCollapsedRef = useRef(isCollapsed);
  useEffect(() => {
    isCollapsedRef.current = isCollapsed;
  }, [isCollapsed]);

  // 打印模式下自动展开
  useEffect(() => {
    if (isPrintPreview && svg && !error && !loading) {
      setIsCollapsed(false);
    }
  }, [isPrintPreview, svg, error, loading]);

  // 监听原生全屏状态。
  // fullscreenchange 在 document 上广播，页面上每一个图表实例都会收到；
  // document.fullscreenElement 又是全局的，因此必须先判定“这次变化是否发生在本实例上”，
  // 否则 A 图表（或图片预览）退出全屏会把 B/C 图表已展开的状态一并重置为折叠。
  useEffect(() => {
    if (isPrintPreview) return;
    const handler = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const fsEl = document.fullscreenElement;
      const nowFullscreen = !!fsEl && (fsEl === el || el.contains(fsEl));
      // 既不是本实例进入全屏，也不是本实例此前在全屏后退出 → 与本组件无关，直接忽略
      if (!nowFullscreen && !ownFullscreenRef.current) return;

      if (nowFullscreen) {
        ownFullscreenRef.current = true;
        collapsedBeforeFullscreenRef.current = isCollapsedRef.current;
        setIsFullscreen(true);
        // 全屏期间强制展开：.mermaid-collapsed 的 max-height 会把全屏容器压成 200px
        setIsCollapsed(false);
        return;
      }

      ownFullscreenRef.current = false;
      setIsFullscreen(false);
      // 还原进入全屏前的展开状态，而不是强制折叠
      if (showCollapse) {
        setIsCollapsed(collapsedBeforeFullscreenRef.current ?? defaultCollapsed);
      }
      collapsedBeforeFullscreenRef.current = null;
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [showCollapse, isPrintPreview, defaultCollapsed, wrapperRef]);

  // 只关心“本实例是否全屏”，不用全局 fullscreenElement 做分支：
  // 否则其它元素处于全屏时，本图表的全屏按钮会误退别人的全屏而自身进不去
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen?.().catch(() => { /* 用户手势失效等场景忽略 */ });
      return;
    }
    el.requestFullscreen?.().catch(() => {
      // 非安全上下文（http）或被浏览器策略拒绝时会 reject，避免未处理的 Promise 拒绝
      console.warn('[render-markdown] 进入全屏失败（可能被浏览器策略拒绝或非安全上下文）');
    });
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
