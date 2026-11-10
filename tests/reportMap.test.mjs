import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as pdfLib from 'pdf-lib'

const dependency = new vm.SyntheticModule(Object.keys(pdfLib), function () {
  for (const key of Object.keys(pdfLib)) this.setExport(key, pdfLib[key])
})
const source = await readFile('src/utils/reportMap.ts', 'utf8')
const module = new vm.SourceTextModule(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText, { initializeImportMeta(meta) { meta.env = { BASE_URL: '/' } } })
await module.link(() => dependency)
await module.evaluate()
const original = await pdfLib.PDFDocument.create()
original.addPage([400, 600])
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const bytes = await module.namespace.appendStationMap((await original.save()).buffer, png, '0-22000-0-7810046')
const result = await pdfLib.PDFDocument.load(bytes)
assert.equal(result.getPageCount(), 2)
assert.equal(result.getPage(0).getWidth(), 400)
const images = result.getPage(1).node.Resources().lookup(pdfLib.PDFName.of('XObject'))
assert.ok(images.keys().length > 0, 'Map page must contain an embedded image')
await assert.rejects(module.namespace.renderStationMap({ geometry: null }), /coordinates/)
console.log('PASS: original PDF retained, map page appended, image embedded, missing coordinates rejected')
