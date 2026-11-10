import { contacts, stations, type Station } from './stations'
import { demoStations } from './demoCloud'

export interface ReportProgram {
  prog: string
  pid: string
  aff: string
  declared: string
  assessed: string
}

export interface ReportObsItem {
  name: string
  tag: string
  variable: string
  purpose: string
  prog: string
  updated: string
  from: string
  inst: string
}

export interface ReportMock {
  name: string
  country: string
  region: string
  lastUpdated: string
  lastUpdatedBy: string
  stationType: string
  stationClass: string
  wsiNote: string
  assocWsi: string
  wigosIds: { id: string; primary: string }[]
  prevWsi: string
  prevGts: string
  localId: string
  coords: string
  lon: number
  lat: number
  org: string
  tz: string
  url: string
  site: string
  additional: string
  established: string
  closed: string
  declared: string
  assessed: string
  programs: ReportProgram[]
  operating: { n: string; op: string; t: string; f: string; to: string }[]
  obs: { cat: string; items: ReportObsItem[] }[]
  contactRole: string
  contactMain: string
  contactMail: string
  contactAddr: string
  contacts: string[]
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const regionByCountry: Record<string, string> = {
  'North America': 'IV',
  'South America': 'III',
  Europe: 'VI',
  Africa: 'I',
  Asia: 'II',
  Oceania: 'V',
  'Maritime Continent': 'V',
  Arctic: 'IV',
  Alaska: 'IV',
  China: 'II',
  Switzerland: 'VI',
  'United States (the)': 'IV',
  Australia: 'V',
  Kenya: 'I',
  Argentina: 'III',
  Canada: 'IV',
  Japan: 'II',
  France: 'VI',
  Egypt: 'I',
  India: 'II',
  Germany: 'VI',
  'United Kingdom (the)': 'VI',
}

const obsPool = [
  { cat: 'Clouds', name: 'Cloud amount (total cloud cover)', variable: 'Cloud amount', inst: 'HUMAN EYE' },
  { cat: 'Visibility (no precipitation)', name: 'Visibility', variable: 'Visibility', inst: 'HUMAN EYE' },
  { cat: 'Air temperature', name: 'Air temperature', variable: 'Air temperature', inst: 'MERCURY THERMOMETER' },
  { cat: 'Humidity', name: 'Relative humidity', variable: 'Relative humidity', inst: 'PSYCHROMETER' },
  { cat: 'Pressure', name: 'Atmospheric pressure', variable: 'Pressure', inst: 'BAROMETER' },
  { cat: 'Precipitation', name: 'Precipitation amount', variable: 'Precipitation', inst: 'RAINGAUGE' },
  { cat: 'Wind', name: 'Wind speed and direction', variable: 'Wind', inst: 'ANEMOMETER' },
  { cat: 'Soil', name: 'Soil temperature', variable: 'Soil temperature', inst: 'SOIL THERMOMETER' },
]

function fabricateFromId(wigosId: string): Station {
  const h = hashStr(wigosId)
  const tail = wigosId.split('-').pop() || '00000'
  const lon = ((h % 36000) / 100) - 180
  const lat = ((Math.floor(h / 36000) % 14000) / 100) - 60
  return {
    id: `unknown-${tail}`,
    name: `STATION ${tail}`,
    wigosId,
    lon,
    lat,
    type: ['Land (fixed)', 'Sea (fixed)', 'Air (fixed)', 'Lake/River (fixed)'][h % 4],
    domain: (['land-ocean', 'land-ocean', 'air', 'lake'] as Station['domain'][])[h % 4],
    status: (['Operational', 'Operational', 'Operational', 'Partly operational', 'Silent'] as Station['status'][])[h % 5],
    programs: 'GOS:Operational',
    established: `${1950 + (h % 70)}-01-01`,
    country: '(unknown)',
    className: 'Automatic weather station (AWS)',
  }
}

/** Deterministic per-station report data: same WIGOS ID always yields the same page. */
export function getStationDetails(wigosId: string): ReportMock {
  const found = [...stations, ...demoStations].find((s) => s.wigosId === wigosId)
  const st = found ?? fabricateFromId(wigosId || '0-20000-0-00000')
  const h = hashStr(st.wigosId)
  const tail = st.wigosId.split('-').pop() || '00000'
  const elev = (h % 3000) + (st.type.includes('Sea') || st.type.includes('Underwater') ? 0 : 5)
  const tzOff = Math.round(st.lon / 15)
  const progRows: ReportProgram[] = st.programs
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [name, declared] = p.split(':').map((s) => (s ?? '').trim())
      return {
        prog: `${name || 'GOS'} / ${name || 'GOS'}`,
        pid: tail,
        aff: 'Approved',
        declared: declared || st.status,
        assessed: h % 3 === 0 ? 'Unknown' : declared || st.status,
      }
    })
  const mainProg = progRows[0]?.prog.split('/')[0].trim() || 'GOS'
  const obsCount = 3 + (h % 3)
  const obsStart = h % obsPool.length
  const obs = Array.from({ length: obsCount }, (_, k) => {
    const v = obsPool[(obsStart + k) % obsPool.length]
    return {
      cat: v.cat,
      items: [
        {
          name: v.name,
          tag: '(measured/observed)',
          variable: v.variable,
          purpose: 'Synoptic',
          prog: mainProg,
          updated: `On ${2023 + (h % 3)}-0${1 + (h % 9)}-1${h % 10} by ${tail.slice(0, 3).toUpperCase()}-NDC`,
          from: st.established,
          inst: `Manufacturer: GENERIC | Model: ${v.inst} (demo)`,
        },
      ],
    }
  })
  const contactPool = contacts[h % contacts.length]
  const code3 = (st.name.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'DMO').toUpperCase()
  return {
    name: st.name.charAt(0) + st.name.slice(1).toLowerCase(),
    country: st.country,
    region: `${regionByCountry[st.country] ?? ['I', 'II', 'III', 'IV', 'V', 'VI'][h % 6]} - ${st.country}`,
    lastUpdated: `${2023 + (h % 3)}-0${1 + (h % 9)}-1${h % 10}`,
    lastUpdatedBy: `${code3}-NDC`,
    stationType: `${st.type} station (${st.className})`,
    stationClass: st.className,
    wsiNote: 'WSI adopted by the station',
    assocWsi: 'WIGOS Data Center: N/A',
    wigosIds: [{ id: st.wigosId, primary: 'operations' }],
    prevWsi: 'No previous WSI',
    prevGts: tail,
    localId: tail,
    coords: `${Math.abs(st.lat).toFixed(5)}${st.lat >= 0 ? 'N' : 'S'}, ${Math.abs(st.lon).toFixed(5)}${st.lon >= 0 ? 'E' : 'W'}, ${elev}m`,
    lon: st.lon,
    lat: st.lat,
    org: `${st.country} Meteorological Service (demo)`,
    tz: `UTC${tzOff >= 0 ? '+' : ''}${String(Math.abs(tzOff)).padStart(2, '0')}00`,
    url: 'N/A',
    site: `${st.type} site, surroundings typical for the region (demo)`,
    additional: `${st.type} station reporting routinely (demo).`,
    established: st.established,
    closed: st.status === 'Closed' ? `${2000 + (h % 24)}-12-31` : '(still operational)',
    declared: st.status,
    assessed: h % 3 === 0 ? 'Unknown' : st.status,
    programs: progRows.length ? progRows : [{ prog: 'GOS / GOS', pid: tail, aff: 'Approved', declared: st.status, assessed: st.status }],
    operating: [
      { n: `➤${mainProg}`, op: 'Operating', t: st.type, f: st.established, to: st.status === 'Closed' ? `${2000 + (h % 24)}-12-31` : '' },
      { n: `➤${tail}`, op: st.status, t: 'Operational', f: st.established, to: '' },
    ],
    obs,
    contactRole: 'Station contact',
    contactMain: contactPool.org,
    contactMail: contactPool.email,
    contactAddr: `${contactPool.country} (demo)`,
    contacts: [`Admin (Station Contact)`, `${contactPool.name}`, `${contactPool.name} (${contactPool.role})`],
  }
}
