import React, { useEffect, ReactNode } from 'react';
import classNames from 'classnames/bind';
import { createPortal } from 'react-dom';
import style from './index.module.less';

const cx = classNames.bind(style);

/**
 * Modal 组件的属性接口
 */
interface ModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 弹窗标题 */
  title: string;
  /** 弹窗宽度 */
  width?: number;
  /** 关闭回调 */
  onCancel?: () => void;
  /** 底部内容 */
  footer?: ReactNode | null;
  /** 关闭时是否销毁子元素 */
  destroyOnClose?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 弹窗内容 */
  children?: ReactNode;
}

/**
 * 自定义 Modal 组件
 * 使用 Portal 渲染到 body，实现模态对话框
 */
const CustomModal: React.FC<ModalProps> = ({
  open,
  title,
  width = 520,
  onCancel,
  footer,
  destroyOnClose: _destroyOnClose = false,
  className = '',
  children,
}) => {
  /**
   * 处理关闭按钮点击
   */
  const handleCancel = () => {
    onCancel?.();
  };

  /**
   * 处理遮罩层点击
   */
  const handleMaskClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  /**
   * 点击弹窗内部不关闭
   */
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // 监听 ESC 键关闭弹窗
  useEffect(() => {
    if (!open) return;

    /**
     * 处理键盘事件
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // 禁止背景滚动
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  // 不渲染未打开的弹窗
  if (!open) return null;

  // destroyOnClose 时条件渲染内容
  const content = children;

  const modalContent = (
    <div
      className={cx('modal-mask', 'modal-mask-visible')}
      onClick={handleMaskClick}
    >
      <div
        className={cx('modal', className)}
        style={{ width }}
        onClick={handleModalClick}
      >
        {/* 标题栏 */}
        <div className={cx('modal-header')}>
          <span className={cx('modal-title')}>{title}</span>
          <div className={cx('modal-close')} onClick={handleCancel}>
            ×
          </div>
        </div>

        {/* 内容区域 */}
        <div className={cx('modal-body')}>
          {content}
        </div>

        {/* 底部区域 */}
        {footer !== undefined && footer !== null && (
          <div className={cx('modal-footer')}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body
  return createPortal(modalContent, document.body);
};

export default CustomModal;
