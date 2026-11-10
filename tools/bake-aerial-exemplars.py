#!/usr/bin/env python3
"""Crop boreal cover samples and bake the Deliot & Heitz Gaussian lookup.

The photographs are USGS Imagery Only (NAIP), public domain, via The National Map.
Zoom 16 is about 1.6 m per pixel near 48 N. Each crop is a sample of one cover,
not a map of the game point. The Gaussian and the 256×4 lookup are the 1D histogram
transform from Deliot and Heitz, GPU Zen 2 (2019): per channel, rank to a Gaussian
of mean 0.5, and a table back to the original sRGB byte.

Water is a 64 px interior enlarged to 128 so every exemplar shares one world size.
"""
import math
import struct
import subprocess
import urllib.request
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "aerial"
Z = 16
# z, x, y, crop x, crop y, crop size. Tile URL is z/y/x.
CROPS = {
    "canopy": (16110, 22755, 32, 80, 128),
    "fen": (15947, 22835, 32, 16, 128),
    "shore": (15947, 22835, 48, 48, 128),
    "water": (16146, 22766, 16, 88, 64),
}
SIGMA = 0.15
URL = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"


def png_write(path: Path, w: int, h: int, rgb: bytes):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + rgb[y * w * 3:(y + 1) * w * 3] for y in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def erfinv(x: float) -> float:
    a = 0.147
    ln = math.log(max(1e-12, 1 - x * x))
    t = 2 / (math.pi * a) + ln / 2
    return math.copysign(math.sqrt(max(0.0, math.sqrt(t * t - ln / a) - t)), x)


def download(x: int, y: int) -> bytes:
    cache = Path(f"/tmp/naip/grid/{Z}-{x}-{y}.jpg")
    if cache.exists():
        return cache.read_bytes()
    url = URL.format(z=Z, y=y, x=x)
    req = urllib.request.Request(url, headers={"User-Agent": "boreal-exemplar/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(data)
    return data


def decode_jpg(data: bytes) -> bytes:
    proc = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], input=data, capture_output=True, check=True)
    return proc.stdout


def crop(raw: bytes, x0: int, y0: int, n: int, tile: int = 256) -> bytes:
    out = bytearray(n * n * 3)
    for y in range(n):
        for x in range(n):
            i = ((y0 + y) * tile + (x0 + x)) * 3
            o = (y * n + x) * 3
            out[o:o + 3] = raw[i:i + 3]
    return bytes(out)


def scale_nearest(rgb: bytes, n: int, dest: int) -> bytes:
    out = bytearray(dest * dest * 3)
    for y in range(dest):
        sy = min(n - 1, y * n // dest)
        for x in range(dest):
            sx = min(n - 1, x * n // dest)
            i = (sy * n + sx) * 3
            o = (y * dest + x) * 3
            out[o:o + 3] = rgb[i:i + 3]
    return bytes(out)


def gaussianize(rgb: bytes):
    n = len(rgb) // 3
    gauss = bytearray(n * 3)
    lut_rows = []
    for ch in range(3):
        vals = [rgb[i * 3 + ch] for i in range(n)]
        order = sorted(range(n), key=lambda i: vals[i])
        g = [0.0] * n
        bins = [[] for _ in range(256)]
        for rank, i in enumerate(order):
            u = (rank + 0.5) / n
            gv = 0.5 + SIGMA * math.sqrt(2) * erfinv(2 * u - 1)
            gv = min(1.0, max(0.0, gv))
            g[i] = gv
            bins[int(round(gv * 255))].append(vals[i])
        for i in range(n):
            gauss[i * 3 + ch] = int(round(g[i] * 255))
        row = [0] * 256
        last = bins[0][0] if bins[0] else vals[order[0]]
        for i in range(256):
            if bins[i]:
                last = int(round(sum(bins[i]) / len(bins[i])))
            row[i] = last
        # fill leading empties from the first occupied bin
        first = next(i for i in range(256) if bins[i])
        for i in range(first):
            row[i] = row[first]
        lut_rows.append(row)
    lut = bytearray(256 * 3)
    for i in range(256):
        lut[i * 3] = lut_rows[0][i]
        lut[i * 3 + 1] = lut_rows[1][i]
        lut[i * 3 + 2] = lut_rows[2][i]
    return bytes(gauss), bytes(lut)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "source").mkdir(exist_ok=True)
    n = 2 ** Z
    y = CROPS["canopy"][1]
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 0.5) / n))))
    mpp = 156543.03392 * math.cos(math.radians(lat)) / n
    metres = 128 * mpp
    luts = []
    names = ("canopy", "fen", "shore", "water")
    for name in names:
        x, y, cx, cy, size = CROPS[name]
        raw = decode_jpg(download(x, y))
        sample = crop(raw, cx, cy, size)
        if size != 128:
            sample = scale_nearest(sample, size, 128)
        png_write(OUT / "source" / f"{name}.png", 128, 128, sample)
        gauss, lut = gaussianize(sample)
        png_write(OUT / f"{name}.png", 128, 128, gauss)
        luts.append(lut)
    sheet = bytearray(256 * 4 * 3)
    for row, lut in enumerate(luts):
        sheet[row * 256 * 3:(row + 1) * 256 * 3] = lut
    png_write(OUT / "lut.png", 256, 4, bytes(sheet))
    meta = {
        "metres": round(metres, 3),
        "metresPerPixel": round(mpp, 4),
        "pixels": 128,
        "latitudeDeg": round(lat, 4),
        "zoom": Z,
        "gainNote": "Shader uniform uExGain. The bake does not scale the photograph.",
        "licence": "Public domain. USGS Imagery Only (NAIP), The National Map.",
        "service": "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer",
        "note": "Samples of boreal cover in northern Minnesota. Not a map of the game point, and not Kenora.",
        "crops": {k: {"x": v[0], "y": v[1], "cropX": v[2], "cropY": v[3], "cropPx": v[4]} for k, v in CROPS.items()},
    }
    (OUT / "meta.json").write_text(__import__("json").dumps(meta, indent=2) + "\n")
    print(f"metres {metres:.2f} mpp {mpp:.3f} lat {lat:.3f}")


if __name__ == "__main__":
    main()
