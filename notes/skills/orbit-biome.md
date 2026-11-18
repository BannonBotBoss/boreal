# Orbit biome colour

Use this when the planet from orbit is one colour, or a coast is a stair of the mesh.

1. Do not paint a photograph onto the disc. The night side has to stay dark, which a lit material already does. Replace the albedo, not the light.
2. The class is `coverKind`, the same function the feet use. Moisture at orbit is the Hadley pattern in `ORBIT_ZONAL` (wet ITCZ, dry subtropics, wet storm tracks), dried further inland. Thresholds stay `cover-density.json`.
3. Open ocean is a flood from deep water through cells below sea level. A basin that is merely below sea level (the Caspian) is a lake, or the mesh smears it into a grey wedge.
4. Upload the equirectangular map once (`uploadOrbitAlbedo`) and sample it in `ORBIT_FRAG` while `uOrbit` is up. A 2-pixel mean on the alpha stops a one-cell stair.
5. Check Sahara tan, Congo green, Caspian not ocean, and a latitude −72 transect with intermediate alphas and no hard jump. The known mismatch is the all-green orbit frame. The known match for the geography is Apollo 17 AS17-148-22727.
6. The wide peach limb is `atmWarmSun`, not this map. Leave it for that fix.
