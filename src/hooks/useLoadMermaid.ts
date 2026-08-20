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

function loadMermaidScript(cdn?: Record<string, string>) {
  if (!mermaidPromise) {
    mermaidPromise = new Promise((resolve, reject) => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      const script = document.createElement('script');
      script.src = getCdnUrl('mermaid', cdn);
      script.onload = () => resolve(window.mermaid!);
      script.onerror = () => reject(new Error('Mermaid 脚本加载失败'));
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

    return () => { cancelled = true; };
  }, []);

  return { mermaid, loading, error };
}