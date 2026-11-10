import { WIGOS_API_BASE } from './wigos'

export type WmdrProcess = 'pywmdr-wigos-wmdr2-ets' | 'pywmdr-wmdr2-migrate'

export async function executeWmdrProcess(process: WmdrProcess, record: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${WIGOS_API_BASE}/processes/${process}/execution?f=json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'respond-sync' },
    body: JSON.stringify({ inputs: { record }, response: 'raw' }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error(`WMDR service HTTP ${response.status}`)
  if (response.status === 201 || response.status === 202) {
    throw new Error('Service returned an asynchronous job instead of a result. Please retry later.')
  }
  const result = await response.json()
  if (process === 'pywmdr-wigos-wmdr2-ets' && (!result.summary || !Array.isArray(result.tests))) {
    throw new Error('Invalid validation report')
  }
  if (process === 'pywmdr-wmdr2-migrate' && (result.type !== 'Feature' || !result.properties)) {
    throw new Error('Invalid WMDR2 conversion result')
  }
  return result
}
