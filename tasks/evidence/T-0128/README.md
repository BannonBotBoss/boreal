# T-0128: black, unlit landed foreground (#192 gate, item 2)

**Cause.** The GI light probe (`render/photoreal.ts`) held NaN spherical-harmonic coefficients. Turning GI off only set
`probe.intensity = 0`, and in the shader 0 x NaN is still NaN, so every lit material (ground, trees, animals) drew black
while the unlit sky stayed bright. Probe dump in game mode (SwiftShader, Minimum tier): sun 2.70, hemisphere 2.70, probe
intensity 0, all nine SH coefficients NaN. A plain white `MeshStandardMaterial` override was also black; hiding the probe alone
restored the light (`game/probe-hidden.png`).

**Fix.** A GI readback with any non-finite coefficient is rejected (probe zeroed), and GI off now zeroes the coefficients
as well as the intensity. Test: `tests/gi-probe-nan.test.ts`.

**Frames** (1280x720, SwiftShader, same tools as T-0127):
- Game mode before / after: `game/before.png`, `game/after.png`.
- In-page landed, after: `boreal/landed-0{1,2}.png` (52, -97: lit stand and a readable black bear),
  `polar/landed-0{1,2}.png` (74.2, 50.6: lit ground and wolf). Before is `tasks/evidence/T-0127/*/landed-02.png`.

Visual gate "terrain and animals readable": **pass** at the two re-shot sites. The other eight sites were not re-shot here.
Cover/picture mismatches (polar reads ice and draws conifers) are unchanged and are not part of this fix.
Hardware FPS / GPU memory: **UNVERIFIED** (no GPU on this machine).
