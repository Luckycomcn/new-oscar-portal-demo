export interface ExportJob {
  id: string
  name: string
  format: 'xml' | 'json'
  description: string
  updatedOn: string
  recordCount: number
}

export const exportJobs: ExportJob[] = [
  {
    id: 'stations-full',
    name: 'Station list (full)',
    format: 'json',
    description: 'All surface stations with WIGOS id, territory, type and declared status.',
    updatedOn: '2024-04-23',
    recordCount: 14,
  },
  {
    id: 'stations-gos',
    name: 'GOS network stations',
    format: 'xml',
    description: 'Stations affiliated to GOS, WIGOS identifiers included.',
    updatedOn: '2024-04-23',
    recordCount: 14,
  },
  {
    id: 'stations-meta',
    name: 'Station metadata dump',
    format: 'json',
    description: 'Full station metadata dump for offline analysis.',
    updatedOn: '2024-04-23',
    recordCount: 14,
  },
]
