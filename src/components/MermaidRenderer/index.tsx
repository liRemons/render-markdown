import { useRef, useEffect, useCallback, useMemo, forwardRef } from "react";
import { IsPC } from 'methods-r';
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
   * 渲染前对图表源码进行改写（初始化语义：仅首次传入生效）
   */
  transformSource?: (text: string) => string;
  /**
   * @deprecated 旧名，等价于 transformSource
   */
  chartConfig?: (text: string) => string;
  /**
   * mermaid 安全级别，默认 'strict'（禁用图内点击事件/原始 HTML）。
   * 仅当完全信任图表来源时才设为 'loose'。
   */
  securityLevel?: 'strict' | 'loose';
  /**
   * 自定义 CDN 配置，如 { mermaid: 'https://...' }（初始化语义：全局仅加载一次）
   */
  cdn?: Record<string, string>;
  /**
   * 新手引导是否每个元素只触发一次（默认 true）。
   * 流式重渲染场景下设为 false 会反复弹引导。
   */
  driverGuideOnce?: boolean;
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
  transformSource,
  chartConfig,
  securityLevel,
  cdn,
  driverGuideOnce = true,
}) {
  const { isDark } = useTheme();
  const { svg, error, loading } = useMermaidRender({
    source,
    debounceMs,
    isDark,
    transformSource,
    chartConfig,
    securityLevel,
    cdn,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    isFullscreen,
    isCollapsed,
    toggleCollapseAnimated,
    showSource,
    setShowSource,
    isMinimize,
    toggleMinimizeAnimated,
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
    contentRef,
    wrapperRef,
    // 实例只跟“能不能缩放”挂钩；折叠/展开、图表重渲染只解绑事件，不重置位姿
    canUse: enablePanzoom && !!svg && !isPrintPreview,
    active: isPanzoomActive,
    isFullscreen,
  });

  // 新手引导：默认每个元素只触发一次，避免流式重渲染反复弹引导
  useEffect(() => {
    if (!showDriverGuide || isPrintPreview || !svg) return;
    const el = wrapperRef.current;
    if (!el) return;
    if (driverGuideOnce) {
      if (el.dataset.mdDriverDone) return;
      el.dataset.mdDriverDone = '1';
    }
    driverRender(getDriverConfig(showSourceView, !!svg));
  }, [svg, showDriverGuide, isPrintPreview, showSourceView, driverGuideOnce]);

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
            setIsMinimize={toggleMinimizeAnimated}
            setIsCollapsed={toggleCollapseAnimated}
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
          width={IsPC() ? 800 : 'calc(100% - 20px)'}
          onCancel={() => setShowSource(false)}
          footer={null}
        >
          <RenderMarkdown showCollapseButton={false} enableMermaid={false} codeType='mermaid' content={source} />
        </CustomModal>
      )}
    </div>
  );
});

export default MermaidRenderer;

// ==================== 对外导出 ====================
import renderMermaidWithControls from './renderMermaidWithControls';

/**
 * 带主题容器的图表组件（推荐直接使用）：
 * 作为 JSX 元素类型稳定，父组件重渲染不会导致子树卸载重建；自带 ThemeProvider，
 * 应用未包主题上下文时也能直接渲染。
 * 旧用法 renderMermaid({...}) 返回 JSX 的方式每次调用都生成新元素类型，
 * 会造成重渲染时完整卸载重建，已标废。
 */
export const MermaidChart: React.FC<MermaidRendererProps> = (props) => (
  <ThemeProvider>
    <MermaidRenderer {...props} />
  </ThemeProvider>
);

/**
 * @deprecated 请改用组件形式 <MermaidChart {...} />；函数调用返回 JSX 会在父组件重渲染时重置子树状态
 */
const renderMermaid = (props: MermaidRendererProps) => <MermaidChart {...props} />;

export { renderMermaidWithControls, renderMermaid };
