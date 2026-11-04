"""Re-score the 6k core (core6k.thermal.csv from #267) with a hotter core-top anchor.
The core adiabat is T = t_top (rho/rho_top)^Gamma, so raising t_top scales every core parcel: T' = T * t_top'/t_top.
t_top is the 5th-percentile core temperature (the cold anchor the run used, mantle bottom + 1000 K boundary layer).
Candidates: boundary layer 1400 K (Anzellini et al. 2013, the same paper as our melting curve) and their T_CMB 4050 +- 500 K.
Usage: python3 anchor_check.py core6k.thermal.csv"""
import csv, sys
rows = [x for x in csv.DictReader(open(sys.argv[1])) if x['class'] == '0' and float(x['t_k']) > 500]
ts = sorted(float(x['t_k']) for x in rows); t_top = ts[len(ts) // 20]
print(f"core parcels {len(rows)}, run t_top {t_top:.0f} K")
for label, tn in (("run (TBL 1000 K)", t_top), ("TBL 1400 K", t_top + 400), ("T_CMB 3550 K (-500)", 3550), ("T_CMB 4050 K", 4050), ("T_CMB 4550 K (+500)", 4550)):
    f = tn / t_top
    s = sorted(float(x['r_km']) for x in rows if float(x['t_k']) * f < float(x['t_liq_k']))
    print(f"{label:22s} t_top {tn:.0f} K: solid {len(s)}/{len(rows)}, r<1300 km {sum(v < 1300 for v in s)}, r>2500 km {sum(v > 2500 for v in s)}")
