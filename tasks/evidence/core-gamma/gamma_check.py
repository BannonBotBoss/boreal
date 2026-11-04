"""Re-score the 6k core (core6k.thermal.csv from #267) with a lower core Grueneisen exponent.
The core adiabat is T = t_top (rho/rho_top)^Gamma, so a new Gamma rescales each parcel: T' = t_top (T/t_top)^(Gamma'/Gamma).
t_top is taken as the 5th-percentile core temperature (the cold anchor the run used). Usage: python3 gamma_check.py core6k.thermal.csv"""
import csv, sys
rows = [x for x in csv.DictReader(open(sys.argv[1])) if x['class'] == '0' and float(x['t_k']) > 500]
ts = sorted(float(x['t_k']) for x in rows); t_top = ts[len(ts) // 20]
print(f"core parcels {len(rows)}, t_top {t_top:.0f} K")
for g in (2.0, 1.5, 1.3):
    s = sorted(float(x['r_km']) for x in rows if t_top * (max(float(x['t_k']), t_top) / t_top) ** (g / 2.0) < float(x['t_liq_k']))
    print(f"Gamma {g}: solid {len(s)}/{len(rows)}, r<1300 km {sum(v < 1300 for v in s)}, r>2500 km {sum(v > 2500 for v in s)}")
