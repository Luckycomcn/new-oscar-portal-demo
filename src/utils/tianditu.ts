import XYZ from 'ol/source/XYZ'

export const tiandituKey = import.meta.env.VITE_TIANDITU_KEY?.trim()

export function tiandituSource(layer: 'vec' | 'cva') {
  return new XYZ({
    url: 'https://t{0-7}.tianditu.gov.cn/' + layer + '_w/wmts'
      + '?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=default&FORMAT=tiles'
      + '&LAYER=' + layer + '&TILEMATRIXSET=w&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
      + '&tk=' + encodeURIComponent(tiandituKey ?? ''),
    attributions: '<a href="https://map.tianditu.gov.cn/" target="_blank" rel="noopener">© Tianditu</a>',
    minZoom: 1,
    maxZoom: 18,
    wrapX: true,
  })
}
