# `public/data/` — 静态数据资源

本目录存放构建时原样拷贝到产物、可在运行时通过 URL 直接访问的静态数据文件。

## `world-countries.geojson`

- **用途**：世界各国家/地区边界矢量数据（`FeatureCollection`），供地图渲染或地理相关功能使用。
- **文件格式**：GeoJSON（RFC 7946）。每个 `Feature` 的 `id` 为 ISO 3166-1 **alpha-3** 国家代码（如 `AFG`、`AGO`），`properties.name` 为英文国家/地区名称，`geometry` 为 `Polygon` 或 `MultiPolygon`。
- **坐标参考系**：WGS84（EPSG:4326），坐标顺序为 `[经度, 纬度]`。
- **来源**：该数据集为 **Natural Earth** 发布的 *Admin 0 – Countries*（1:110m 低分辨率，公有领域 / Public Domain）的 GeoJSON 转换版本，属常见的国家边界公开数据集再进行格式转换后的再分发。原始数据见 Natural Earth：<https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/>。
  - 如果你需要更高精度（1:50m / 1:10m）或需要最新国界，请从上述 Natural Earth 页面重新下载并转换为 GeoJSON 后覆盖本文件。
- **许可**：Natural Earth 数据属于 **公有领域（Public Domain）**，可自由使用，无需署名（署名仅为礼貌）。本文件按原样提供，不附带任何担保。
- **重命名说明**：本文件原名 `world-countries.geo.json`，现规范为带标准扩展名的 `world-countries.geojson`。仓库内无代码以固定文件名引用它；如果你在代码中加载此文件，请使用 `/data/world-countries.geojson`（Vite 的 `public/` 下的文件会映射到站点根路径 `/data/...`）。
