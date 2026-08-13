import React from 'react';
import {
  PlusOutlined, MinusOutlined,
  FullscreenOutlined, FullscreenExitOutlined,
  DownloadOutlined, ReloadOutlined, CodeOutlined,
  UpOutlined, DownOutlined,
  ImportOutlined, ExportOutlined
} from '@ant-design/icons';
import CustomTooltip from '@/components/CustomTooltip';
import CustomDropdown from '@/components/CustomDropdown';
import { IsPC } from 'methods-r';

interface ToolbarItem {
  isShow?: boolean;
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  dropdown?: {
    items: Array<{ key: string; label: string }>;
    onClick: ({ key }: { key: string }) => void;
  };
  className?: string;
}

interface MermaidToolbarProps {
  showSourceView: boolean;
  showCollapse: boolean;
  showDownload: boolean;
  isFullscreen: boolean;
  isCollapsed: boolean;
  isMinimize: boolean;
  isPanzoomActive: boolean;
  setIsMinimize: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowSource: (value: boolean) => void;
  toggleFullscreen: () => void;
  downloadMenu: {
    items: Array<{ key: string; label: string }>;
    onClick: ({ key }: { key: string }) => void;
  };
  panzoomRef: React.MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
  } | null>;
}

export default function MermaidToolbar({
  showSourceView,
  showCollapse,
  showDownload,
  isFullscreen,
  isCollapsed,
  isMinimize,
  isPanzoomActive,
  setIsMinimize,
  setIsCollapsed,
  setShowSource,
  toggleFullscreen,
  downloadMenu,
  panzoomRef,
}: MermaidToolbarProps) {
  const items: ToolbarItem[] = [
    {
      isShow: showSourceView && isCollapsed && !isFullscreen,
      icon: isMinimize ? <ExportOutlined /> : <ImportOutlined />,
      tooltip: isMinimize ? '缩略图' : '最小化',
      onClick: () => setIsMinimize((prev: boolean) => !prev),
      className: 'mermaid-minimize-btn',
    },
    {
      isShow: isPanzoomActive,
      icon: <PlusOutlined />,
      tooltip: '放大',
      onClick: () => panzoomRef.current?.zoomIn(),
    },
    {
      isShow: isPanzoomActive,
      icon: <MinusOutlined />,
      tooltip: '缩小',
      onClick: () => panzoomRef.current?.zoomOut(),
    },
    {
      isShow: isPanzoomActive,
      icon: <ReloadOutlined />,
      tooltip: '重置',
      onClick: () => panzoomRef.current?.reset(),
    },
    {
      isShow: showDownload && isPanzoomActive,
      icon: <DownloadOutlined />,
      tooltip: '下载',
      dropdown: downloadMenu,
    },
    {
      isShow: true,
      icon: isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />,
      tooltip: isFullscreen ? '退出全屏' : '全屏',
      onClick: toggleFullscreen,
      className: 'mermaid-fullscreen-btn',
    },
    {
      isShow: showSourceView && !isFullscreen,
      icon: <CodeOutlined />,
      tooltip: '查看源码',
      onClick: () => setShowSource(true),
      className: 'mermaid-showcode-btn',
    },
    {
      isShow: showCollapse && !isFullscreen,
      icon: isCollapsed ? <DownOutlined /> : <UpOutlined />,
      tooltip: isCollapsed ? '展开' : '收起',
      onClick: () => setIsCollapsed((prev: boolean) => !prev),
      className: 'mermaid-collapsed-btn',
    },
  ];

  return (
    <div className="mermaid-toolbar">
      {items.map((item, index) => {
        if (item.isShow === false) return null;
        const btn = item.dropdown ? (
          <CustomDropdown key={index} items={item.dropdown.items} onClick={item.dropdown.onClick}>
            <div className={`remons-markdown-circle ${item.className || ''}`}>{item.icon}</div>
          </CustomDropdown>
        ) : (
          <div key={index} className={`remons-markdown-circle ${item.className || ''}`} onClick={item.onClick}>
            {item.icon}
          </div>
        );
        return item.tooltip && IsPC() ? (
          <CustomTooltip key={index} title={item.tooltip}>
            {btn}
          </CustomTooltip>
        ) : btn;
      })}
    </div>
  );
}