import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { fileURLToPath } from 'url';

/** 项目根目录（package.json 为 "type": "module"，不能用 __dirname） */
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 开发/演示配置：npm run dev 启动示例页（根目录 index.html → src/main.tsx）。
 * 库构建请使用 vite.lib.config.ts（npm run build）。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src')
    }
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true
      }
    }
  }
})
