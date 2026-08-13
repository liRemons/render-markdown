import React, { useRef, useEffect, useCallback, forwardRef } from "react";
import { downloadSVG, downloadSVGAsPNG } from "@/utils/download";
import { LoadingOutlined } from "@ant-design/icons";
import { useTheme, ThemeProvider } from "@/hooks/useTheme";
import customMessage from "@/components/CustomMessage";
import CustomModal from "@/components/CustomModal";
import useMermaidRender from "./useMermaidRender";
import usePanzoom from "./usePanzoom";
import useMermaidControls from "./useMermaidControls";
import MermaidToolbar from "./MermaidToolbar";
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
  /**
   * 是否为打印模式
   */
  isPrintPreview?: boolean;
  /**
   * 自定义配置函数，对渲染前 text 进行修改
   * @returns 
   */
  chartConfig?: (text: string) => string;
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
  isPrintPreview = false,
  chartConfig,
}) {
  const { isDark } = useTheme();
  const { svg, error, loading } = useMermaidRender({ source, debounceMs, isDark, chartConfig });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    isFullscreen,
    isCollapsed,
    setIsCollapsed,
    showSource,
    setShowSource,
    isMinimize,
    setIsMinimize,
    toggleFullscreen,
  } = useMermaidControls({
    showCollapse,
    showSourceView,
    defaultCollapsed,
    isPrintPreview,
    svg,
    error,
    loading,
    wrapperRef,
  });

  const isPanzoomActive = enablePanzoom && (isFullscreen || !isCollapsed || !showCollapse);
  const panzoomRef = usePanzoom({
    contentRef, wrapperRef,
    enabled: isPanzoomActive && !!svg && !isPrintPreview,
    svg,
    isFullscreen,
  });

  // 新手引导
  useEffect(() => {
    showDriverGuide && !isPrintPreview && driverRender([
      {
        id: menuDriverKey,
        condition: () => !localStorage[menuDriverKey] && showSourceView && !IsPC() && localStorage.docListMenuVisible !== 'true',
        onOpen: () => localStorage[menuDriverKey] = 1,
        steps: [
          { element: '.docList-menu-anchor', popover: { title: '大纲', description: '点击此处您可查看大纲' } },
          { element: '.docList-menu-list', popover: { title: '列表', description: '点击此处您可查看当前分类下文章列表' } },
          { element: '.docList-menu-copyHtml', popover: { title: '复制', description: '点击此处您可复制 HTML 渲染的格式内容' } },
          { element: '.docList-menu-copyMarkdown', popover: { title: '复制', description: '点击此处您可复制 markdown 源码' } },
          { element: '.docList-menu-print', popover: { title: '打印', description: '点击此处您可跳转至打印页面，输出为PDF' } },
        ]
      },
      {
        id: menuPcDriverKey,
        condition: () => !localStorage[menuPcDriverKey] && IsPC() && showSourceView,
        onOpen: () => localStorage[menuPcDriverKey] = 1,
        steps: [
          { element: '.docList-menu-copyHtml', popover: { title: '复制', description: '点击此处您可复制 HTML 渲染的格式内容' } },
          { element: '.docList-menu-copyMarkdown', popover: { title: '复制', description: '点击此处您可复制 markdown 源码' } },
          { element: '.docList-menu-print', popover: { title: '打印', description: '点击此处您可跳转至打印页面，输出为PDF' } },
        ]
      },
      {
        id: mermaidDriverKey,
        condition: () => {
          const result = svg && !localStorage[mermaidDriverKey] && showSourceView;
          return !!result
        },
        onOpen: () => localStorage[mermaidDriverKey] = 1,
        steps: [
          { element: '.mermaid-react-root .mermaid-mini', popover: { title: 'mermaid', description: '恭喜您解锁 Mermaid 渲染图表' } },
          { element: '.docList-menu-mermaid-collapse', popover: { title: '展开收起mermaid', description: '点击此处按钮可一键展开收起mermaid图表' }, isShow: !!svg },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-minimize-btn', popover: { title: '缩略图', description: '点击此处按钮可查看缩略图' } },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-fullscreen-btn', popover: { title: '全屏', description: '点击此处按钮可切换为全屏展示' } },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-showcode-btn', popover: { title: '源码', description: '点击此处按钮查看源码弹窗' } },
          { element: '.mermaid-react-root .mermaid-mini .mermaid-collapsed-btn', popover: { title: '展开', description: '点击此处按钮展开大图' } },
        ]
      }
    ])
  }, [svg, showDriverGuide, isPrintPreview, showSourceView])

  const titleMatch = source.match(/---\s*\n\s*title:\s*(.+)\s*\n\s*---/);
  const title = titleMatch ? titleMatch[1].trim() : 'mermaid 图表';

  const handleDownloadSVG = useCallback(() => {
    if (!svg) { customMessage.warning("暂无图表"); return; }
    downloadSVG(svg, title);
  }, [svg, title]);

  const handleDownloadPNG = useCallback(() => {
    if (!svg) { customMessage.warning("暂无图表"); return; }
    downloadSVGAsPNG(svg, title, 2);
  }, [svg, title]);

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
          isCollapsed && showCollapse && !isMinimize ? "mermaid-collapsed" : "",
          className,
          isMinimize && isCollapsed && !isFullscreen ? 'mermaid-mini' : '',
          isPrintPreview ? 'print-preview' : ''
        )
      }
      style={{ minHeight: isMinimize ? 0 : minHeight, position: "relative", height: '100%' }}
    >
      {!isPrintPreview && <>
        {showSourceView && <div className="mermaid-title">
          <span className="mermaid-title-tag">
            <img src={mermaidSvg} alt="" />
            <span className="mermaid-title-text">Mermaid</span>
          </span>
          {title}
        </div>}
        {!hasDiagram && <div className="mermaid-toolbar-loading"><LoadingOutlined /> </div>}
        {hasDiagram && (
          <MermaidToolbar
            showSourceView={showSourceView}
            showCollapse={showCollapse}
            showDownload={showDownload}
            isFullscreen={isFullscreen}
            isCollapsed={isCollapsed}
            isMinimize={isMinimize}
            isPanzoomActive={isPanzoomActive}
            setIsMinimize={setIsMinimize}
            setIsCollapsed={setIsCollapsed}
            setShowSource={setShowSource}
            toggleFullscreen={() => {
              panzoomRef.current?.reset();
              toggleFullscreen();
            }}
            downloadMenu={downloadMenu}
            panzoomRef={panzoomRef}
          />
        )}
      </>}

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

export default MermaidRenderer;

// ==================== DOM 扫描入口（文档页使用） ====================
import renderMermaidWithControls from './renderMermaidWithControls';

const renderMermaid = (props: MermaidRendererProps) => {
  return (
    <ThemeProvider>
      <MermaidRenderer {...props} />
    </ThemeProvider>
  )
}

export { renderMermaidWithControls, renderMermaid };
