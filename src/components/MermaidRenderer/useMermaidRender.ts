import { useState, useRef, useEffect } from "react";
import useLoadMermaid from "@/hooks/useLoadMermaid";

let renderIdSeq = 0;

/**
 * 共享 Mermaid 渲染逻辑
 * - 加载 mermaid 库
 * - 根据主题初始化
 * - 防抖渲染 SVG
 * - 返回 { svg, error, loading }
 */
interface UseMermaidRenderParams {
  source: string;
  debounceMs?: number;
  isDark: boolean;
  /**
   * 渲染前对图表源码进行改写（初始化语义：仅首次传入时确定，后续变更不生效，
   * 避免内联函数引用变化导致每轮重渲染重置防抖）
   */
  transformSource?: (text: string) => string;
  /**
   * @deprecated 旧名，等价于 transformSource（初始化语义）
   */
  chartConfig?: (text: string) => string;
  /**
   * 自定义 CDN 配置，如 { mermaid: 'https://...' }（初始化语义：全局仅加载一次，以首次调用为准）
   */
  cdn?: Record<string, string>;
  /**
   * mermaid 安全级别，默认 'strict'（禁用图内点击事件/原始 HTML）。
   * 仅当完全信任图表来源时才设为 'loose'。
   */
  securityLevel?: 'strict' | 'loose';
}

export default function useMermaidRender({
  source,
  debounceMs = 300,
  isDark,
  transformSource,
  chartConfig,
  cdn,
  securityLevel = 'strict',
}: UseMermaidRenderParams) {
  const { mermaid, loading, error: loadError } = useLoadMermaid(cdn);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const renderSeqRef = useRef(0);

  // 初始化语义：首次传入的改写函数固定使用，后续引用变化不感知
  const transformerRef = useRef<(text: string) => string | undefined>(undefined);
  if (transformerRef.current === undefined) {
    transformerRef.current = transformSource ?? chartConfig;
  }

  // mermaid 库加载失败时透出错误（CDN 不可达等场景不能永远停在“渲染中”）
  useEffect(() => {
    if (loadError) {
      setError(loadError.message?.split("\n")[0] || String(loadError));
    }
  }, [loadError]);

  // 主题变化时重新初始化 mermaid
  useEffect(() => {
    if (!mermaid) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel,
    });
  }, [mermaid, isDark, securityLevel]);

  // 防抖渲染 SVG
  useEffect(() => {
    if (!mermaid) return;
    const text = (source || "").trim();
    if (!text) {
      setSvg("");
      setError("");
      return;
    }
    setError("");
    const seq = ++renderSeqRef.current;
    const timer = setTimeout(async () => {
      const id = `mermaid-render-${renderIdSeq++}`;
      try {
        const transform = transformerRef.current;
        const finalText = transform ? transform(text) : text;
        const { svg: svgStr } = await mermaid.render(id, finalText ?? text);
        if (seq !== renderSeqRef.current) return;
        setSvg(svgStr);
        setError("");
      } catch (err: unknown) {
        if (seq !== renderSeqRef.current) return;
        console.error("Mermaid render error:", err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message?.split("\n")[0] || message);
      } finally {
        const leftover = document.getElementById(id) || document.getElementById(`d${id}`);
        if (leftover && leftover.parentNode) leftover.parentNode.removeChild(leftover);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [source, isDark, mermaid, debounceMs]);

  return { svg, error, loading };
}
