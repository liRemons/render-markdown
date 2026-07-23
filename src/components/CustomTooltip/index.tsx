import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames/bind';
import style from './index.module.less';

const cx = classNames.bind(style);

/**
 * Tooltip 组件的属性接口
 */
interface TooltipProps {
  /** 提示文本 */
  title: string;
  /** 子元素 */
  children: ReactNode;
  /** 是否可见（受控模式） */
  visible?: boolean;
  /** 可见状态改变时的回调 */
  onVisibleChange?: (visible: boolean) => void;
}

/**
 * 自定义 Tooltip 组件
 * 使用 Portal 将提示框渲染到 body，避免被父元素 overflow 裁剪
 */
const CustomTooltip: React.FC<TooltipProps> = ({ title, children, visible: controlledVisible, onVisibleChange }) => {
  const [internalVisible, setInternalVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // 使用受控或非受控模式
  const isVisible = controlledVisible !== undefined ? controlledVisible : internalVisible;

  /**
   * 计算提示框位置
   */
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  };

  /**
   * 显示提示框
   */
  const show = () => {
    updatePosition();
    setInternalVisible(true);
    onVisibleChange?.(true);
  };

  /**
   * 隐藏提示框
   */
  const hide = () => {
    setInternalVisible(false);
    onVisibleChange?.(false);
  };

  /**
   * 鼠标进入时延迟显示
   */
  const handleMouseEnter = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      show();
    }, 150);
  };

  /**
   * 鼠标离开时延迟隐藏
   */
  const handleMouseLeave = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    hide();
  };

  // 监听 visibility 变化，更新位置
  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 初始更新位置
    updatePosition();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  // 提示框内容，使用 Portal 渲染到 body
  const tooltipContent = isVisible && title ? createPortal(
    <div
      className={cx('tooltip-inner', 'tooltip-inner-visible')}
      style={{ top: position.top, left: position.left }}
    >
      <span className={cx('tooltip-content')}>{title}</span>
      <span className={cx('tooltip-arrow')} />
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={triggerRef}
      className={cx('tooltip')}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 触发元素 */}
      <div className={cx('tooltip-trigger')}>
        {children}
      </div>

      {/* 提示框通过 Portal 渲染 */}
      {tooltipContent}
    </div>
  );
};

export default CustomTooltip;
