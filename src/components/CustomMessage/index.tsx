import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WarningOutlined, InfoCircleOutlined, CloseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import style from './index.module.less';

const cx = classNames.bind(style);

/**
 * 消息类型定义
 */
type MessageType = 'warning' | 'info' | 'error' | 'success';

/**
 * 单条消息的配置项
 */
interface MessageConfig {
  key: string;
  content: string;
  type: MessageType;
  duration?: number;
}

/**
 * 消息提示组件
 * 使用 React Portal 渲染到 body，实现全局消息提示
 */
const MessageToast: React.FC<{ config: MessageConfig }> = ({ config }) => {
  // 图标映射，使用 antd 图标
  const icons: Record<MessageType, ReactNode> = {
    warning: <WarningOutlined style={{ color: '#faad14', fontSize: '16px' }} />,
    info: <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '16px' }} />,
    error: <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />,
    success: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />,
  };

  return (
    <div className={cx('toast', `toast-${config.type}`)}>
      {icons[config.type]}
      <span>{config.content}</span>
    </div>
  );
};

/**
 * 消息容器组件
 * 管理所有消息的显示和自动移除
 */
const MessageContainer: React.FC = () => {
  const [messages, setMessages] = useState<MessageConfig[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  /**
   * 移除指定消息
   */
  const removeMessage = (key: string) => {
    setMessages((prev) => prev.filter((msg) => msg.key !== key));
    const timer = timersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(key);
    }
  };

  /**
   * 清除所有消息
   */
  const clearAll = () => {
    setMessages([]);
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  };

  // 监听全局事件实现消息管理
  useEffect(() => {
    const handleMessage = (event: CustomEvent) => {
      const { type, content, duration = 3000 } = event.detail;
      const key = `message-${Date.now()}-${Math.random()}`;
      const config: MessageConfig = { key, content, type, duration };

      setMessages((prev) => [...prev, config]);

      // 设置自动消失定时器
      const timer = window.setTimeout(() => {
        removeMessage(key);
      }, duration);
      timersRef.current.set(key, timer);
    };

    const handleClear = () => {
      clearAll();
    };

    window.addEventListener('custom-message', handleMessage as EventListener);
    window.addEventListener('custom-message-clear', handleClear as EventListener);

    return () => {
      window.removeEventListener('custom-message', handleMessage as EventListener);
      window.removeEventListener('custom-message-clear', handleClear as EventListener);
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <div className={cx('container')}>
      {messages.map((msg) => (
        <div key={msg.key} className={cx('item')}>
          <MessageToast config={msg} />
        </div>
      ))}
    </div>
  );
};

/**
 * 初始化消息容器
 * 将消息容器挂载到 body
 */
let messageRoot: Root | null = null;
let containerInitialized = false;

const initMessageContainer = () => {
  if (containerInitialized) return;
  containerInitialized = true;
  
  const container = document.createElement('div');
  container.id = 'custom-message-container';
  document.body.appendChild(container);
  messageRoot = createRoot(container);
  messageRoot.render(<MessageContainer />);
};

/**
 * 自定义消息 API
 */
const customMessage = {
  /**
   * 显示警告消息
   */
  warning: (content: string, duration?: number) => {
    initMessageContainer();
    // 使用 requestAnimationFrame 确保 DOM 已更新后再发送事件
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('custom-message', {
          detail: { type: 'warning', content, duration },
        })
      );
    });
  },

  /**
   * 显示信息消息
   */
  info: (content: string, duration?: number) => {
    initMessageContainer();
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('custom-message', {
          detail: { type: 'info', content, duration },
        })
      );
    });
  },

  /**
   * 显示错误消息
   */
  error: (content: string, duration?: number) => {
    initMessageContainer();
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('custom-message', {
          detail: { type: 'error', content, duration },
        })
      );
    });
  },

  /**
   * 显示成功消息
   */
  success: (content: string, duration?: number) => {
    initMessageContainer();
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('custom-message', {
          detail: { type: 'success', content, duration },
        })
      );
    });
  },

  /**
   * 清除所有消息
   */
  destroy: () => {
    window.dispatchEvent(new Event('custom-message-clear'));
  },
};

export default customMessage;
