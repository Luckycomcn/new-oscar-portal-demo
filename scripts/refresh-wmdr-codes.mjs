#!/usr/bin/env node
/**
 * Regenerate src/data/programAffiliations.json from the authoritative WMO WMDR
 * codelist (https://codes.wmo.int/wmdr/ProgramAffiliation, CSV representation).
 *
 * Usage:
 *   node scripts/refresh-wmdr-codes.mjs                 # fetch the live codelist
 *   node scripts/refresh-wmdr-codes.mjs /path/to.csv   # use a local copy instead
 *
 * The generated file is committed so the demo also works without access to
 * codes.wmo.int and never depends on browser CORS for its filter options.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = 'https://codes.wmo.int/wmdr/ProgramAffiliation'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/programAffiliations.json')

// Identifiers returned by the catalogue that are not (yet) in the published
// codelist. Keep them so refreshing the codelist cannot remove an existing filter.
const LEGACY_CODES = [{ id: 'OceanSITES', title: 'OceanSITES' }]

/** Minimal RFC 4180 CSV reader (quoted fields may contain commas and quotes). */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

async function loadCsv() {
  const local = process.argv[2]
  if (local) return readFileSync(local, 'utf8')
  const response = await fetch(SOURCE, { headers: { Accept: 'text/csv' } })
  if (!response.ok) throw new Error(`${SOURCE} returned HTTP ${response.status}`)
  return response.text()
}

const csv = await loadCsv()
const [header, ...lines] = parseCsv(csv)
const col = Object.fromEntries(header.map((name, i) => [name.trim(), i]))

const codes = []
for (const row of lines) {
  const url = (row[col['@id']] ?? '').trim().replace(/^<|>$/g, '')
  if (!url.startsWith('http://codes.wmo.int/wmdr/ProgramAffiliation/')) continue
  const id = (row[col['skos:notation']] ?? '').trim() || url.split('/').pop()
  const title = (row[col['rdfs:label']] ?? '').trim() || id
  codes.push({ id, title })
}
if (codes.length < 100) throw new Error(`Only ${codes.length} concepts parsed; refusing to overwrite`)

for (const legacy of LEGACY_CODES) {
  if (!codes.some((c) => c.id === legacy.id)) codes.push(legacy)
}

// el-select uses the label as its key/value, so labels must be unique.
const counts = new Map()
for (const code of codes) counts.set(code.title, (counts.get(code.title) ?? 0) + 1)
for (const code of codes) {
  if (counts.get(code.title) > 1) code.title = `${code.title} (${code.id})`
}

codes.sort((a, b) => a.id.localeCompare(b.id, 'en', { sensitivity: 'base' }))
writeFileSync(OUT, `${JSON.stringify(codes, null, 2)}\n`)
console.log(`Wrote ${codes.length} programme/network affiliations to ${OUT}`)
