import React, { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { createRoot } from "react-dom/client";
import { downloadSVG, downloadSVGAsPNG } from "@/utils/download";
import {
  PlusOutlined, MinusOutlined,
  FullscreenOutlined, FullscreenExitOutlined,
  DownloadOutlined, ReloadOutlined, CodeOutlined,
  UpOutlined, DownOutlined,
  ImportOutlined, ExportOutlined, LoadingOutlined
} from "@ant-design/icons";
import { useTheme, ThemeProvider } from "@/hooks/useTheme";
import customMessage from "@/components/CustomMessage";
import CustomTooltip from "@/components/CustomTooltip";
import CustomDropdown from "@/components/CustomDropdown";
import CustomModal from "@/components/CustomModal";
import useMermaidRender from "./useMermaidRender";
import usePanzoom from "./usePanzoom";
import style from "./index.module.less";
import '@/assets/css/index.global.less';
import classNames from "classnames/bind";
import { IsPC } from 'methods-r';
import mermaidSvg from '../../assets/svg/mermaid.svg'
import driverRender from "../../utils/driver";
import RenderMarkdown from "../RenderMarkdown";

const mermaidDriverKey = 'docList-mermaid-driver';
const menuDriverKey = 'docList-menu-driver';
const menuPcDriverKey = 'docList-pc-menu-driver';

/**
 * 工具栏按钮项接口
 */
interface ToolbarItem {
  /** 是否显示 */
  isShow?: boolean;
  /** 图标 */
  icon: React.ReactNode;
  /** 提示文本 */
  tooltip: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 下拉菜单配置 */
  dropdown?: {
    items: Array<{ key: string; label: string }>;
    onClick: ({ key }: { key: string }) => void;
  };
  /** 自定义类名 */
  className?: string;
}

interface MermaidRendererProps {
  /**
   * 图表源码
  */
  source: string;
  /**
  * 图表渲染时的 debounce 时间
  */
  debounceMs?: number;
  /**
  * 是否启用 panzoom 功能
  */
  enablePanzoom?: boolean;
  /**
  * 是否显示下载按钮
  */
  showDownload?: boolean;
  /**
  * 是否显示源码查看按钮
  */
  showSourceView?: boolean;
  /**
  * 是否显示折叠按钮
   */
  showCollapse?: boolean;
  /**
  * 默认折叠状态
  */
  defaultCollapsed?: boolean;
  /**
  * 自定义类名
  */
  className?: string;
  /**
  * 最小高度
  */
  minHeight?: number;
  /**
  * 是否显示新手引导
  */
  showDriverGuide?: boolean;
}

interface IProps {
  showDriverGuide?: boolean;
}

// ==================== 统一 Mermaid 渲染组件 ====================
const MermaidRenderer = forwardRef<null, MermaidRendererProps>(function MermaidRenderer({
  source,
  debounceMs = 300,
  enablePanzoom = true,
  showDownload = true,
  showSourceView = false,
  showCollapse = false,
  defaultCollapsed = true,
  className = "",
  minHeight = 200,
  showDriverGuide,
}) {
  const titleMatch = source.match(/---\s*\n\s*title:\s*(.+)\s*\n\s*---/);
  const title = titleMatch ? titleMatch[1].trim() : 'mermaid 图表';
  const { isDark } = useTheme();

  const { svg, error, loading } = useMermaidRender({ source, debounceMs, isDark });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showSource, setShowSource] = useState(false);
  const [isMinimize, setIsMinimize] = useState(showSourceView);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isPanzoomActive = enablePanzoom && (isFullscreen || !isCollapsed || !showCollapse);
  const panzoomRef = usePanzoom({
    contentRef, wrapperRef,
    enabled: isPanzoomActive && !!svg,
    svg, isFullscreen,
  });

  useEffect(() => {
    showDriverGuide && driverRender([
      {
        id: menuDriverKey,
        condition: () => !localStorage[menuDriverKey] && showSourceView && !IsPC() && localStorage.docListMenuVisible !== 'true',
        onOpen: () => localStorage[menuDriverKey] = 1,
        steps: [
          { element: '.docList-menu-anchor', popover: { title: '大纲', description: '点击此处您可查看大纲' } },
          { element: '.docList-menu-list', popover: { title: '列表', description: '点击此处您可查看当前分类下文章列表' } },
          { element: '.docList-menu-copyHtml', popover: { title: '复制', description: '点击此处您可复制 HTML 渲染的格式内容' } },
          { element: '.docList-menu-copyMarkdown', popover: { title: '复制', description: '点击此处您可复制 markdown 源码' } },
        ]
      },
      {
        id: menuPcDriverKey,
        condition: () => !localStorage[menuPcDriverKey] && IsPC() && showSourceView,
        onOpen: () => localStorage[menuPcDriverKey] = 1,
        steps: [
          { element: '.docList-menu-copyHtml', popover: { title: '复制', description: '点击此处您可复制 HTML 渲染的格式内容' } },
          { element: '.docList-menu-copyMarkdown', popover: { title: '复制', description: '点击此处您可复制 markdown 源码' } },
        ]
      },
      {
        id: mermaidDriverKey,
        condition: () => {
          const result = svg && !localStorage[mermaidDriverKey] && showSourceView;
          return result
        },
        onOpen: () => localStorage[mermaidDriverKey] = 1,
        steps: [
          { element: '.mermaid-react-root .mermaid-mini', popover: { title: 'mermaid', description: '恭喜您解锁 Mermaid 渲染图表' } },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-minimize-btn', popover: { title: '缩略图', description: '点击此处按钮可查看缩略图' } },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-fullscreen-btn', popover: { title: '全屏', description: '点击此处按钮可切换为全屏展示' } },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-showcode-btn', popover: { title: '源码', description: '点击此处按钮查看源码弹窗' } },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-collapsed-btn', popover: { title: '展开', description: '点击此处按钮展开大图' } },
        ]
      }
    ])
  }, [svg])

  // 监听原生全屏状态
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && showCollapse) {
        setIsCollapsed(true);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [showCollapse]);

  const handleDownloadSVG = useCallback(() => {
    if (!svg) { customMessage.warning("暂无图表"); return; }
    downloadSVG(svg, title);
  }, [svg]);

  const handleDownloadPNG = useCallback(() => {
    if (!svg) { customMessage.warning("暂无图表"); return; }
    downloadSVGAsPNG(svg, title, 2);
  }, [svg]);

  const downloadMenu = {
    items: [
      { key: "svg", label: "下载 SVG" },
      { key: "png", label: "下载 PNG" },
    ],
    onClick: ({ key }: { key: string }) => (key === "svg" ? handleDownloadSVG() : handleDownloadPNG()),
  };

  const hasDiagram = !!svg;

  return (
    <div
      ref={wrapperRef}
      className={
        classNames.bind(style)(
          showCollapse ? "mermaid-wrapper" : "",
          isCollapsed && showCollapse && !isMinimize ? " mermaid-collapsed" : "",
          className,
          isMinimize && isCollapsed && !isFullscreen ? 'mermaid-mini' : ''
        )
      }
      style={{ minHeight: isMinimize ? 0 : minHeight, position: "relative", height: '100%' }}
    >
      {/* 工具栏 */}
      {
        showSourceView && <div className="mermaid-title">
          <span className="mermaid-title-tag">
            <img src={mermaidSvg} alt="" />
            <span className="mermaid-title-text">Mermaid</span>
          </span>
          {title}
        </div>
      }
      {!hasDiagram && <div className="mermaid-toolbar-loading"><LoadingOutlined /> </div>}
      {hasDiagram && (
        <div className="mermaid-toolbar">
          {[
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
              onClick: () => {
                panzoomRef.current?.reset()
                if (document.fullscreenElement) document.exitFullscreen();
                else wrapperRef.current?.requestFullscreen?.();
              },
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
          ].filter(Boolean).map((item: ToolbarItem, index: number) => {
            if (item.isShow === false) return null;
            const btn = item.dropdown ? (
              <CustomDropdown key={index} items={item.dropdown.items} onClick={item.dropdown.onClick}>
                <div className={`remons-markdown-circle ${item.className ? ` ${item.className}` : ''}`}>{item.icon}</div>
              </CustomDropdown>
            ) : (
              <div key={index} className={`remons-markdown-circle ${item.className ? ` ${item.className}` : ''}`} onClick={item.onClick}>
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
      )}

      {/* 错误提示 */}
      {error && <div className={style.errorTip}>⚠️ {error}</div>}

      {/* 预览区域 */}
      <div className={style.previewArea} style={{ minHeight: hasDiagram ? "auto" : minHeight }}>
        <div
          ref={contentRef}
          className={style.previewContent}
          dangerouslySetInnerHTML={{ __html: svg || "" }}
        />
        {((!hasDiagram && !error) || loading) && (
          <div className={style.emptyTip}>
            {source?.trim() ? "渲染中..." : "\u2190 输入 Mermaid 源码"}
          </div>
        )}
      </div>

      {/* 源码弹窗 */}
      {showSourceView && (
        <CustomModal
          open={showSource}
          title="Mermaid 源码"
          className="mermaid-code-modal"
          width={800}
          destroyOnClose
          onCancel={() => setShowSource(false)}
          footer={null}
        >
          <RenderMarkdown isShowCollapsed={false} isSlotMermaid={false} codeType='mermaid' content={source} />
        </CustomModal>
      )}
    </div>
  );
});

// ==================== DOM 扫描入口（文档页使用） ====================
async function renderMermaidWithControls(props: IProps) {
  const blocks = document.querySelectorAll("code.language-mermaid");

  const { showDriverGuide } = props || {};

  for (const block of blocks) {
    const pre = block.parentElement;
    if (!pre) return;
    const source = block.textContent.trim();

    const container = document.createElement("div");
    container.className = "mermaid-react-root";
    pre.replaceWith(container);

    const root = createRoot(container);

    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <MermaidRenderer
            source={source}
            enablePanzoom
            showDownload
            showSourceView
            showCollapse
            defaultCollapsed
            minHeight={200}
            showDriverGuide={showDriverGuide}
          />
        </ThemeProvider>
      </React.StrictMode>
    );
  }
}

export default MermaidRenderer;

const renderMermaid = (props: MermaidRendererProps) => {
  return (
    <ThemeProvider>
      <MermaidRenderer {...props} />
    </ThemeProvider>
  )
}

export { renderMermaidWithControls, renderMermaid };
