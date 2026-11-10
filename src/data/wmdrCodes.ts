import type { StationDomain } from './stations'
import variableTreeRaw from './variableTree.json'
import { findTerritoryId, territories, territoryById, type WmdrTerritory } from './wmdrTerritories'

export { findTerritoryId, territories, territoryById }
export type { WmdrTerritory }

export interface WmdrCode {
  id: string
  title: string
}

export interface FacilityTypeCode extends WmdrCode {
  domain: StationDomain
}

/**
 * WMDR2 FacilityType code list (https://codes.wmo.int/wmdr/FacilityType).
 * `domain` maps the code to the colour buckets used by the OpenLayers map.
 */
export const facilityTypes: FacilityTypeCode[] = [
  { id: 'landFixed', title: 'Land (fixed)', domain: 'land-ocean' },
  { id: 'landMobile', title: 'Land (mobile)', domain: 'land-ocean' },
  { id: 'landOnIce', title: 'Land (on ice)', domain: 'land-ocean' },
  { id: 'seaFixed', title: 'Sea (fixed)', domain: 'land-ocean' },
  { id: 'seaMobile', title: 'Sea (mobile)', domain: 'land-ocean' },
  { id: 'seaOnIce', title: 'Sea (on ice)', domain: 'land-ocean' },
  { id: 'lakeRiverFixed', title: 'Lake/River (fixed)', domain: 'lake' },
  { id: 'lakeRiverMobile', title: 'Lake/River (mobile)', domain: 'lake' },
  { id: 'underwaterFixed', title: 'Underwater (fixed)', domain: 'subsurface' },
  { id: 'underwaterMobile', title: 'Underwater (mobile)', domain: 'subsurface' },
  { id: 'airFixed', title: 'Air (fixed)', domain: 'air' },
  { id: 'airMobile', title: 'Air (mobile)', domain: 'air' },
  { id: 'spaceBased', title: 'Space-based', domain: 'air' },
  { id: 'unknown', title: 'unknown', domain: 'land-ocean' },
]

const facilityTypeIndex = new Map(facilityTypes.map((t) => [t.id.toLowerCase(), t]))

export function facilityTypeCode(id?: string | null): FacilityTypeCode | undefined {
  if (!id) return undefined
  return facilityTypeIndex.get(id.toLowerCase())
}

export function facilityTypeTitle(id?: string | null): string {
  return facilityTypeCode(id)?.title ?? ''
}

export function facilityTypeDomain(id?: string | null): StationDomain {
  return facilityTypeCode(id)?.domain ?? 'land-ocean'
}

export function facilityTypeIdByTitle(title: string): string | undefined {
  const needle = title.trim().toLowerCase()
  return facilityTypes.find((t) => t.title.toLowerCase() === needle || t.id.toLowerCase() === needle)?.id
}

export const wmoRegions: WmdrCode[] = [
  { id: 'africa', title: 'Africa' },
  { id: 'asia', title: 'Asia' },
  { id: 'europe', title: 'Europe' },
  { id: 'northCentralAmericaCaribbean', title: 'North America, Central America and the Caribbean' },
  { id: 'southAmerica', title: 'South America' },
  { id: 'southWestPacific', title: 'South-West Pacific' },
  { id: 'antarctica', title: 'Antarctica' },
  { id: 'inapplicable', title: 'inapplicable' },
  { id: 'unknown', title: 'unknown' },
]

const wmoRegionIndex = new Map(wmoRegions.map((r) => [r.id.toLowerCase(), r.title]))

export function wmoRegionTitle(id?: string | null): string {
  if (!id) return ''
  return wmoRegionIndex.get(id.toLowerCase()) ?? id
}

/**
 * Program affiliations that currently exist in the WIGOS observing facility catalogue.
 * Curated from https://codes.wmo.int/wmdr/ProgramAffiliation.
 */
export const programAffiliations: WmdrCode[] = [
  { id: 'GOSGeneral', title: 'GOS General' },
  { id: 'GBON', title: 'GBON' },
  { id: 'RBON', title: 'RBON' },
  { id: 'RBSN', title: 'RBSN' },
  { id: 'GSN', title: 'GSN' },
  { id: 'GUAN', title: 'GUAN' },
  { id: 'GTOS', title: 'GTOS' },
  { id: 'GDP', title: 'Global Drifter Program (GDP)' },
  { id: 'OceanSITES', title: 'OceanSITES' },
  { id: 'ANTONs', title: 'ANTON(S)' },
  { id: 'ANTONt', title: 'ANTON(T)' },
  { id: 'AGAGE', title: 'AGAGE' },
  { id: 'AERONET', title: 'AERONET' },
  { id: 'EANET', title: 'EANET' },
  { id: 'NDACC', title: 'NDACC' },
  { id: 'TCCON', title: 'TCCON' },
  { id: 'ICOS', title: 'ICOS' },
  { id: 'GRUAN', title: 'GRUAN' },
  { id: 'AMDAR', title: 'AMDAR' },
]

const programIndex = new Map(programAffiliations.map((p) => [p.id.toLowerCase(), p.title]))

export function programTitle(id?: string | null): string {
  if (!id) return ''
  return programIndex.get(id.toLowerCase()) ?? id
}

export function programIdByTitle(title: string): string | undefined {
  const needle = title.trim().toLowerCase()
  return programAffiliations.find((p) => p.title.toLowerCase() === needle || p.id.toLowerCase() === needle)?.id
}

interface VariableNode {
  id: number
  text: string
  children?: VariableNode[]
}

export interface VariableInfo {
  id: number
  name: string
  category: string
  path: string
}

let variableIndex: Map<number, VariableInfo> | null = null

function walkVariables(nodes: VariableNode[], path: string[], category: string, out: Map<number, VariableInfo>) {
  for (const node of nodes) {
    const nextPath = [...path, node.text]
    const nextCategory = category || node.text
    if (!out.has(node.id)) {
      out.set(node.id, { id: node.id, name: node.text, category: nextCategory, path: nextPath.join(' > ') })
    }
    if (node.children?.length) walkVariables(node.children, nextPath, nextCategory, out)
  }
}

/** Observed-property ids (WMDR) resolved to names via the bundled OSCAR variable tree. */
export function variableIndexMap(): Map<number, VariableInfo> {
  if (!variableIndex) {
    variableIndex = new Map()
    walkVariables(variableTreeRaw as VariableNode[], [], '', variableIndex)
  }
  return variableIndex
}

export function variableInfo(id?: string | number | null): VariableInfo | undefined {
  if (id == null || id === '') return undefined
  const numeric = Number(id)
  if (!Number.isFinite(numeric)) return undefined
  return variableIndexMap().get(numeric)
}

export function variableName(id?: string | number | null): string {
  return variableInfo(id)?.name ?? ''
}
