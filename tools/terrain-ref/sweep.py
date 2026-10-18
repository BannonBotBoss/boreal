import subprocess, json, sys, os, shutil, tempfile, numpy as np
# usage: SEED=1400 python sweep.py '{"lakeMinDepth":12}' ...  (ELEVP JSON overrides ELEV; one line of metrics per config)
from metrics import metrics
from beta import bands
K = ['spectral_slope_beta','lakes_per_100km2','water_frac','lake_ha_p50_p90_max','lake_elongation_p50','islands_per_100km2','small_lakes_lt10ha_frac','frac_land_slope_gt_0.129','anisotropy_coherence','gradient_dir_deg_from_E_ccw','local_relief_1km_mean_m','shoreline_development_p50']
for i, cfg in enumerate(sys.argv[1:]):
    f = os.path.join(tempfile.gettempdir(), f'sw{i}.bin'); subprocess.run([shutil.which('npx') or 'npx', 'tsx', 'tools/terrain-ref/export.ts', os.environ.get('SEED','1400'), f], cwd=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'), env={**os.environ, 'ELEVP': cfg}, check=True, capture_output=True)
    b = open(f, 'rb').read(); n, cell = np.frombuffer(b[:8], np.int32); N = n * n
    z = np.frombuffer(b[8:8 + 4 * N], np.float32).reshape(n, n); zf = np.frombuffer(b[8 + 4 * N:8 + 8 * N], np.float32).reshape(n, n); w = np.frombuffer(b[8 + 8 * N:8 + 9 * N], np.uint8).reshape(n, n).astype(bool)
    r, _ = metrics(np.where(w, zf, z).astype(np.float64), w, float(cell))
    r['beta_bands']=bands(np.where(w, zf, z).astype(np.float64)); print(cfg, 'L%.0f med%.1f p90%.0f el%.2f isl%.0f sm%.2f wat%.2f sl%.3f beta%.2f %s coh%.2f rel%.0f' % (r['lakes_per_100km2'], r['lake_ha_p50_p90_max'][0], r['lake_ha_p50_p90_max'][1], r['lake_elongation_p50'], r['islands_per_100km2'], r['small_lakes_lt10ha_frac'], r['water_frac'], r['frac_land_slope_gt_0.129'], r['spectral_slope_beta'], r['beta_bands'], r['anisotropy_coherence'], r['local_relief_1km_mean_m']), flush=True)
    continue
    print(cfg, {k: (round(r[k], 3) if isinstance(r[k], float) else [round(x, 1) for x in r[k]]) for k in K}, 'bands', bands(np.where(w, zf, z).astype(np.float64)), flush=True)
