/** Minimal store-only ZIP writer (no compression; PNGs are already compressed). */
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(data: Uint8Array) { let c = 0xffffffff; for (const b of data) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0;
  const header = (size: number, fill: (v: DataView) => void) => { const b = new Uint8Array(size); fill(new DataView(b.buffer)); return b; };
  for (const f of files) {
    const name = new TextEncoder().encode(f.name), crc = crc32(f.data), n = f.data.length;
    const common = (v: DataView, o: number) => { v.setUint16(o, 20, true); v.setUint32(o + 10, crc, true); v.setUint32(o + 14, n, true); v.setUint32(o + 18, n, true); v.setUint16(o + 22, name.length, true); };
    const local = header(30, v => { v.setUint32(0, 0x04034b50, true); common(v, 4); v.setUint16(6, 0x0800, true); v.setUint16(12, 0x21, true); }); // date 1980-01-01
    parts.push(local, name, f.data);
    central.push(header(46, v => { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); common(v, 6); v.setUint16(8, 0x0800, true); v.setUint16(14, 0x21, true); v.setUint32(42, offset, true); }), name);
    offset += 30 + name.length + n;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = header(22, v => { v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true); v.setUint32(12, size, true); v.setUint32(16, offset, true); });
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
  let p = 0; for (const b of all) { out.set(b, p); p += b.length; }
  return out;
}
