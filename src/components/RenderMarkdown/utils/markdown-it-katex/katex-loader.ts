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

  if (typeof document === 'undefined' || typeof window === 'undefined') {
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