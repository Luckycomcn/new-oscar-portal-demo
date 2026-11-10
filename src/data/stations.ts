export type StationDomain = 'air' | 'land-ocean' | 'subsurface' | 'lake'
export type StationStatus = 'Operational' | 'Partly operational' | 'Closed' | 'Silent' | 'Unknown'

export interface Station {
  id: string
  name: string
  wigosId: string
  lon: number
  lat: number
  type: string
  domain: StationDomain
  status: StationStatus
  programs: string
  established: string
  country: string
  className: string
}

export const domainColors: Record<StationDomain, string> = {
  air: '#a349a4',
  'land-ocean': '#0080ff',
  subsurface: '#b5e61d',
  lake: '#ff7f27',
}

export const stations: Station[] = [
  { id: 'nanyang', name: 'NANYANG', wigosId: '0-20000-0-57178', lon: 112.53, lat: 33.0, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GBON:Operational, RBON:Operational, RBSN(ST) - deprecated:Closed', established: '1934-01-01', country: 'China', className: 'Synoptic land station (SYNOP)' },
  { id: 'geneva', name: 'GENEVA / COINTRIN', wigosId: '0-20000-0-06700', lon: 6.127, lat: 46.247, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GOS:Operational, GBON:Operational', established: '1959-01-01', country: 'Switzerland', className: 'Aeronautical meteorological station' },
  { id: 'payern', name: 'PAYERNE', wigosId: '0-20000-0-06610', lon: 6.942, lat: 46.812, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GUAN:Operational, GCOS:Operational', established: '1942-01-01', country: 'Switzerland', className: 'Upper-air station' },
  { id: 'jungfrau', name: 'JUNGFRAUJOCH', wigosId: '0-20000-0-06730', lon: 7.985, lat: 46.548, type: 'Land (fixed)', domain: 'air', status: 'Operational', programs: 'GAW:Operational', established: '1937-01-01', country: 'Switzerland', className: 'GAW Global Station' },
  { id: 'mauna', name: 'MAUNA LOA', wigosId: '0-20000-0-91165', lon: -155.576, lat: 19.536, type: 'Land (fixed)', domain: 'air', status: 'Operational', programs: 'GAW:Operational, GCOS:Operational', established: '1958-01-01', country: 'United States (the)', className: 'GAW Global Station' },
  { id: 'sydney', name: 'SYDNEY AIRPORT', wigosId: '0-20000-0-94767', lon: 151.177, lat: -33.946, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GOS:Operational', established: '1939-01-01', country: 'Australia', className: 'Aeronautical meteorological station' },
  { id: 'nairobi', name: 'NAIROBI / DAGORETTI', wigosId: '0-20000-0-63740', lon: 36.75, lat: -1.3, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GOS:Operational, GBON:Operational', established: '1957-01-01', country: 'Kenya', className: 'Synoptic land station (SYNOP)' },
  { id: 'buenos', name: 'BUENOS AIRES OBSERVATORIO', wigosId: '0-20000-0-87585', lon: -58.381, lat: -34.608, type: 'Land (fixed)', domain: 'land-ocean', status: 'Partly operational', programs: 'GOS:Partly operational', established: '1906-01-01', country: 'Argentina', className: 'Climatological station' },
  { id: 'alert', name: 'ALERT', wigosId: '0-20000-0-71082', lon: -62.338, lat: 82.5, type: 'Land (fixed)', domain: 'air', status: 'Operational', programs: 'GAW:Operational, GCOS:Operational', established: '1950-01-01', country: 'Canada', className: 'GAW Global Station' },
  { id: 'mcmurdo', name: 'MCMURDO', wigosId: '0-20000-0-89664', lon: 166.67, lat: -77.85, type: 'Land (on ice)', domain: 'land-ocean', status: 'Operational', programs: 'ANTON:Operational', established: '1956-01-01', country: 'United States (the)', className: 'Antarctic meteorological station' },
  { id: 'tokyo', name: 'TOKYO', wigosId: '0-20000-0-47662', lon: 139.76, lat: 35.69, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GOS:Operational, GBON:Operational', established: '1875-01-01', country: 'Japan', className: 'Synoptic land station (SYNOP)' },
  { id: 'capegrim', name: 'CAPE GRIM', wigosId: '0-20000-0-94954', lon: 144.688, lat: -40.683, type: 'Land (fixed)', domain: 'air', status: 'Operational', programs: 'GAW:Operational, AGAGE:Operational', established: '1976-01-01', country: 'Australia', className: 'GAW Global Station' },
  { id: 'argos', name: 'ARGO FLOAT 6901234', wigosId: '0-22000-0-6901234', lon: -30.2, lat: 25.1, type: 'Sea (mobile)', domain: 'subsurface', status: 'Operational', programs: 'Argo:Operational', established: '2018-06-01', country: 'France', className: 'Ocean profiling float' },
  { id: 'buoy', name: 'TAO BUOY 0N 165E', wigosId: '0-22000-0-51028', lon: 165.0, lat: 0.0, type: 'Sea (fixed)', domain: 'land-ocean', status: 'Silent', programs: 'TAO:Silent', established: '1993-01-01', country: 'United States (the)', className: 'Ocean moored buoy' },
  { id: 'rhine', name: 'BASEL RHEINHALLE', wigosId: '0-20000-0-06601', lon: 7.59, lat: 47.56, type: 'Lake/River (fixed)', domain: 'lake', status: 'Operational', programs: 'WHOS:Operational', established: '1990-01-01', country: 'Switzerland', className: 'Hydrological station' },
  { id: 'cairo', name: 'CAIRO AIRPORT', wigosId: '0-20000-0-62366', lon: 31.4, lat: 30.13, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GOS:Operational', established: '1945-01-01', country: 'Egypt', className: 'Aeronautical meteorological station' },
  { id: 'delhi', name: 'NEW DELHI / SAFDARJUNG', wigosId: '0-20000-0-42182', lon: 77.21, lat: 28.58, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GOS:Operational, GBON:Operational', established: '1928-01-01', country: 'India', className: 'Synoptic land station (SYNOP)' },
  { id: 'ship', name: 'RV METEOR', wigosId: '0-20008-0-DBBH', lon: -18.4, lat: 32.7, type: 'Sea (mobile)', domain: 'land-ocean', status: 'Operational', programs: 'VOS:Operational', established: '1986-01-01', country: 'Germany', className: 'Ship meteorological station' },
  { id: 'beijing', name: 'BEIJING', wigosId: '0-20000-0-54511', lon: 116.47, lat: 39.8, type: 'Land (fixed)', domain: 'land-ocean', status: 'Operational', programs: 'GOS:Operational, GBON:Operational, RBON:Operational', established: '1912-01-01', country: 'China', className: 'Synoptic land station (SYNOP)' },
  { id: 'closedst', name: 'OLD LONDON WEATHER CENTRE', wigosId: '0-20000-0-03779', lon: -0.12, lat: 51.51, type: 'Land (fixed)', domain: 'land-ocean', status: 'Closed', programs: 'GOS:Closed', established: '1959-01-01', country: 'United Kingdom (the)', className: 'Synoptic land station (SYNOP)' },
]

export const stationTypes = [
  'Air (fixed)',
  'Air (mobile)',
  'Lake/River (fixed)',
  'Lake/River (mobile)',
  'Land (fixed)',
  'Land (mobile)',
  'Land (on ice)',
  'Sea (fixed)',
  'Sea (mobile)',
  'Sea (on ice)',
  'Underwater (fixed)',
  'Underwater (mobile)',
]

export const stationClasses = [
  'Agricultural meteorological station',
  'Aircraft meteorological station',
  'Automatic weather station (AWS)',
  'Climatological station',
  'Cryosphere station',
  'GAW Global Station',
  'Hydrological station',
  'Ocean moored buoy',
  'Ocean profiling float',
  'Ship meteorological station',
  'Synoptic land station (SYNOP)',
  'Upper-air station',
  'Aeronautical meteorological station',
]

export const programs = ['GBON', 'RBON', 'GOS', 'GAW', 'GCOS', 'GUAN', 'WHOS', 'Argo', 'TAO', 'VOS', 'ANTON', 'AGAGE']

export const countries = {
  states: [
    'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Chile',
    'China', 'Colombia', 'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Ghana', 'Greece',
    'India', 'Indonesia', 'Ireland', 'Italy', 'Japan', 'Kenya', 'Mexico', 'Netherlands', 'New Zealand', 'Nigeria',
    'Norway', 'Poland', 'Portugal', 'Russian Federation', 'South Africa', 'Spain', 'Sweden', 'Switzerland',
    'Thailand', 'Türkiye', 'United Kingdom (the)', 'United States (the)', 'Viet Nam',
  ],
  territories: ['French Polynesia', 'Hong Kong, China', 'Macao, China', 'New Caledonia'],
  other: ['Bermuda', 'Greenland', 'Puerto Rico', '(unknown)'],
}

export const contacts = [
  { name: 'Anna Meier', org: 'MeteoSwiss', country: 'Switzerland', email: 'anna.meier@example.org', role: 'National Focal Point' },
  { name: 'Wei Zhang', org: 'CMA', country: 'China', email: 'wei.zhang@example.org', role: 'Metadata Editor' },
  { name: 'James Carter', org: 'NOAA', country: 'United States (the)', email: 'james.carter@example.org', role: 'Station Contact' },
  { name: 'Amina Njoroge', org: 'KMD', country: 'Kenya', email: 'amina.njoroge@example.org', role: 'Program Focal Point' },
]

export const clusters = [
  { name: 'Alpine GAW cluster', stations: 12, country: 'Switzerland' },
  { name: 'Pacific TAO array', stations: 55, country: 'United States (the)' },
  { name: 'East Asia GBON core', stations: 84, country: 'China' },
]

export const instruments = [
  { name: 'Vaisala RS41-SG', type: 'Radiosonde', stations: 140 },
  { name: 'Campbell Scientific CR1000', type: 'Datalogger', stations: 62 },
  { name: 'Kipp & Zonen CMP21', type: 'Pyranometer', stations: 28 },
]

export const references = [
  { title: 'Manual on the WMO Integrated Global Observing System', year: '2019', id: 'WMO-No. 1160' },
  { title: 'WIGOS Metadata Standard', year: '2019', id: 'WMO-No. 1192' },
]
