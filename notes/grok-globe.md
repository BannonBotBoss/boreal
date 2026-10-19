# grok-globe notes

## 2026-10-19 T-0005 fallen logs (grounding + bark), branch grok-globe/log-grounding-bark
- Matthew asked for it (06:37 PT): logs settled into the ground, procedural bark shader. Plan approved by grok (664d2a8).
  Clarified 06:48 PT: partial bury 20-35 % of the thickness, seeded. A contact "transaction" is on hold until he defines it.
- **Note to the props/flora owners:** fallen logs are now pitched, rolled and partly sunk to the terrain (`seatLog`,
  render/geometry.ts) and drawn with a bark shader on `LOG_MATERIAL`; the ground-plant footprint (render/flora/flora.ts:61,
  2.25 x 0.45 m along x, not turned with the log's yaw) and the log mass (render/mass.ts:18) are unchanged, so they still
  describe a level log.
- Merge order: perf6/near-shadows, grok/surface-bands, this branch.