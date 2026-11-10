# new-oscar-portal-demo (Vue 3 + TypeScript + OpenLayers)

站点查询、详情、地图和统计接入 WMO Resource Catalogue，参考词表保留静态数据。接口说明见 [前端接口清单](./docs/前端接口清单.md)。

> 本项目仅用于演示。站点和统计来自公开 WIGOS 目录；导出任务为本地演示，服务不可用时部分旧入口会回退本地快照。

---

## 功能概览

仅保留以下四类页面：

| 页面 | 本地地址 |
| --- | --- |
| 首页 | http://localhost:5173/#/ |
| 站点搜索 | http://localhost:5173/#/search |
| 导出 | http://localhost:5173/#/export |
| 站点详情 | http://localhost:5173/#/search/station/stationReportDetails/0-22000-0-2903947 |

站点详情使用同一页面模板，wigosId 随所选站点变化，搜索结果和地图仍可打开对应站点报告。其他页面及旧路由别名已删除，访问不存在的地址会返回首页。

- **首页**：欢迎区、世界地图、站点标记、图例和统计数字。
- **站点搜索**：多条件高级筛选、结果表格和导出。
- **站点详情**：站点报告、观测信息及下载。
- **导出**：查看和下载导出任务。
- **国际化**：中文 / English / Français / Español，默认 English，选择结果写入 localStorage。
- **地图能力**：缩放、重置视角、海岸线底图开关、点选站点弹出信息、导出 PNG/JPG/KML、站点报告下载（PDF/XML/CSV/WMDR V2，前端本地生成）
- **路由**：Hash 路由（`#/...`），与原站形式一致，静态托管无需服务端重写规则

---

## 技术栈

- Vue 3 + `<script setup>` + TypeScript
- Vite（构建工具，`@vitejs/plugin-vue`、`unplugin-auto-import`、`unplugin-vue-components`）
- Vue Router（Hash 模式）
- vue-i18n（v11）
- OpenLayers（`ol`）
- Element Plus（组件按需引入）

---

## 环境要求

- Node.js **≥ 18**（开发与构建使用 Node 24 验证通过）
- npm **≥ 9**（随包提供 `package-lock.json`，建议使用 `npm ci` 复现依赖）
- 或使用 Docker（见下文，无需在宿主机安装 Node 依赖）

---

## 目录结构（源文件）

```
.
├── index.html               # Vite 入口 HTML
├── package.json             # 依赖与脚本
├── package-lock.json        # 锁定依赖版本（务必一并提交）
├── vite.config.ts           # Vite 配置（base、插件）
├── tsconfig*.json           # TypeScript 配置
├── Dockerfile               # Docker 多阶段构建（Node 构建 → Nginx 托管）
├── nginx.conf               # 生产托管用 Nginx 配置
├── LICENSE                  # Apache License 2.0（第三方资源说明见 NOTICE）
├── src/                     # 应用源码（Vue 组件、路由、i18n、数据封装）
│   ├── api/                 # WIGOS 目录客户端及兼容接口
│   ├── components/          # 地图、布局、表单等组件
│   ├── data/                # 本地静态数据（JSON / TS）
│   ├── i18n/                # 中英文语言包
│   ├── router/              # 路由定义（Hash 模式）
│   ├── stores/              # 轻量状态（筛选、导出）
│   ├── utils/               # 下载、导出等工具
│   └── views/               # 首页、搜索、导出、站点详情（仅四个页面）
├── public/                  # 原样拷贝到构建产物的静态资源
│   ├── images/              # 保留图片资源
│   └── data/                # 含 world-countries.geojson（来源见 public/data/README.md）

```

> 仅保留源文件：`node_modules/`、`dist/`、`dist.zip` 等生成物不纳入版本控制（见 `.gitignore`）。请按下方说明在本地构建。

---

## 本地开发

```bash
# 1. 安装依赖（推荐用 ci 以严格复现锁文件）
npm ci        # 或 npm install

# 2. 启动开发服务器（默认 http://localhost:5173/）
npm run dev
```

## 生产构建

```bash
npm run build     # 先 vue-tsc 类型检查，再 vite 打包到 dist/
npm run preview   # 本地预览构建产物（默认 http://localhost:4173/）
```

`dist/` 为纯静态产物，可托管到任意静态服务器。因使用 Hash 路由，**无需**配置 SPA 的 history 回落规则。

---

## Docker 部署（可选，免装本地依赖）

仓库已提供 `Dockerfile`（多阶段：Node 构建 → Nginx 托管）与 `nginx.conf`。

```bash
# 构建镜像
docker build -t oscar-surface .

# 运行容器，映射到宿主机 8080
docker run -d --name oscar-surface -p 8080:8080 oscar-surface
```

然后浏览器访问 `http://localhost:8080/`。

如需自定义端口，编辑 `nginx.conf` 后重新构建镜像即可。目录接口默认通过 CORS 直接访问。

---

## 需要注意的配置项

1. **`vite.config.ts` → `base: './'`**
   构建产物使用相对路径，可部署在任意子路径（如 `https://host/oscar/`）下而无需改动。若改为绝对部署在根路径，可保持默认。

2. **目录接口地址**
   默认直连 WMO Resource Catalogue。可在项目根目录 .env.local 中配置 VITE_WIGOS_API_BASE，修改后重启开发服务或重新构建。详见 docs/前端接口清单.md。

3. **样式与图片**
   全局样式由 `src/style.scss` 独立实现，组件样式使用 SCSS，经 Vite 编译。图片继续保留，`index.html` 中 `/images/*` 为绝对路径，部署到子路径时需相应调整。

4. **国际化（`src/i18n/index.ts`）**
   默认语言 `en`，用户切换后保存在 `localStorage` 的 `oscar-locale` 键。如需默认中文，将 `DEFAULT_LOCALE` 改为 `'zh'`。

5. **本地数据文件**
   `src/api/oscar.ts` 引用了 `src/data/stations.json` 以及 `src/data/*.json`。这些是构建期输入，**请勿删除**，否则类型检查 / 构建会失败。

6. **Node 版本**
   若 `npm ci` 因本地二进制（如 `sass-embedded`、`lightningcss`）报错，请确认 Node 版本 ≥ 18，并删除 `node_modules` 后重装。

---

## 常见问题（FAQ）

**Q1：这是一个 Angular 应用吗？**
不是。本项目是 **Vue 3 + TypeScript + Vite** 应用。当前页面由 Vue 实现，地图使用 OpenLayers；原站样式包已移除。

**Q2：需要 `package.json` / `package-lock.json` 吗？**
需要，且二者都应保留。`package.json` 声明依赖与脚本，`package-lock.json` 锁定依赖的精确版本（配合 `npm ci` 可复现构建）。构建流程依赖它们，缺少任意一个都无法安装 / 构建。

---

## 许可证与第三方资源

本项目自有源码使用 **Apache License 2.0**（见 `LICENSE` 与 `NOTICE`）。第三方 npm 依赖遵守各自许可。

