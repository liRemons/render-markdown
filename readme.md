# render-markdown

一个基于 React 的 Markdown 渲染组件，支持 GFM（GitHub Flavored Markdown）、代码高亮、Mermaid 图表等功能。

## 技术方案

### 技术栈

| 类别 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | React 18 | 组件库基础框架 |
| 构建工具 | Vite | 基于 Rollup 的极速构建器 |
| 语言 | TypeScript | 提供类型定义 |
| 样式方案 | CSS Modules / 内联样式 | 轻量无外部依赖 |
| 代码规范 | ESLint + Prettier | 统一代码风格 |
| 发布工具 | changesets | 语义化版本管理与 changelog 生成 |

### 核心功能


### 目录结构（计划）

```
├── dist/               # 打包输出
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 发布计划

1. 初始化项目结构与 package.json
2. 配置 Vite + TypeScript 构建
3. 实现核心功能
4. 配置 changesets 并发布到 npm