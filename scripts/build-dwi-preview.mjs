import { readFileSync, writeFileSync } from 'node:fs'

const input = new URL('../Datas/dwi/tracks_50k.tck', import.meta.url)
const output = new URL('../Datas/dwi/tracks_5k_preview.bin', import.meta.url)
const source = readFileSync(input)
const headerEnd = source.indexOf(Buffer.from('END\n'))
if (headerEnd < 0) throw new Error('Invalid TCK header')
const header = source.subarray(0, headerEnd + 4).toString('utf8')
const offset = Number(header.match(/file:\s+\.\s+(\d+)/)?.[1])
if (!offset) throw new Error('Missing TCK data offset')

const selected = []
let points = []
let streamlineIndex = 0
for (let byte = offset; byte + 12 <= source.length; byte += 12) {
  const x = source.readFloatLE(byte)
  const y = source.readFloatLE(byte + 4)
  const z = source.readFloatLE(byte + 8)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    if (Number.isNaN(x)) {
      if (points.length > 1) selected.push(points)
      streamlineIndex++
      points = []
      continue
    }
    break
  }
  if (streamlineIndex % 10 === 0) points.push([x, z, -y])
}

const byteLength = 8 + selected.reduce((sum, line) => sum + 4 + line.length * 12, 0)
const target = Buffer.allocUnsafe(byteLength)
let cursor = 0
target.write('DWIP', cursor); cursor += 4
target.writeUInt32LE(selected.length, cursor); cursor += 4
for (const line of selected) {
  target.writeUInt32LE(line.length, cursor); cursor += 4
  for (const point of line) {
    for (const value of point) { target.writeFloatLE(value, cursor); cursor += 4 }
  }
}
writeFileSync(output, target)
console.log(`Wrote ${selected.length} streamlines (${(target.length / 1024 / 1024).toFixed(2)} MB)`) 
