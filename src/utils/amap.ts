interface AmapInstance {
  setZoomAndCenter(zoom: number, center: number[], immediately: boolean): void
  on(event: 'complete', handler: () => void): void
  destroy(): void
}

interface AmapApi {
  Map: new (element: HTMLElement, options: {
    viewMode: '2D'
    center: number[]
    zoom: number
    zooms: [number, number]
    dragEnable: boolean
    zoomEnable: boolean
    animateEnable: boolean
    resizeEnable: boolean
    keyboardEnable: boolean
    doubleClickZoom: boolean
    scrollWheel: boolean
    touchZoom: boolean
  }) => AmapInstance
}

const amapWindow = window as Window & {
  AMap?: AmapApi
  _AMapSecurityConfig?: { serviceHost?: string; securityJsCode?: string }
}

export const amapKey = import.meta.env.VITE_AMAP_KEY?.trim()
const serviceHost = import.meta.env.VITE_AMAP_SERVICE_HOST?.trim()
const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim()
export const amapConfigured = Boolean(amapKey && (serviceHost || securityJsCode))

let loading: Promise<AmapApi> | undefined

export function loadAmap(): Promise<AmapApi> {
  if (amapWindow.AMap) return Promise.resolve(amapWindow.AMap)
  if (loading) return loading

  amapWindow._AMapSecurityConfig = serviceHost
    ? { serviceHost: new URL(serviceHost, window.location.origin).href }
    : { securityJsCode }
  loading = new Promise<AmapApi>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      window.clearTimeout(timer)
      script.remove()
      reject(new Error('AMap JS API failed to load'))
    }
    const timer = window.setTimeout(fail, 15000)
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(amapKey)
    script.onload = () => {
      if (!amapWindow.AMap) return fail()
      window.clearTimeout(timer)
      resolve(amapWindow.AMap)
    }
    script.onerror = fail
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}

// GCJ-02 offset for mainland station coordinates displayed over AMap.
export function toGcj02(lon: number, lat: number): [number, number] {
  if (lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lon, lat]
  const x = lon - 105
  const y = lat - 35
  const pi = Math.PI
  const shared = 20 * (Math.sin(6 * x * pi) + Math.sin(2 * x * pi)) * 2 / 3
  const latDelta = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    + shared + (20 * Math.sin(y * pi) + 40 * Math.sin(y * pi / 3)) * 2 / 3
    + (160 * Math.sin(y * pi / 12) + 320 * Math.sin(y * pi / 30)) * 2 / 3
  const lonDelta = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    + shared + (20 * Math.sin(x * pi) + 40 * Math.sin(x * pi / 3)) * 2 / 3
    + (150 * Math.sin(x * pi / 12) + 300 * Math.sin(x * pi / 30)) * 2 / 3
  const radians = lat * pi / 180
  const eccentricity = 0.006693421622965943
  const magic = 1 - eccentricity * Math.sin(radians) ** 2
  const radius = 6378245
  return [
    lon + lonDelta * 180 * Math.sqrt(magic) / (radius * Math.cos(radians) * pi),
    lat + latDelta * 180 * magic ** 1.5 / (radius * (1 - eccentricity) * pi),
  ]
}
