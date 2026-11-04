# Skill: Hare Alarm Thump vs Capture Squeal Audio (`hare-alarm-audio`)

## When to use
Use this skill when wiring or verifying hare audio events (`bolt`, `hop`, `caught`, `pinned`) in `src/audio/borealSound.ts` against the species social alarm template (`HARE_NEEDS.social.alarm` in `src/core/needs/species/index.ts`) and Web Audio start logs.

## Steps
1. **Map the bolt event to the species social alarm**:
   - In `src/core/needs/species/index.ts`, `HARE_NEEDS.social.alarm` defines `{ signal: 'thump', loudness: S(4, ...) }`, representing a 4 m/s footfall-equivalent hind-foot thump (ADW *Lepus americanus*; ECCC Hinterland Who's Who CW69-4-44-2003).
   - Export `hareThumpLevel(alarm = HARE_NEEDS.social.alarm)` in `src/audio/borealSound.ts` so a `'thump'` alarm scales `MIX.hareHop` by `alarm.loudness.v / 4` (`1.0 * MIX.hareHop = 0.6`), while a calm `hop` remains a quieter step (`MIX.hareHop * 0.4 = 0.24`).
   - In `BorealSound.hare(type, at)`, the `'bolt'` branch plays one `'hare-hop'` at `hareThumpLevel()` and never plays `'hare-squeak'`.
2. **Keep the distress squeal strictly on capture**:
   - The `'caught'` branch of `BorealSound.hare` starts `'pounce'` and one `'hare-squeak'` (`MIX.hareSqueak`), and the handling capture bite row (`src/core/huntHold.ts` -> `sfx.squeal(at)`) starts one `'hare-squeak'` on the rising bite edge.
   - Never add a timer or a second squeal.
3. **Verify with unit tests and a Web Audio start log**:
   - Add unit tests in `tests/mixer.test.ts` verifying `hareThumpLevel()` and `BorealSound.prototype.hare` across `'bolt'`, `'hop'`, and `'caught'`.
   - Record a headless Web Audio capture (`refs/audio/t0053-hare-thump/capture.mjs`) wrapping `AudioBufferSourceNode.prototype.start` and `PannerNode` to confirm the approach bolt log contains `'hare-hop'` with zero `'hare-squeak'`, and capture still starts one `'hare-squeak'`.

## Checks that prove it worked
- `tests/mixer.test.ts` passes (`5/5`).
- `refs/audio/t0053-hare-thump/capture.json` records `postFixScore === 1.0` (`knownMismatchScore === 0.667`, `knownMatchScore === 1.0`), with `hare-bolt.png` and `hare-capture.png`.

## Mistakes to avoid
- Playing `hare-squeak` on `bolt` (hares thump a hind foot to alarm conspecifics and only squeal when captured).
- Modifying flight initiation distance (`boltDistance`) or `sprintSeconds` when changing the audio mapping.
