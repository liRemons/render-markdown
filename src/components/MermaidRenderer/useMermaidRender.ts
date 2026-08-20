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
   * 自定义配置函数，对渲染前 text 进行修改
   * @returns 
   */
  chartConfig?: (text: string) => string;
  /**
   * 自定义 CDN 配置，如 { mermaid: 'https://...' }
   */
  cdn?: Record<string, string>;
}

export default function useMermaidRender({ source, debounceMs = 300, isDark, chartConfig, cdn }: UseMermaidRenderParams) {
  const { mermaid, loading } = useLoadMermaid(cdn);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const renderSeqRef = useRef(0);

  // 主题变化时重新初始化 mermaid
  useEffect(() => {
    if (!mermaid) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
    });
  }, [mermaid, isDark]);

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
        const { svg: svgStr } = await mermaid.render(id, (chartConfig ? chartConfig(text) : text));
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
  }, [source, isDark, mermaid, debounceMs, chartConfig]);

  return { svg, error, loading };
}
