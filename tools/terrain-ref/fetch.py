import rasterio, numpy as np, json, urllib.request
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds
# 15 km x 15 km window east of Kenora (Shield uplands + Lake of the Woods / Winnipeg R. lakes)
lat0, lon0 = 49.735, -94.38
dlat = 7.5/111.0; dlon = 7.5/(111.0*np.cos(np.radians(lat0)))
W, S, E, N = lon0-dlon, lat0-dlat, lon0+dlon, lat0+dlat
json.dump(dict(W=W,S=S,E=E,N=N), open('bounds.json','w'))
dem_url = '/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N49_00_W095_00_DEM/Copernicus_DSM_COG_10_N49_00_W095_00_DEM.tif'
with rasterio.open(dem_url) as src:
    win = from_bounds(W,S,E,N, src.transform); a = src.read(1, window=win); t = src.window_transform(win)
    prof = src.profile; prof.update(width=a.shape[1], height=a.shape[0], transform=t, driver='GTiff', tiled=False, compress='deflate')
    with rasterio.open('kenora_dem_glo30.tif','w',**prof) as d: d.write(a,1)
print('dem', a.shape, a.min(), a.max())
wc_url = '/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N48W096_Map.tif'
with rasterio.open(wc_url) as src:
    win = from_bounds(W,S,E,N, src.transform); a = src.read(1, window=win); t = src.window_transform(win)
    prof = src.profile; prof.update(width=a.shape[1], height=a.shape[0], transform=t, driver='GTiff', tiled=False, compress='deflate')
    with rasterio.open('kenora_worldcover2021.tif','w',**prof) as d: d.write(a,1)
print('wc', a.shape, np.unique(a, return_counts=True))
