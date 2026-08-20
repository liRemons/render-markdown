import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/hooks/useTheme';
import MermaidRenderer from './index';

/**
 * DOM 扫描入口（文档页使用）
 * 扫描页面中所有 code.language-mermaid 元素，替换为 MermaidRenderer 组件
 */
export default async function renderMermaidWithControls(
  props: {
    showDriverGuide?: boolean;
    isPrintPreview?: boolean;
    chartConfig?: (text: string) => string;
    defaultCollapsed?: boolean;
    cdn?: Record<string, string>;
  }
) {
  const blocks = document.querySelectorAll("code.language-mermaid");

  const { showDriverGuide, isPrintPreview = false, chartConfig, defaultCollapsed = true, cdn } = props || {};

  for (const block of blocks) {
    const pre = block.parentElement;
    if (!pre) continue;
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
            chartConfig={chartConfig}
            defaultCollapsed={defaultCollapsed}
            isPrintPreview={isPrintPreview}
            minHeight={200}
            showDriverGuide={showDriverGuide}
            cdn={cdn}
          />
        </ThemeProvider>
      </React.StrictMode>
    );
  }
}