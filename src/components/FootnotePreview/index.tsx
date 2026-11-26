import React, { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames/bind';
import styles from './index.module.less';

const cx = classNames.bind(styles);

export interface FootnotePreviewProps {
  /** 触发脚注在视口中的位置（点击时的 getBoundingClientRect） */
  anchorRect: DOMRect;
  /** 使用方传入的脚注预览组件 */
  children: ReactNode;
  /** 关闭预览 */
  onClose: () => void;
}

const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 8;

/**
 * 脚注预览浮层：
 * - Portal 到 body，避免被 markdown 容器或 overflow 裁剪
 * - 默认在脚注上方展开，空间不足时翻到下方
 * - 点击外部、Esc、页面滚动/尺寸变化时关闭
 */
const FootnotePreview: React.FC<FootnotePreviewProps> = ({ anchorRect, children, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const { width, height } = panel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchorRect.left + anchorRect.width / 2 - width / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - width - VIEWPORT_MARGIN));

    let top = anchorRect.top - height - ANCHOR_GAP;
    if (top < VIEWPORT_MARGIN) {
      const below = anchorRect.bottom + ANCHOR_GAP;
      if (below + height + VIEWPORT_MARGIN <= viewportHeight) {
        top = below;
      } else {
        top = Math.max(VIEWPORT_MARGIN, Math.min(top, viewportHeight - height - VIEWPORT_MARGIN));
      }
    } else {
      top = Math.min(top, viewportHeight - height - VIEWPORT_MARGIN);
    }

    setPosition({ top, left });
    setReady(true);
  }, [anchorRect]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const handleResize = () => onCloseRef.current();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      className={cx('footnote-preview')}
      style={{ top: position.top, left: position.left, opacity: ready ? 1 : 0 }}
      role="dialog"
      aria-modal="false"
      aria-label="脚注预览"
    >
      <button type="button" className={cx('close')} aria-label="关闭脚注预览" onClick={onClose}>
        ×
      </button>
      <div className={cx('body')}>{children}</div>
    </div>,
    document.body
  );
};

export default FootnotePreview;
