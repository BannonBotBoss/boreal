# Core-top anchor check (grokbot-1, Nov 3 2026)

Follows #269: a lower Gamma alone froze 99% of the core, so this tests the other suspect, the cold core-top anchor
(mantle bottom ~2552 K + 1000 K boundary layer = 3552 K). Re-scores the #267 per-parcel dump, no re-run (`anchor_check.py`).

Sources: Anzellini et al. 2013 (Science 340:464, the same paper as our iron melting curve) give T_CMB = 4050 +- 500 K
and a ~1400 K thermal boundary layer at the base of the mantle. Lay, Hernlund & Buffett 2008 allow 500-1800 K.

```
core parcels 1798, run t_top 3552 K
run (TBL 1000 K)       t_top 3552 K: solid 956/1798, r<1300 km 11, r>2500 km 641
TBL 1400 K             t_top 3952 K: solid 133/1798, r<1300 km 1, r>2500 km 89
T_CMB 3550 K (-500)    t_top 3550 K: solid 973/1798, r<1300 km 11, r>2500 km 651
T_CMB 4050 K           t_top 4050 K: solid 88/1798, r<1300 km 1, r>2500 km 56
T_CMB 4550 K (+500)    t_top 4550 K: solid 12/1798, r<1300 km 0, r>2500 km 9
```

Result: the cold anchor is what freezes the outer shell. With Anzellini's 1400 K boundary layer the shell almost disappears
(641 to 89 parcels above r = 2500 km), so `cmb_tbl_contrast_K` should be 1400, cited to the paper we already use.
It does not grow an inner core (1 parcel below 1300 km): with Gamma 2.0 and a core over-compressed to ~387 GPa at the centre
(PREM 364), the adiabat still climbs faster than the liquidus. Next: fix the core compression against PREM, then re-run
with the 1400 K anchor and only then revisit Gamma.
