import type { Station, StationDomain, StationStatus } from './stations'

function seeded(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453
  return x - Math.floor(x)
}

interface CloudBox {
  lon: [number, number]
  lat: [number, number]
  n: number
  region: string
}

// Same boxes as the homepage map used to paint — each dot now carries a demo station.
export const cloudBoxes: CloudBox[] = [
  { lon: [-130, -52], lat: [14, 72], n: 420, region: 'North America' },
  { lon: [-82, -34], lat: [-55, 12], n: 220, region: 'South America' },
  { lon: [-18, 40], lat: [35, 71], n: 520, region: 'Europe' },
  { lon: [-18, 52], lat: [-35, 35], n: 280, region: 'Africa' },
  { lon: [28, 150], lat: [8, 72], n: 640, region: 'Asia' },
  { lon: [95, 155], lat: [-45, -10], n: 140, region: 'Oceania' },
  { lon: [95, 140], lat: [-10, 20], n: 120, region: 'Maritime Continent' },
  { lon: [-50, 20], lat: [50, 78], n: 80, region: 'Arctic' },
  { lon: [-170, -130], lat: [50, 72], n: 40, region: 'Alaska' },
]

const domainCycle: StationDomain[] = ['air', 'land-ocean', 'land-ocean', 'land-ocean', 'subsurface', 'lake']

const typeByDomain: Record<StationDomain, string> = {
  air: 'Air (fixed)',
  'land-ocean': 'Land (fixed)',
  subsurface: 'Underwater (fixed)',
  lake: 'Lake/River (fixed)',
}

const programByDomain: Record<StationDomain, string> = {
  air: 'GAW',
  'land-ocean': 'GOS',
  subsurface: 'Argo',
  lake: 'WHOS',
}

function statusFor(i: number): StationStatus {
  const r = seeded(i + 501)
  if (r < 0.78) return 'Operational'
  if (r < 0.86) return 'Partly operational'
  if (r < 0.9) return 'Silent'
  if (r < 0.94) return 'Unknown'
  return 'Closed'
}

function buildDemoStations(): Station[] {
  const out: Station[] = []
  let i = 1
  for (const box of cloudBoxes) {
    for (let k = 0; k < box.n; k += 1) {
      i += 1
      const lon = box.lon[0] + seeded(i) * (box.lon[1] - box.lon[0])
      const lat = box.lat[0] + seeded(i + 99) * (box.lat[1] - box.lat[0])
      const domain = domainCycle[Math.floor(seeded(i + 17) * domainCycle.length)]
      const status = statusFor(i)
      const code = 10000 + out.length
      const program = programByDomain[domain]
      out.push({
        id: `demo-${out.length}`,
        name: `DEMO STATION ${code}`,
        wigosId: `0-20000-0-${code}`,
        lon,
        lat,
        type: typeByDomain[domain],
        domain,
        status,
        programs: `${program}:${status}`,
        established: `${1940 + Math.floor(seeded(i + 7) * 80)}-0${1 + Math.floor(seeded(i + 13) * 9)}-0${1 + Math.floor(seeded(i + 29) * 9)}`,
        country: box.region,
        className: 'Automatic weather station (AWS)',
      })
    }
  }
  return out
}

/** Every decorative map dot backed by a (demo) station so hover/click/search always has data. */
export const demoStations: Station[] = buildDemoStations()
