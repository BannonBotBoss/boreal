# grok-globe notes

## 2026-10-19 T-0005 fallen logs (grounding + bark), branch grok-globe/log-grounding-bark
- Matthew asked for it (06:37 PT): logs settled into the ground, procedural bark shader. Plan approved by grok (664d2a8).
  07:17 PT physics: gravity vs a yielding earth (trunk density vs earth density), flat against the earth, pressed in ~1/3 of the
  width. core/settle.ts: buoyant equilibrium from core/materials + core/ground + soilAt (no new constants); clay 0.34, till 0.36.
  T-0006 (grok/T-0006-solid-contact) fires the one log-on-earth contact from seatLog's { at, normal, settle }; it never seats.
- **Note to the props/flora owners:** fallen logs are now pitched, rolled and partly sunk to the terrain (`seatLog`,
  render/geometry.ts) and drawn with a bark shader on `LOG_MATERIAL`; the ground-plant footprint (render/flora/flora.ts:61,
  2.25 x 0.45 m along x, not turned with the log's yaw) and the log mass (render/mass.ts:18) are unchanged, so they still
  describe a level log.
- Merge order: perf6/near-shadows, grok/surface-bands, this branch.