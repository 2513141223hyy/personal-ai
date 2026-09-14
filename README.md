# 知我 · Cloudflare Pages 版

这是专门用于 Cloudflare Pages 的版本。前端构建目录为 `dist`，入口保留 `/api/*`，可由 Pages Functions 接入豆包和 D1。

## 本地预览

```bash
npm install
npm run dev
```

## Pages 部署

构建命令：`npm run build`；输出目录：`dist`。

部署前在 Cloudflare 项目设置 Secrets：`ARK_API_KEY`，变量：`ARK_MODEL`。不要把 API Key 提交到 GitHub。
