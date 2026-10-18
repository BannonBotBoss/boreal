# Kenora reference metrics (metrics_real2.json) from the fetch.py rasters; torus=False: the real window does not wrap.
import numpy as np, json
from metrics import metrics
dem = np.load('dem30.npy').astype(np.float64); wc = np.load('wc30.npy')
r, _ = metrics(dem, wc == 80, 30.0, torus=False); print(json.dumps({k: r[k] for k in ('spectral_slope_beta','lakes_per_100km2','lake_ha_p50_p90_max','lake_elongation_p50','islands_per_100km2','islands_per_km2_water','small_lakes_lt10ha_frac','shoreline_development_p50','water_frac')}))
json.dump(r, open('metrics_real2.json', 'w'), indent=1)
