import customMessage from '@/components/CustomMessage';

/**
 * 通用下载：将 Blob 或 URL 作为文件下载
 * @param {Blob|string} data - Blob 对象或 URL 字符串
 * @param {string} filename - 下载文件名
 * @param {object} [options] - 可选配置
 * @param {string} [options.type] - MIME 类型（data 为 Blob 时自动识别）
 */
export function downloadFile(data: Blob | string, filename: string) {
  let url;
  if (data instanceof Blob) {
    url = URL.createObjectURL(data);
  } else if (typeof data === "string") {
    url = data;
  } else {
    customMessage.error("不支持的下载格式");
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  customMessage.success(`${filename} 已下载`);
}

/**
 * 下载 SVG 字符串为 .svg 文件
 * @param {string} svgStr - SVG 内容
 * @param {string} filename - 文件名（不含后缀）
 */
export function downloadSVG(svgStr: string, filename = "image") {
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  downloadFile(blob, `${filename}.svg`);
}

/**
 * 将 SVG 渲染为 PNG 并下载
 * @param {string} svgStr - SVG 内容
 * @param {string} filename - 文件名（不含后缀）
 * @param {number} [scale=2] - 缩放倍数（提高清晰度）
 */
export function downloadSVGAsPNG(svgStr: string, filename = "image", scale = 2) {
  const { w, h } = getSvgSize(svgStr);
  const encoded = btoa(unescape(encodeURIComponent(svgStr)));
  const url = `data:image/svg+xml;base64,${encoded}`;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) {
        customMessage.error("PNG 生成失败");
        return;
      }
      downloadFile(pngBlob, `${filename}.png`);
    }, "image/png");
  };
  img.onerror = () => {
    customMessage.error("PNG 生成失败：图片加载失败");
  };
}

/**
 * 更健壮的 SVG 尺寸解析器
 */
function getSvgSize(svgStr: string) {
  // 1. 尝试提取 viewBox (这是最准确的“相对比例”来源)
  const vbMatch = svgStr.match(/viewBox=["']?([^"']+)["']/i);
  let vbW = 0, vbH = 0;
  
  if (vbMatch) {
    // 处理逗号或空格分隔的情况： "0 0 100 100" 或 "0,0,100,100"
    const parts = vbMatch[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      vbW = parts[2];
      vbH = parts[3];
    }
  }

  // 2. 尝试提取 width/height 属性
  // 改进正则：支持单引号、支持单位前的空格、支持百分号
  const wMatch = svgStr.match(/width=["']?\s*([\d.]+)\s*(?:px|pt|cm|mm|in|%)*["']/i);
  const hMatch = svgStr.match(/height=["']?\s*([\d.]+)\s*(?:px|pt|cm|mm|in|%)*/i);

  const w = wMatch ? parseFloat(wMatch[1]) : 0;
  const h = hMatch ? parseFloat(hMatch[1]) : 0;

  // 3. 智能修正逻辑
  
  // 情况 A: 如果宽高都没读到，直接使用 viewBox
  if (vbW && vbH) {
    return { w: vbW, h: vbH };
  }

  // 情况 C: 如果一切正常，返回解析值；如果还是不行，给个默认值防止崩溃
  return { 
    w: w || vbW || 800, 
    h: h || vbH || 600 
  };
}