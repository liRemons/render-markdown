import { useCallback, useEffect, useRef, RefObject } from "react";
import Panzoom from "@panzoom/panzoom";

type PanzoomInstance = ReturnType<typeof Panzoom>;

interface PanzoomRefType {
  destroy: () => void;
  zoomWithWheel: (e: WheelEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface UsePanzoomParams {
  contentRef: RefObject<HTMLElement | null>;
  wrapperRef: RefObject<HTMLElement | null>;
  /**
   * 是否具备缩放能力（图表已渲染且开启 enablePanzoom）。
   * 实例只跟随它创建/销毁，因此图表重渲染不会重置用户的缩放/平移位姿。
   */
  canUse: boolean;
  /** 是否响应交互（拖拽、滚轮缩放）。关闭时只解绑事件，保留已有 transform */
  active: boolean;
  /** 全屏切换会大幅改变可视区域，需要重建实例以重新计算边界 */
  isFullscreen: boolean;
}

/**
 * Panzoom 实例管理。
 *
 * 修复前：依赖里含 svg 字符串，每次重渲染（流式输出、主题切换）都 destroy + 重建，
 * 用户刚缩放/平移好的视图被反复清零；折叠再展开同样清零。
 * 现在：实例只由 canUse 决定生死（承载 transform 的容器节点始终不变，替换其内部 <svg> 不影响它），
 * 交互开关用 bind/destroy 解绑事件实现，位姿得以保留。
 */
export default function usePanzoom({ contentRef, wrapperRef, canUse, active, isFullscreen }: UsePanzoomParams) {
  const panzoomRef = useRef<PanzoomRefType | null>(null);
  const instanceRef = useRef<PanzoomInstance | null>(null);
  /** 当前交互绑定的解绑函数（null 表示未绑定） */
  const detachRef = useRef<(() => void) | null>(null);
  /** 供创建实例时读取最新交互状态，避免把 active 加进创建依赖导致重建 */
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  /** 绑定拖拽与滚轮缩放 */
  const attach = useCallback((instance: PanzoomInstance) => {
    detachRef.current?.();
    const wheelTarget = wrapperRef.current;
    instance.bind();
    const handleWheel = instance.zoomWithWheel;
    wheelTarget?.addEventListener("wheel", handleWheel);
    detachRef.current = () => {
      wheelTarget?.removeEventListener("wheel", handleWheel);
      // Panzoom 的 destroy 只解绑指针事件，不会清空 transform
      instance.destroy();
    };
  }, [wrapperRef]);

  const detach = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
  }, []);

  // 实例创建 / 销毁
  useEffect(() => {
    const elem = contentRef.current;
    if (!canUse || !elem) {
      detach();
      instanceRef.current = null;
      panzoomRef.current = null;
      return;
    }
    const instance = Panzoom(elem, {
      maxScale: 5,
      minScale: 0.1,
      startScale: 1,
      contain: 'outside' as const,
      // 是否响应交互交由 active 决定，创建时先不抢事件
      noBind: true,
    });
    instanceRef.current = instance;
    panzoomRef.current = {
      destroy: () => instance.destroy(),
      zoomWithWheel: instance.zoomWithWheel,
      zoomIn: () => instance.zoomIn(),
      zoomOut: () => instance.zoomOut(),
      reset: () => instance.reset(),
    };
    // 实例被重建时（如全屏切换）若当前处于可交互状态，需要立即重新绑定
    if (activeRef.current) attach(instance);
    return () => {
      detach();
      instance.destroy();
      if (instanceRef.current === instance) {
        instanceRef.current = null;
        panzoomRef.current = null;
      }
    };
  }, [canUse, isFullscreen, contentRef, attach, detach]);

  // 交互开关：只解绑/绑定事件，不动已积累的位姿
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    if (active) attach(instance);
    else detach();
  }, [active, attach, detach]);

  return panzoomRef;
}
