import React, { useState, useEffect, useRef } from 'react';
import classNames from 'classnames/bind';
import { UpOutlined } from '@ant-design/icons';
import style from './index.module.less';

const cx = classNames.bind(style);

/**
 * BackTop 组件的属性接口
 */
interface BackTopProps {
  /** 滚动容器元素获取函数 */
  target?: () => HTMLElement;
  /** 显示阈值，滚动超过此值时显示按钮 */
  visibilityHeight?: number;
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
  const containerRef = useRef<HTMLElement | null>(null);

  // 获取滚动容器
  useEffect(() => {
    if (target) {
      try {
        containerRef.current = target();
      } catch {
        containerRef.current = null;
      }
    }
  }, [target]);

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current || window;
    
    /**
     * 处理滚动事件
     */
    const handleScroll = () => {
      let scrollTop = 0;
      if (container === window) {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
      } else {
        scrollTop = (container as HTMLElement).scrollTop;
      }
      setVisible(scrollTop > visibilityHeight);
    };

    const eventTarget = container === window ? window : container;
    eventTarget.addEventListener('scroll', handleScroll, { passive: true });

    // 初始检查
    handleScroll();

    return () => {
      eventTarget.removeEventListener('scroll', handleScroll);
    };
  }, [visibilityHeight]);

  /**
   * 点击按钮滚动到顶部
   */
  const handleClick = () => {
    const container = containerRef.current || window;

    if (container === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      (container as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!visible) return null;

  return (
    <div
      className={cx('back-top')}
      onClick={handleClick}
    >
      <UpOutlined />
    </div>
  );
};

export default CustomBackTop;
