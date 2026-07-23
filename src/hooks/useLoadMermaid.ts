// hooks/useLoadMermaid.ts
import { useState, useEffect } from 'react';
import { jsMap } from '@/utils/preload';

declare global {
  interface Window {
    mermaid: any;
  }
}

let mermaidPromise: Promise<any> | null = null;

function loadMermaidScript() {
  if (!mermaidPromise) {
    mermaidPromise = new Promise((resolve, reject) => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      const script = document.createElement('script');
      script.src = jsMap.mermaid;
      script.onload = () => resolve(window.mermaid);
      script.onerror = () => reject(new Error('Mermaid 脚本加载失败'));
      document.head.appendChild(script);
    });
  }
  return mermaidPromise;
}

export default function useLoadMermaid() {
  const [mermaid, setMermaid] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadMermaidScript()
      .then((instance) => {
        if (!cancelled) {
          instance.initialize({ startOnLoad: false });
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