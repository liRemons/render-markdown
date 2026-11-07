import React, { useState, useEffect, useRef, memo } from 'react';
import classNames from 'classnames/bind';
import { UpOutlined } from '@ant-design/icons';
import style from './index.module.less';

const cx = classNames.bind(style);

/**
 * BackTop 组件的属性接口
 */
interface BackTopProps {
  /**
   * 滚动容器获取函数。返回 null 表示「此刻还没就绪」，组件会逐帧重试
   * （上限 MAX_RESOLVE_FRAMES 帧）；用于滚动容器由本库渲染、宿主在 render 阶段取不到的场景。
   */
  target?: () => HTMLElement | Window | null;
  /** 显示阈值，滚动超过此值时显示按钮 */
  visibilityHeight?: number;
}

/** 惰性解析的重试帧数上限（约 4s@60fps）：超限即放弃，按钮保持不显示 */
const MAX_RESOLVE_FRAMES = 240;

/**
 * 获取滚动容器的 scrollTop
 */
function getScrollTop(container: HTMLElement | Window): number {
  return container === window
    ? window.scrollY || document.documentElement.scrollTop
    : (container as HTMLElement).scrollTop;
}

/**
 * 自定义 BackTop 组件
 * 滚动到顶部按钮，当页面滚动超过指定阈值时显示
 */
const CustomBackTop: React.FC<BackTopProps> = ({
  target,
  visibilityHeight = 300,
}) => {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLElement | Window | null>(null);

  // 目标在 effect 阶段解析（DOM 已提交），而非 render 阶段：
  // 宿主传 getter 时，库自己生成的滚动节点此刻才可能取得到
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let frames = 0;

    const handleScroll = () => {
      const el = containerRef.current;
      if (el) setVisible(getScrollTop(el) > visibilityHeight);
    };

    const attach = (el: HTMLElement | Window) => {
      containerRef.current = el;
      el.addEventListener('scroll', handleScroll, { passive: true });
      // 初始检查
      handleScroll();
    };

    const resolve = () => {
      if (cancelled) return;
      // 未传 target 保持旧默认（跟随 window）；传了但返回 null 则重试
      const el = target ? target() : (typeof window !== 'undefined' ? window : null);
      if (el) {
        attach(el);
        return;
      }
      if (frames++ >= MAX_RESOLVE_FRAMES) return;
      rafId = requestAnimationFrame(resolve);
    };
    resolve();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      containerRef.current?.removeEventListener('scroll', handleScroll);
      containerRef.current = null;
    };
  }, [target, visibilityHeight]);

  /**
   * 点击按钮滚动到顶部
   */
  const handleClick = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <div
      className={`${cx('back-top')} remons-markdown-circle`}
      onClick={handleClick}
    >
      <UpOutlined />
    </div>
  );
};

// memo：target 引用稳定时不随父级重渲染，同时避免 [target] effect 反复重建
export default memo(CustomBackTop);
