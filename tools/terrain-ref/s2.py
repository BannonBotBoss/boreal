import json, urllib.request, rasterio, numpy as np
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
b = json.load(open('bounds.json'))
q = {"collections":["sentinel-2-l2a"],"bbox":[b['W'],b['S'],b['E'],b['N']],"datetime":"2023-06-15T00:00:00Z/2025-09-15T00:00:00Z","limit":50,"query":{"eo:cloud_cover":{"lt":2}}}
r = urllib.request.Request('https://earth-search.aws.element84.com/v1/search', data=json.dumps(q).encode(), headers={'Content-Type':'application/json'})
items = json.load(urllib.request.urlopen(r))['features']
items = [i for i in items if i['properties']['datetime'][5:7] in ('06','07','08')]
items = [i for i in items if (i['properties'].get('s2:nodata_pixel_percentage') or 0) < 5]; items.sort(key=lambda i: i['properties']['eo:cloud_cover'])
for i in items[:5]: print(i['id'], i['properties']['eo:cloud_cover'], i['properties'].get('s2:nodata_pixel_percentage'))
it = items[0]; url = '/vsicurl/' + it['assets']['visual']['href']
with rasterio.open(url) as src:
    bb = transform_bounds('EPSG:4326', src.crs, b['W'],b['S'],b['E'],b['N'])
    win = from_bounds(*bb, src.transform); a = src.read(window=win); t = src.window_transform(win)
    prof = src.profile; prof.update(width=a.shape[2], height=a.shape[1], transform=t, driver='GTiff', tiled=False, compress='deflate')
    with rasterio.open('kenora_s2_tci.tif','w',**prof) as d: d.write(a)
from PIL import Image
Image.fromarray(np.moveaxis(a,0,-1)).save('kenora_s2_tci.png')
json.dump({'id': it['id'], 'datetime': it['properties']['datetime'], 'href': it['assets']['visual']['href']}, open('s2_item.json','w'))
print(a.shape, it['id'])
