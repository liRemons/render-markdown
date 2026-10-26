const KATEX_VERSION = '0.18.1';
const KATEX_CSS_URL = `https://registry.npmmirror.com/katex/${KATEX_VERSION}/files/dist/katex.min.css`;
const KATEX_JS_URL = `https://registry.npmmirror.com/katex/${KATEX_VERSION}/files/dist/katex.min.js`;

declare global {
  interface Window {
    katex?: {
      renderToString: (tex: string, options?: Record<string, unknown>) => string;
      render: (tex: string, element: HTMLElement, options?: Record<string, unknown>) => void;
    };
  }
}

let loadPromise: Promise<void> | null = null;

export function ensureKatexLoaded(timeout = 15_000): Promise<void> {
  if (loadPromise) return loadPromise;

  if (typeof window === 'undefined') {
    // SSR 环境不缓存：避免把 rejected Promise 永久挂住导致后续调用全部失败
    return Promise.reject(
      new Error('[katex-loader] Requires a browser environment.')
    );
  }

  if (window.katex) return Promise.resolve();

  loadPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      loadPromise = null;
      reject(new Error(`[katex-loader] KaTeX CDN timeout after ${timeout}ms.`));
    }, timeout);

    // 页面/其他实例已注入过脚本（如手动预加载）：避免重复注入导致 window.katex 被覆盖
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${KATEX_JS_URL}"]`);
    if (existingScript) {
      if (window.katex) {
        clearTimeout(timer);
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => { clearTimeout(timer); resolve(); });
      existingScript.addEventListener('error', () => {
        clearTimeout(timer);
        loadPromise = null;
        reject(new Error(`[katex-loader] Failed to load ${KATEX_JS_URL}`));
      });
      return;
    }

    // CSS（幂等）
    if (!document.querySelector(`link[href="${KATEX_CSS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = KATEX_CSS_URL;
      document.head.appendChild(link);
    }

    // JS
    const script = document.createElement('script');
    script.src = KATEX_JS_URL;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => {
      clearTimeout(timer);
      loadPromise = null;
      script.remove();
      reject(new Error(`[katex-loader] Failed to load ${KATEX_JS_URL}`));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isKatexReady(): boolean {
  return typeof window !== 'undefined' && !!window.katex;
}

export function getKatex(): NonNullable<Window['katex']> {
  if (!window.katex) {
    throw new Error('[katex-loader] KaTeX not loaded. Call ensureKatexLoaded() first.');
  }
  return window.katex;
}