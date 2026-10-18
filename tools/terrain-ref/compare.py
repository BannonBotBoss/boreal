# Side-by-side: real Kenora references vs the staged generator (seed 1400). Box-only tuning artefact; never shipped.
import numpy as np, rasterio, json
from PIL import Image, ImageDraw, ImageFont
from matplotlib.colors import LightSource
T = 256  # 256 x 30 m = 7.68 km: same ground footprint for every top-down panel
def hill(z, cell=30):
    ls = LightSource(azdeg=315, altdeg=40); return (ls.hillshade(z, vert_exag=3, dx=cell, dy=cell) * 255).astype(np.uint8)
dem = np.load('dem30.npy'); r0, c0 = (dem.shape[0] - T) // 2, (dem.shape[1] - T) // 2; dem = dem[r0:r0 + T, c0:c0 + T]
with rasterio.open('kenora_s2_tci.tif') as s: tci = s.read(); tci = np.moveaxis(tci, 0, -1)
R0, C0 = (tci.shape[0] - 768) // 2, (tci.shape[1] - 768) // 2; tci = tci[R0:R0 + 768, C0:C0 + 768]
gz = np.fromfile('game_z.bin', np.float32).reshape(T, T); soil = np.fromfile('game_soil.bin', np.uint8).reshape(T, T); ch = np.fromfile('game_chan.bin', np.uint8).reshape(T, T)
# Generator map: stage-3 classes coloured with Sentinel-2 TCI means per WorldCover class (forest over till/sand/clay, outcrop over bedrock).
pal = {0: '#31442d', 1: '#1d2f22', 2: '#1d2f22', 3: '#1d2f22', 4: '#283829', 5: '#192224'}
rgb = np.array([[int(pal[k][i:i + 2], 16) for i in (1, 3, 5)] for k in range(6)], np.uint8)[soil]
rgb[(ch == 1) & (soil != 5)] = (25, 34, 36)
sh = hill(gz)[..., None] / 255.; gmap = (rgb * (0.55 + 0.9 * sh)).clip(0, 255).astype(np.uint8)
# brighten both top-downs the same way so dark boreal tones read
def lift(a): a = a.astype(np.float32); return (255 * (a / 255) ** .6).clip(0, 255).astype(np.uint8)
P = 560
def panel(a, title):
    im = Image.fromarray(a).convert('RGB').resize((P, P), Image.LANCZOS) if a.shape[0] != P else Image.fromarray(a).convert('RGB')
    return im, title
def photo(path, title):
    im = Image.open(path).convert('RGB'); w, h = im.size; s = max(P / w, P / h); im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
    l, t = (im.width - P) // 2, (im.height - P) // 2; return im.crop((l, t, l + P, t + P)), title
rows = [
  [panel(lift(tci), 'REAL: Sentinel-2 L2A true colour, 30 Jul 2024 (7.68 km, N up)'), panel(lift(gmap), 'GAME: stage 1-3 generator map, seed 1400 (7.68 km)')],
  [panel(hill(dem), 'REAL: Copernicus GLO-30 hillshade (DSM, 3x exag.)'), panel(hill(gz), 'GAME: staged heightfield hillshade (3x exag.)')],
  [photo('photos/Lake_of_the_Woods_I0014906_jpg.jpg', 'REAL: Lake of the Woods shore (Archives of Ontario, OGL-ON)'), photo('/workspace/tmp/game-g3.png', 'GAME: ground view on a bedrock knob (headless Edge)')],
]
W, H = 2 * P + 30, len(rows) * (P + 40) + 70
out = Image.new('RGB', (W, H), (18, 20, 18)); d = ImageDraw.Draw(out)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17); fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: f = fb = ImageFont.load_default()
d.text((10, 12), 'Boreal staged terrain vs Kenora / Lake of the Woods references (tuning only, not shipped)', fill=(235, 235, 225), font=fb)
m = json.load(open('metrics_real.json')); g = json.load(open('m_fin.json'))
for r, row in enumerate(rows):
    for c, (im, t) in enumerate(row):
        x, y = 10 + c * (P + 10), 60 + r * (P + 40); d.text((x, y), t, fill=(220, 220, 200), font=f); out.paste(im, (x, y + 28))
out.save('/workspace/tmp/boreal-ref-compare.png'); print(out.size)
