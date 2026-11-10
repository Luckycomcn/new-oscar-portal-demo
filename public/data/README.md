# `public/data/` — Static Data Assets

This directory contains static data files that are copied unchanged into the build output and can be accessed directly by URL at runtime.

## `world-countries.geojson`

- **Purpose**: Country and territory boundary vectors (`FeatureCollection`) for map rendering and other geographic features.
- **File format**: GeoJSON (RFC 7946). Each feature's `id` is an ISO 3166-1 **alpha-3** country code (such as `AFG` or `AGO`), `properties.name` is the English country or territory name, and `geometry` is a `Polygon` or `MultiPolygon`.
- **Coordinate reference system**: WGS84 (EPSG:4326), with coordinates in `[longitude, latitude]` order.
- **Source**: A GeoJSON conversion of the **Natural Earth** *Admin 0 – Countries* dataset (1:110m, low resolution, public domain), redistributed in GeoJSON format. The original dataset is available on the [Natural Earth download page](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/).
  - For higher resolution (1:50m or 1:10m) or updated boundaries, download the appropriate dataset from Natural Earth, convert it to GeoJSON, and replace this file.
- **License**: Natural Earth data is in the **public domain** and may be used freely without attribution, although attribution is appreciated. This file is provided as is, without warranty.
- **Filename and URL**: The file was originally named `world-countries.geo.json` and has been renamed to `world-countries.geojson` to use the standard extension. `src/components/OscarMap.vue` loads it using Vite's base URL followed by `data/world-countries.geojson`. With the default base URL, it is available at `/data/world-countries.geojson`; Vite serves files in `public/` from the site root.
