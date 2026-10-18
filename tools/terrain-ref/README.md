# terrain-ref: real-world calibration for the staged terrain (dev only, nothing here ships)

Scripts that download open reference data for a 15 x 15 km window east of Kenora (49.735 N, 94.38 W),
measure it, and measure the staged generator the same way. The data stays out of the repo; fetch it with
`fetch.py` (DEM + WorldCover) and `s2.py`/`s2m.py` (Sentinel-2 true colour), then run `metrics.py`.
`export.ts` (run with tsx, optional ELEVP='{"reliefM":60}' overrides) dumps the game grid that `game.py`/`metrics.py` read;
`topmap.ts` + `compare.py` build the side-by-side comparison. `real.py` writes the Kenora reference metrics (`torus=False`),
`sweep.py` (`SEED=7 python sweep.py '{"lakeMinDepth":12}' ...`) measures the generator per ELEVP config, `beta.py` gives
the spectral slope per band. `metrics.py` labels the game's water and islands with wrap-around (the world is a torus), so a
lake or the mainland crossing the seam counts once; the real window drops islands touching its edge.

Sources and licences:
- Copernicus GLO-30 DEM (AWS copernicus-dem-30m): "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved" (free licence with attribution).
- ESA WorldCover 10 m 2021 v200 (AWS esa-worldcover): CC BY 4.0, © ESA WorldCover project / Contains modified Copernicus Sentinel data (2021).
- Sentinel-2 L2A (AWS sentinel-cogs, S2B_15UUR/15UVR 2024-07-30): Copernicus Sentinel data 2024, free and open.
- Ground/aerial photos (Wikimedia Commons): Archives of Ontario RG 65-35 tourism photos (Open Government Licence - Ontario); "Kenora, Ontario.jpg" Quintin Soloviev CC BY 4.0; Kenora panorama Andre Carrotflower CC BY-SA 4.0; Lake of the Woods scenery Roger Sylvia CC BY-SA 3.0.
- Islet minimum mapping unit (ELEV.isletMax): the raster sieve convention of GDAL `gdal_sieve.py` (GDALSieveFilter) / land-cover MMUs.
- Literature: Hallett & Roed 1980, NOEGTS 36 Kenora (OGS); Gharari et al. 2011 HESS 15:3275; Rennó et al. 2008 / Nobre et al. 2011 (HAND).
