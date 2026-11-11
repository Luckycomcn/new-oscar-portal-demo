# `public/data/` — Static Data Assets

This directory contains static data files that are copied unchanged into the build output and can be accessed directly by URL at runtime.

## `station-overview/<version>/{z}/{x}/{y}.pbf`

- **Purpose**: Fast unfiltered global/regional station overview at zooms below 6.
- **Source**: Public [WIGOS observing facility catalogue](https://wmo-resource-catalogue.labs.wis2dev.io/collections/wigos-observing-facility-metadata), fetched through compact paginated items queries. These are derived station data, subject to the upstream provider's terms; project code licensing does not relicense upstream records.
- **Generation**: `npm run refresh:station-overview`; metadata and source URL are recorded in `src/data/stationOverview.json`. Normal builds require no data refresh.
- **Content**: MVT layer `hits`, point geometry, representative `id`, `properties.facilityType.id`, and `count`. No contact information or full station records are bundled. Points are grouped per colour domain in 16px cells at tile zoom 0–2 and 8px cells at 3–5 (512px tiles). Every valid mapped station contributes to a count at each level.
- **Missing geometry**: Records without valid point coordinates are excluded and counted in the manifest and map note. The note also identifies the generated snapshot date; this is an overview, not a live position feed.
- **Caching**: Content-versioned directory, immutable cache headers and protobuf compression in Nginx. Publish the manifest and tiles together; keep prior versions available while old application builds may still use them.

## `station-overview/<version>/points/<facilityType>.json`

Exact per-type station points, generated together with the overview. Each row is
`[stationId, longitude, latitude]`; the manifest records total, mapped and
unmapped counts per type. Unlike grouped MVT representatives, these include every
valid station of that exact type, so type filtering cannot lose minority types
inside shared colour cells. The map loads only selected type files and reuses
them across viewport changes. Coordinates retain six decimal places; station
details remain live and are fetched on demand. These snapshot files are not used
for programme, country, region, variable or keyword predicates that they cannot
accurately evaluate.

## `world-countries.geojson`

- **Purpose**: Country and territory boundary vectors (`FeatureCollection`) for map rendering and other geographic features.
- **File format**: GeoJSON (RFC 7946). Each feature's `id` is an ISO 3166-1 **alpha-3** country code (such as `AFG` or `AGO`), `properties.name` is the English country or territory name, and `geometry` is a `Polygon` or `MultiPolygon`.
- **Coordinate reference system**: WGS84 (EPSG:4326), with coordinates in `[longitude, latitude]` order.
- **Source**: A GeoJSON conversion of the **Natural Earth** *Admin 0 – Countries* dataset (1:110m, low resolution, public domain), redistributed in GeoJSON format. The original dataset is available on the [Natural Earth download page](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/).
  - For higher resolution (1:50m or 1:10m) or updated boundaries, download the appropriate dataset from Natural Earth, convert it to GeoJSON, and replace this file.
- **License**: Natural Earth data is in the **public domain** and may be used freely without attribution, although attribution is appreciated. This file is provided as is, without warranty.
- **Filename and URL**: The file was originally named `world-countries.geo.json` and has been renamed to `world-countries.geojson` to use the standard extension. `src/components/OscarMap.vue` loads it using Vite's base URL followed by `data/world-countries.geojson`. With the default base URL, it is available at `/data/world-countries.geojson`; Vite serves files in `public/` from the site root.
