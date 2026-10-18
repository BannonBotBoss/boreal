import numpy as np
from scipy import ndimage as ndi
def wrap_merge(lab, nl):
    """The game world wraps (torus): merge labelled components that continue across the opposite edge."""
    if not nl: return lab, nl
    par = np.arange(nl + 1)
    def fd(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for A, B in ((lab[0], lab[-1]), (lab[:, 0], lab[:, -1])):
        for a, b in zip(A, B):
            if a and b: ra, rb = fd(a), fd(b); par[max(ra, rb)] = min(ra, rb)
    roots = np.array([fd(i) for i in range(nl + 1)]); u, inv = np.unique(roots, return_inverse=True)
    return inv.reshape(-1)[lab], len(u) - 1


def metrics(z, water, cell=30.0, tag='', torus=True):
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
    lab, nl = ndi.label(water); lab0, nl0 = lab, nl
    if torus: lab, nl = wrap_merge(lab, nl)
    sizes = ndi.sum(np.ones_like(z), lab, range(1, nl + 1)) * cell * cell / 1e4
    keep = sizes >= 1; r['lakes_ge_1ha'] = int(keep.sum()); area_km2 = z.size * cell * cell / 1e6; r['lakes_per_100km2'] = float(keep.sum() / area_km2 * 100); r['water_frac'] = float(water.mean())
    r['lake_ha_p50_p90_max'] = [float(np.percentile(sizes[keep], q)) for q in (50, 90)] + [float(sizes.max())]
    ors, elong, dl = [], [], []
    s0 = ndi.sum(np.ones_like(z), lab0, range(1, nl0 + 1)) * cell * cell / 1e4
    edge0 = set(np.unique(np.r_[lab0[0], lab0[-1], lab0[:, 0], lab0[:, -1]]).tolist()) if torus else set()
    for i, sl in enumerate(ndi.find_objects(lab0)):
        if (i + 1) in edge0: continue  # shape only for whole lakes (wrapped ones span the seam)
        if s0[i] < 2 or s0[i] > 5000: continue
        msk = lab0[sl] == i + 1; yy, xx = np.nonzero(msk); C = np.cov(np.vstack([xx, -yy])); ev, evec = np.linalg.eigh(C)
        ors.append(np.degrees(np.arctan2(evec[1, 1], evec[0, 1])) % 180); elong.append(np.sqrt(ev[1] / max(ev[0], 1e-6)))
        per = (msk ^ ndi.binary_erosion(msk)).sum() * cell; dl.append(per / (2 * np.sqrt(np.pi * msk.sum() * cell * cell)))
    ors = np.array(ors); r['lake_long_axis_azimuth_hist_deg'] = np.histogram((90 - ors) % 180, bins=6, range=(0, 180))[0].tolist(); r['lake_elongation_p50'] = float(np.median(elong)); r['shoreline_development_p50'] = float(np.median(dl))
    # islands: land components (8-connected) other than the mainland, fully enclosed by water (real window: not touching the edge)
    ll, nll = ndi.label(~water, structure=np.ones((3, 3)))
    if torus: ll, nll = wrap_merge(ll, nll)
    isz = ndi.sum(np.ones_like(z), ll, range(1, nll + 1))
    ok = np.ones(nll, bool); ok[np.argmax(isz)] = False
    if not torus:
        edge = np.unique(np.r_[ll[0], ll[-1], ll[:, 0], ll[:, -1]]); ok[edge[edge > 0] - 1] = False
    r['islands_per_100km2'] = float(ok.sum() / (z.size * cell * cell / 1e6) * 100); r['islands_per_km2_water'] = float(ok.sum() / max(1e-9, water.sum() * cell * cell / 1e6))
    r['small_lakes_lt10ha_frac'] = float((sizes[keep] < 10).mean())
    return r, s
