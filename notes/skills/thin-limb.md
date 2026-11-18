# Thin atmospheric limb

Use this when the planet's day side goes peach or the limb is a coloured rim instead of a thin blue edge.

1. The reddening is the sunlight's own transmittance (`atmSunlight`: Rayleigh, ozone Chappuis, Mie). Do not mix a flat orange on top of it. A wide `smoothstep` on N·L paints the day side.
2. The blue limb is the sky shell's in-scatter (`atmScatter`), the same single-scattering march. It shows once the terrain edge is not painted peach.
3. Check a known mismatch: the retired curve at mu 0.3 is already warm. Check a known match: `peachFill` is 0, and a Kasten & Young airmass through the existing coefficients stays near neutral at mu 0.5 and redder at mu 0.05.
4. Leave the cover map alone. A tan Sahara does not fix the limb, and removing the peach does not colour the land.
