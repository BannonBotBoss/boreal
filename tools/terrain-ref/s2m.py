import json, rasterio, numpy as np
from rasterio.merge import merge
from rasterio.warp import transform_bounds
from PIL import Image
b = json.load(open('bounds.json'))
hrefs = ['https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/15/U/UR/2024/7/S2B_15UUR_20240730_0_L2A/TCI.tif',
         'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/15/U/VR/2024/7/S2B_15UVR_20240730_0_L2A/TCI.tif']
srcs = [rasterio.open('/vsicurl/' + h) for h in hrefs]
bb = transform_bounds('EPSG:4326', srcs[0].crs, b['W'], b['S'], b['E'], b['N'])
a, t = merge(srcs, bounds=bb, nodata=0)
prof = srcs[0].profile; prof.update(width=a.shape[2], height=a.shape[1], transform=t, driver='GTiff', tiled=False, compress='deflate')
with rasterio.open('kenora_s2_tci.tif', 'w', **prof) as d: d.write(a)
Image.fromarray(np.moveaxis(a, 0, -1)).save('kenora_s2_tci.png')
json.dump({'items': ['S2B_15UUR_20240730_0_L2A', 'S2B_15UVR_20240730_0_L2A'], 'hrefs': hrefs}, open('s2_item.json', 'w'))
print(a.shape, (a.sum(0) == 0).mean())
Image.fromarray(np.moveaxis(a, 0, -1)).resize((760, 760)).save('s2_small.png')
