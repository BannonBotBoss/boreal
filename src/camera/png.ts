/** PNG tEXt metadata (PNG spec 11.3.4.3): chunks inserted right after IHDR, CRC-32 over type+data. */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b: Uint8Array) { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const latin1 = (s: string) => Uint8Array.from(s, ch => { const c = ch.charCodeAt(0); return c < 256 ? c : 63; });
export function textChunk(key: string, value: string) {
  const data = new Uint8Array([...latin1(key.slice(0, 79)), 0, ...latin1(value)]), out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); out.set(latin1('tEXt'), 4); out.set(data, 8); dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out;
}
export function addTextChunks(png: Uint8Array, entries: Record<string, string>) {
  const ihdrEnd = 8 + 12 + new DataView(png.buffer, png.byteOffset).getUint32(8), chunks = Object.entries(entries).map(([k, v]) => textChunk(k, v));
  const out = new Uint8Array(png.length + chunks.reduce((s, c) => s + c.length, 0)); out.set(png.subarray(0, ihdrEnd)); let o = ihdrEnd;
  for (const c of chunks) { out.set(c, o); o += c.length; } out.set(png.subarray(ihdrEnd), o); return out;
}
export function readTextChunks(png: Uint8Array) {
  const dv = new DataView(png.buffer, png.byteOffset), out: Record<string, string> = {}; let o = 8;
  while (o < png.length) { const len = dv.getUint32(o), type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    if (type === 'tEXt') { const d = png.subarray(o + 8, o + 8 + len), z = d.indexOf(0); out[String.fromCharCode(...d.subarray(0, z))] = String.fromCharCode(...d.subarray(z + 1)); }
    if (type === 'IEND') break; o += 12 + len; }
  return out;
}
