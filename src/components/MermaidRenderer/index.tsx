import { useRef, useEffect, useCallback, useMemo, forwardRef } from "react";
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
import mermaidSvg from '../../assets/svg/mermaid.svg'
import driverRender from "../../utils/driver";
import RenderMarkdown from "../RenderMarkdown";
import { getDriverConfig } from "./driverConfig";
import { extractMermaidTitle } from "./extractMermaidTitle";

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
  /**
   * 自定义 CDN 配置，如 { mermaid: 'https://...' }
   */
  cdn?: Record<string, string>;
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
  cdn,
}) {
  const { isDark } = useTheme();
  const { svg, error, loading } = useMermaidRender({ source, debounceMs, isDark, chartConfig, cdn });

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
    isPanzoomEnabled,
    setIsPanzoomEnabled,
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

  const isPanzoomAvailable = enablePanzoom && (isFullscreen || !isCollapsed || !showCollapse);
  const isPanzoomActive = isPanzoomAvailable && isPanzoomEnabled;
  const panzoomRef = usePanzoom({
    contentRef, wrapperRef,
    enabled: isPanzoomActive && !!svg && !isPrintPreview,
    svg,
    isFullscreen,
  });

  // 新手引导
  useEffect(() => {
    if (showDriverGuide && !isPrintPreview) {
      driverRender(getDriverConfig(showSourceView, !!svg));
    }
  }, [svg, showDriverGuide, isPrintPreview, showSourceView]);

  const title = extractMermaidTitle(source);

  const handleDownloadSVG = useCallback(() => {
    if (!svg) { customMessage.warning("暂无图表"); return; }
    downloadSVG(svg, title);
  }, [svg, title]);

  const handleDownloadPNG = useCallback(() => {
    if (!svg) { customMessage.warning("暂无图表"); return; }
    downloadSVGAsPNG(svg, title, 2);
  }, [svg, title]);

  const downloadMenu = useMemo(() => ({
    items: [
      { key: "svg", label: "下载 SVG" },
      { key: "png", label: "下载 PNG" },
    ],
    onClick: ({ key }: { key: string }) => (key === "svg" ? handleDownloadSVG() : handleDownloadPNG()),
  }), [handleDownloadSVG, handleDownloadPNG]);

  const hasDiagram = !!svg;

  return (
    <div
      ref={wrapperRef}
      className={
        classNames.bind(style)(
          isFullscreen ? "mermaid-wrapper-fullscreen" : "",
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
            isPanzoomAvailable={isPanzoomAvailable}
            isPanzoomEnabled={isPanzoomEnabled}
            setIsPanzoomEnabled={setIsPanzoomEnabled}
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
      <div className={`${style.previewArea} ${!isPanzoomActive ? style.previewAreaDisabled : ''}`} style={{ minHeight: hasDiagram ? "auto" : minHeight }}>
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
