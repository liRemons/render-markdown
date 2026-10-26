import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import path from 'path';
import { fileURLToPath } from 'url';

/** 项目根目录（package.json 为 "type": "module"，不能用 __dirname） */
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 库构建配置：npm run build
 * - 所有 dependencies/peerDependencies 均 external，产物只含本库代码；
 *   使用方安装本包后由包管理器解析这些依赖（package.json 已声明）。
 * - 样式统一提取为 dist/index.css，使用方手动引入。
 */
export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      // 示例页与应用入口不属于库产物，不生成 .d.ts
      exclude: ['src/demo/**', 'src/main.tsx'],
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(rootDir, 'src/index.ts'),
      formats: ['es'],
      fileName: () => `index.mjs`
    },
    rollupOptions: {
      treeshake: {
        moduleSideEffects: (id: string) => /\.(css|less)$/.test(id),
        propertyReadSideEffects: false,
      },
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@ant-design/icons',
        'highlight.js',
        /^highlight\.js\/.*/,
        'markdown-it',
        '@mdit/plugin-tab',
        'markdown-it-anchor',
        'markdown-it-github-alerts',
        'markdown-it-link-attributes',
        'markdown-it-task-lists',
        '@panzoom/panzoom',
        'driver.js',
        'morphdom',
        'photoswipe',
        'methods-r',
        'classnames',
      ],
      output: {
        assetFileNames: 'index.css',
      },
    },
    minify: 'terser',
    terserOptions: {
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: false,
  },
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
