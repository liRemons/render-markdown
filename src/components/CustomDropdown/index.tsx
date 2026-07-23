import React, { useState, useRef, useEffect, ReactNode } from 'react';
import classNames from 'classnames/bind';
import style from './index.module.less';

const cx = classNames.bind(style);

/**
 * 下拉菜单项接口
 */
interface DropdownItem {
  /** 选项的唯一标识 */
  key: string;
  /** 选项显示的标签文本 */
  label: ReactNode;
}

/**
 * Dropdown 组件的属性接口
 */
interface DropdownProps {
  /** 下拉菜单项列表 */
  items: DropdownItem[];
  /** 子元素（触发元素） */
  children: ReactNode;
  /** 点击选项时的回调 */
  onClick: ({ key }: { key: string }) => void;
  /** 自定义 className */
  className?: string;
}

/**
 * 自定义 Dropdown 组件
 * 点击触发元素显示下拉菜单，选择后关闭
 */
const CustomDropdown: React.FC<DropdownProps> = ({ items, children, onClick, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * 切换下拉菜单显示状态
   */
  const toggleVisible = () => {
    setVisible((prev) => !prev);
  };

  /**
   * 关闭下拉菜单
   */
  const close = () => {
    setVisible(false);
  };

  /**
   * 处理选项点击
   */
  const handleItemClick = (item: DropdownItem) => {
    onClick({ key: item.key });
    close();
  };

  // 点击外部区域关闭下拉菜单
  useEffect(() => {
    /**
     * 处理文档点击事件
     */
    const handleDocumentClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        close();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleDocumentClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [visible]);

  return (
    <div
      ref={dropdownRef}
      className={cx('dropdown', className)}
    >
      {/* 触发元素 */}
      <div className={cx('dropdown-trigger')} onClick={toggleVisible}>
        {children}
      </div>

      {/* 下拉菜单 */}
      {visible && (
        <div className={cx('dropdown-menu', 'dropdown-menu-visible')}>
          {items.map((item) => (
            <div
              key={item.key}
              className={cx('dropdown-item')}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
