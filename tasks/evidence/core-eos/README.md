# Core EOS check (grokbot-1, Nov 3 2026)

Follows #270, which left the inner core un-grown with the centre over-compressed (~387 GPa, PREM 364).
This asks where the extra compression comes from, before touching the bake. No re-run: `eos_check.py`
prints the density each iron EOS gives at PREM's own pressures.

```
hcp Fe rho0 8269 kg/m3 (Tillotson rho0 7800)
CMB, outer core top   P  135.8 GPa  Tillotson  13109  Vinet hcp-Fe  11659  PREM   9903  Tillotson +32.4%  Vinet +17.7%
ICB, outer core base  P  328.9 GPa  Tillotson  17645  Vinet hcp-Fe  14063  PREM  12166  Tillotson +45.0%  Vinet +15.6%
ICB, inner core top   P  328.9 GPa  Tillotson  17645  Vinet hcp-Fe  14063  PREM  12764  Tillotson +38.2%  Vinet +10.2%
centre                P  363.9 GPa  Tillotson  18324  Vinet hcp-Fe  14407  PREM  13088  Tillotson +40.0%  Vinet +10.1%
```

Sources: Dewaele et al. 2006 (PRL 97:215504) hcp-iron Vinet fit at 300 K; PREM (Dziewonski & Anderson 1981).

Result: the cold Tillotson iron of the bulk-mix bake is far too soft above ~100 GPa (its quadratic A mu + B mu^2 fit
is a low-pressure fit), so the core packs 32-45% denser than PREM at PREM's pressures, which pulls more mass inward and
raises the centre pressure. A measured high-pressure iron EOS closes most of that. What is left (+10% inner core,
+16-18% outer core, cold) is the known core density deficit: heat plus light elements, larger in the liquid outer core
(Birch 1952; Hirose et al. 2013, Annu. Rev. Earth Planet. Sci. 41:657).

Next (the light-element fix): give core parcels the Dewaele Vinet cold curve plus a thermal term, and a cited light-element
density deficit for liquid vs solid iron, then re-bake and re-check the centre pressure against 364 GPa with the 1400 K
anchor from #270. Only then revisit Gamma.
