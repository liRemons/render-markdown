// hooks/useLoadMermaid.ts
import { useState, useEffect } from 'react';
import { getCdnUrl } from '@/utils/cdn';

export interface MermaidInstance {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
}

declare global {
  interface Window {
    mermaid: MermaidInstance | undefined;
  }
}

let mermaidPromise: Promise<MermaidInstance> | null = null;

/**
 * 加载 mermaid 脚本（全局单例）。
 * 注意：库全局只加载一次，首次调用时确定的 cdn 配置后续生效（初始化语义）；
 * 失败时重置缓存与 script 标签，允许下次调用重试。
 */
function loadMermaidScript(cdn?: Record<string, string>) {
  if (!mermaidPromise) {
    mermaidPromise = new Promise<MermaidInstance>((resolve, reject) => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      const script = document.createElement('script');
      try {
        script.src = getCdnUrl('mermaid', cdn);
      } catch (err) {
        mermaidPromise = null;
        reject(err);
        return;
      }
      script.onload = () => {
        if (window.mermaid) {
          resolve(window.mermaid);
        } else {
          mermaidPromise = null;
          script.remove();
          reject(new Error(`Mermaid 脚本已加载但未挂载 window.mermaid：${script.src}`));
        }
      };
      script.onerror = () => {
        mermaidPromise = null;
        script.remove();
        reject(new Error(`Mermaid 脚本加载失败：${script.src}`));
      };
      document.head.appendChild(script);
    });
  }
  return mermaidPromise;
}

export default function useLoadMermaid(cdn?: Record<string, string>) {
  const [mermaid, setMermaid] = useState<MermaidInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadMermaidScript(cdn)
      .then((instance) => {
        if (!cancelled) {
          setMermaid(() => instance);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    // cdn 采用初始化语义：仅在首次挂载时取用，后续变更不重新加载
    return () => { cancelled = true; };
    // 依赖表故意留空：上述初始化语义（项目未装 eslint-plugin-react-hooks，不写 disable 指令）
  }, []);

  return { mermaid, loading, error };
}