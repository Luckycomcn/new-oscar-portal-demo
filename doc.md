> 当前样式实现见 [SCSS 样式重写说明](./docs/样式重写说明.md)。下文为历史项目记录，旧原站 CSS/JS 不再作为当前页面依赖。

# OSCAR/Surface 前端项目说明

项目已全部创建完成，目录为 `c:\Users\ghycu\Desktop\demo\oscar-surface`。

本项目对照 [OSCAR/Surface](https://oscar.wmo.int/surface/#/) 页面结构，使用 Vue 3 复现站点布局与主要模块，地图部分改用 OpenLayers。

---

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router（Hash 路由，与原站 `#/` 形式一致）
- OpenLayers

---

## 项目结构

### 静态资源（引用自 `demo` 文件夹及原站）

| 路径 | 内容 |
|---|---|
| `src/style.scss` | 独立实现的全局 SCSS，替代原站样式 |
| `public/js/` | `go.js`、`go-vendor.js`（原站 Angular / Esri 脚本，供对照；业务逻辑已用 Vue 重写） |
| `public/images/` | 从 oscar.wmo.int 下载的 `logo_wmo.png`、`logo_oscar.png`、`meteo_logo.png`、`header_bg.png` |
| `public/fonts/` | Font Awesome 4.4 字体文件 |

### Vue 组件与页面

对照 `demo/element/` 文件夹中每个模块的 HTML 结构：

| element 模块 | Vue 页面 / 组件 |
|---|---|
| `home.txt` | `HomeView.vue` + `OscarMap.vue`（OpenLayers 世界地图 + 站点标记 + 图例 + 最新新闻） |
| `search.txt` | `SearchStationView.vue`（高级搜索表单 + 结果表格）+ `SearchGenericView.vue`（集群 / 仪器 / 联系人 / 文献） |
| `about.txt` | `AboutView.vue`（完整 About OSCAR 内容） |
| `news.txt` | `NewsView.vue`（新闻列表） |
| `Glossary.txt` | `GlossaryView.vue`（术语表） |
| `FAQ.txt` | `FaqView.vue`（手风琴式 FAQ） |
| `links.txt` | `LinksView.vue`（外部链接列表） |
| `support.txt` | `SupportView.vue` + `ContactForm.vue`（技术支持表单含验证码） |
| `feedback.txt` | `FeedbackView.vue`（反馈表单） |

### 公共布局组件

| 组件 | 职责 |
|---|---|
| `AppLayout.vue` | 整页骨架（页头、导航、侧栏、主内容、页脚） |
| `AppHeader.vue` | 三个 Logo + 顶部帮助链接 |
| `AppNavbar.vue` | 顶部导航栏 + 快速搜索 |
| `AppSidebar.vue` | 左侧边栏：首页 Quick Access / 搜索子导航 / 信息页导航 |
| `AppFooter.vue` | © WMO 版权栏 |
| `QuickSearch.vue` | 下拉即时搜索站点 / 集群 / 联系人 |

### 数据与路由

- `src/data/stations.ts`：示范站点、国家列表、联系人、聚类、仪器、文献
- `src/data/content.ts`：新闻、术语、FAQ、外链、导航配置
- `src/router/index.ts`：Hash 路由定义

---

## OpenLayers 地图功能

实现于 `src/components/OscarMap.vue`：

- CARTO Voyager 底图
- WMO ArcGIS 缓存图层叠加（浏览器允许跨域时生效）
- 20 个示范站点彩色标记（按 domain 颜色、按 status 形状区分）
- 点击弹出站点信息面板
- 展开 / 收缩地图
- 导出 PNG / JPG / KML

图例颜色：

| 类型 | 颜色 |
|---|---|
| air | `#a349a4` |
| land or ocean surface | `#0080ff` |
| sub-surface | `#b5e61d` |
| lake or river | `#ff7f27` |

状态形状：Operational（实心圆）、Partly operational（星形）、Closed（菱形）、Silent（空心圆）、Unknown（三角）。

---

## 主要路由

| 路径 | 页面 |
|---|---|
| `#/` | 首页 |
| `#/search/station` | 站点搜索 |
| `#/search/stationCluster` | 站点聚类搜索 |
| `#/search/instrument` | 仪器搜索 |
| `#/search/contact` | 联系人搜索 |
| `#/search/reference` | 文献搜索 |
| `#/station/:id` | 站点详情 |
| `#/about` | About OSCAR |
| `#/news/:newsId?` | 新闻 |
| `#/glossary/:term?` | 术语表 |
| `#/faq/:id?` | FAQ |
| `#/links` | 链接 |
| `#/support` | 技术支持 |
| `#/feedback` | 反馈 |
| `#/login` | 登录说明 |

---

## 启动方式

```bash
cd c:\Users\ghycu\Desktop\demo\oscar-surface
npm install
npm run dev
```

浏览器打开终端输出的地址（通常是 `http://localhost:5173/`）即可看到完整页面。

生产构建：

```bash
npm run build
npm run preview
```

TypeScript 编译和生产构建（`npm run build`）均已通过验证，无错误。

---

## 说明与限制

- 地图上的站点坐标与弹窗信息为演示数据，不是生产库全量。
- Support / Feedback 表单仅在前端校验并提示提交成功，不连接原站后端。
- Login 不接入瑞士 eIAM，仅提供说明与原站入口。
- 原站 `go.js` / `go-vendor.js` 依赖 Angular 与 Esri，不能直接在本 Vue 应用中执行；交互已用 Vue + OpenLayers 重写。
