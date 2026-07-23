import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import path from 'path'
import * as esbuild from 'esbuild'

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true
    }),
    {
      name: 'generate-minified',
      async closeBundle() {
        console.log('Generating minified files...')
        const fs = await import('fs')
        const distPath = path.resolve(__dirname, 'dist')
        
        try {
          // 压缩 JS
          const jsPath = path.join(distPath, 'index.js')
          if (fs.existsSync(jsPath)) {
            const code = fs.readFileSync(jsPath, 'utf-8')
            const result = await esbuild.transform(code, { minify: true })
            fs.writeFileSync(path.join(distPath, 'index.min.js'), result.code)
            console.log('Generated index.min.js')
          }
          
          // 压缩 CSS
          const cssPath = path.join(distPath, 'index.css')
          if (fs.existsSync(cssPath)) {
            const code = fs.readFileSync(cssPath, 'utf-8')
            const result = await esbuild.transform(code, { minify: true, loader: 'css' })
            fs.writeFileSync(path.join(distPath, 'index.min.css'), result.code)
            console.log('Generated index.min.css')
          }
        } catch (error) {
          console.error('Failed to generate minified files:', error)
        }
      }
    }
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@ant-design/icons'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@ant-design/icons': 'Icons'
        },
        format: 'es',
        entryFileNames: 'index.js',
        assetFileNames: 'index.css'
      }
    },
    minify: false
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