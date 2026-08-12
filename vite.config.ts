import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import path from 'path';
import commonjs from 'vite-plugin-commonjs';


export default defineConfig({
  plugins: [
    // ⚠️ 1. commonjs 必须放在 react 等插件的前面
    commonjs({
      // ⚠️ 2. 显式包含 node_modules 中的第三方包
      filter(id) {
        if (id.includes('node_modules')) {
          return true
        }
        return undefined // 返回 undefined 使用默认行为
      }
    }),
    react(),
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
    }),
  ],
  build: {
    // 库模式配置
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'MyComponentLibrary',
      formats: ['es'],
      fileName: () => `index.mjs`
    },
    rollupOptions: {
      treeshake: {
        moduleSideEffects: (id: string) => /\.(css|less)$/.test(id),
        propertyReadSideEffects: false,
      },
      external: ['react', 'react-dom', 'antd', '@ant-design/icons', 'highlight.js', /^highlight\.js\/.*/, 'react/jsx-runtime'],
      output: {
        format: 'es',
        esModule: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          antd: 'antd',
          '@ant-design/icons': 'Icons',
          'highlight.js': 'hljs',
          'react/jsx-runtime': 'jsxRuntime'
        },
        assetFileNames: 'index.css',
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 3,
        pure_funcs: ['console.log', 'console.info'],
      },
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
      '@': path.resolve(__dirname, 'src')
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