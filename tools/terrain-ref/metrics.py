import numpy as np
from scipy import ndimage as ndi
def metrics(z, water, cell=30.0, tag=''):
    r = {}
    land = ~water
    lake = np.percentile(z[water], 50) if water.any() else z.min()
    r['elev_range_m'] = float(z.max() - z.min()); r['p05_p95_m'] = float(np.percentile(z, 95) - np.percentile(z, 5))
    r['land_above_lake_p50_p90_p99_m'] = [float(np.percentile(z[land] - lake, q)) for q in (50, 90, 99)]
    k = int(1000 / cell)
    mx = ndi.maximum_filter(z, k, mode='wrap'); mn = ndi.minimum_filter(z, k, mode='wrap'); r['local_relief_1km_mean_m'] = float((mx - mn).mean()); r['local_relief_1km_p90_m'] = float(np.percentile(mx - mn, 90))
    gy, gx = np.gradient(z, cell); s = np.hypot(gx, gy)
    r['slope_land_mean'] = float(s[land].mean()); r['slope_land_p90'] = float(np.percentile(s[land], 90)); r['frac_land_slope_gt_0.129'] = float((s[land] > .129).mean())
    # structure tensor orientation of land gradients (dominant ridge strike = gradient direction + 90)
    Jxx, Jyy, Jxy = (gx[land] ** 2).mean(), (gy[land] ** 2).mean(), (gx[land] * gy[land]).mean()
    ang = .5 * np.degrees(np.arctan2(2 * Jxy, Jxx - Jyy)); coh = np.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy ** 2) / (Jxx + Jyy)
    r['gradient_dir_deg_from_E_ccw'] = float(ang); r['ridge_strike_deg_azimuth'] = float((90 - (ang + 90)) % 180); r['anisotropy_coherence'] = float(coh)
    # characteristic wavelength from radially averaged power spectrum of detrended z
    zz = z - ndi.gaussian_filter(z, 2000 / cell) if z.shape[0] > 200 else z - z.mean()
    F = np.abs(np.fft.fftshift(np.fft.fft2(zz * np.outer(np.hanning(z.shape[0]), np.hanning(z.shape[1]))))) ** 2
    ky, kx = np.meshgrid(np.fft.fftshift(np.fft.fftfreq(z.shape[0], cell)), np.fft.fftshift(np.fft.fftfreq(z.shape[1], cell)), indexing='ij'); kr = np.hypot(kx, ky)
    bins = np.logspace(np.log10(1 / 8000), np.log10(1 / 60), 30); idx = np.digitize(kr, bins); P = np.array([F[idx == i].mean() if (idx == i).any() else 0 for i in range(1, len(bins))]); kc = np.sqrt(bins[1:] * bins[:-1])
    m = (kc > 1 / 3000) & (kc < 1 / 90); beta = np.polyfit(np.log(kc[m]), np.log(P[m]), 1)[0]; r['spectral_slope_beta'] = float(beta)
    # autocorrelation length (1/e) of detrended z
    A = np.real(np.fft.ifft2(np.abs(np.fft.fft2(zz - zz.mean())) ** 2)); A /= A[0, 0]; ax = np.r_[A[0, :z.shape[1] // 2]]; r['autocorr_len_1e_m'] = float(np.argmax(ax < 1 / np.e) * cell)
    # lakes
    lab, nl = ndi.label(water); sizes = ndi.sum(np.ones_like(z), lab, range(1, nl + 1)) * cell * cell / 1e4
    keep = sizes >= 1; r['lakes_ge_1ha'] = int(keep.sum()); area_km2 = z.size * cell * cell / 1e6; r['lakes_per_100km2'] = float(keep.sum() / area_km2 * 100); r['water_frac'] = float(water.mean())
    r['lake_ha_p50_p90_max'] = [float(np.percentile(sizes[keep], q)) for q in (50, 90)] + [float(sizes.max())]
    ors, elong, dl = [], [], []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if sizes[i] < 2 or sizes[i] > 5000: continue
        msk = lab[sl] == i + 1; yy, xx = np.nonzero(msk); C = np.cov(np.vstack([xx, -yy])); ev, evec = np.linalg.eigh(C)
        ors.append(np.degrees(np.arctan2(evec[1, 1], evec[0, 1])) % 180); elong.append(np.sqrt(ev[1] / max(ev[0], 1e-6)))
        per = (msk ^ ndi.binary_erosion(msk)).sum() * cell; dl.append(per / (2 * np.sqrt(np.pi * msk.sum() * cell * cell)))
    ors = np.array(ors); r['lake_long_axis_azimuth_hist_deg'] = np.histogram((90 - ors) % 180, bins=6, range=(0, 180))[0].tolist(); r['lake_elongation_p50'] = float(np.median(elong)); r['shoreline_development_p50'] = float(np.median(dl))
    return r, s
