import customMessage from '@/components/CustomMessage';

/**
 * 将 SVG 字符串转为 data URL
 * （unescape 已废弃，改用 TextEncoder 手动字节化，兼容非 ASCII 字符）
 */
function svgToDataUrl(svgStr: string): string {
  const bytes = new TextEncoder().encode(svgStr);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * 通用下载：将 Blob 或 URL 作为文件下载
 * @param {Blob|string} data - Blob 对象或 URL 字符串
 * @param {string} filename - 下载文件名
 * @param {object} [options] - 可选配置
 * @param {string} [options.type] - MIME 类型（data 为 Blob 时自动识别）
 */
export function downloadFile(data: Blob | string, filename: string) {
  let url: string;
  let isObjectUrl = false;
  if (data instanceof Blob) {
    url = URL.createObjectURL(data);
    isObjectUrl = true;
  } else if (typeof data === "string") {
    url = data;
  } else {
    customMessage.error("不支持的下载格式");
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  // Firefox 要求元素在文档中才会触发下载
  document.body.appendChild(a);
  a.click();
  a.remove();

  if (isObjectUrl) {
    // 立即 revoke 会使部分浏览器取消下载，延后到下一轮事件循环
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
  const url = svgToDataUrl(svgStr);

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
 * 优先级：固定单位（px/pt/cm/mm/in）的 width/height > viewBox > 默认值；
 * 百分比尺寸无法换算为像素，不参与采用。
 */
function getSvgSize(svgStr: string) {
  // 1. viewBox 提供相对比例（最可靠的像素尺寸来源）
  const vbMatch = svgStr.match(/viewBox=["']?([^"'>\s]+(?:[\s,]+[^"'>\s]+){3})["']/i);
  let vbW = 0, vbH = 0;

  if (vbMatch) {
    // 处理逗号或空格分隔的情况： "0 0 100 100" 或 "0,0,100,100"
    const parts = vbMatch[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      vbW = parts[2];
      vbH = parts[3];
    }
  }

  // 2. 提取绝对单位的 width/height 属性（排除百分比）
  const wMatch = svgStr.match(/width=["']?\s*([\d.]+)\s*(px|pt|cm|mm|in)["']/i);
  const hMatch = svgStr.match(/height=["']?\s*([\d.]+)\s*(px|pt|cm|mm|in)["']/i);

  const w = wMatch ? parseFloat(wMatch[1]) : 0;
  const h = hMatch ? parseFloat(hMatch[1]) : 0;

  // 3. 绝对尺寸与 viewBox 同时存在时，以绝对尺寸为准；都缺失时回退 viewBox，最后给默认值防崩溃
  if (w > 0 && h > 0) {
    return { w, h };
  }
  if (vbW > 0 && vbH > 0) {
    return { w: vbW, h: vbH };
  }
  return {
    w: w || vbW || 800,
    h: h || vbH || 600
  };
}