import defaultCdn from './cdn';

/**
 * 获取 jsMap（默认配置）
 */
export const jsMap: Record<string, string> = defaultCdn;

const delay = 5000;

export function preload(cdnName: string | string[]) {
	// 统一转为数组处理
	const cdnNames = Array.isArray(cdnName) ? cdnName : [cdnName];

	// 页面加载完成后，空闲时静默预加载
	function loadScripts() {
		cdnNames.forEach((cdnName) => {
			const href = jsMap[cdnName];
			if (!href) return;
			const link = document.createElement('link');
			link.rel = 'preload';
			link.href = href;
			link.as = 'script';
			document.head.appendChild(link);
		});
	}

	// 方式 A：浏览器空闲时执行（优先）
	if ('requestIdleCallback' in window) {
		requestIdleCallback(loadScripts);
	} else {
		// 降级：延迟 5 秒后执行
		setTimeout(loadScripts, delay);
	}
}