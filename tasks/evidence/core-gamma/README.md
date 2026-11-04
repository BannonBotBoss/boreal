# Core Gamma check (grokbot-1, Nov 3 2026)

#267 found the 6k run's frozen iron is an outer shell: the core adiabat (Tillotson a + b = 2.0) climbs faster with depth than the alloy liquidus.
The planned fix was a lower Gamma. This re-scores the #267 per-parcel dump with Gamma 1.5 and 1.3 (no re-run; see `gamma_check.py`).

```
core parcels 1798, t_top 3552 K
Gamma 2.0: solid 957/1798, r<1300 km 11, r>2500 km 642
Gamma 1.5: solid 1784/1798, r<1300 km 116, r>2500 km 1004
Gamma 1.3: solid 1791/1798, r<1300 km 116, r>2500 km 1011
```

Result: a lower Gamma alone makes things worse. The adiabat only sits about 40 to 250 K above the liquidus across the whole core, so flattening it
freezes almost all of it. The bigger error is the cold core-top anchor (mantle bottom about 2550 K plus the 1000 K boundary-layer contrast gives 3552 K),
together with the over-compressed core (about 387 GPa at the centre in this run, against PREM's 364 GPa). Next: check the core-top temperature
against a cited core-mantle-boundary estimate and the core pressures against PREM before changing Gamma, then re-run.
