Upstream: https://github.com/mateusdcc/plant-generator @ 89fe3b69b5f13abe330495e068415c50c0a68a27 (MIT, LICENSE alongside; roblox-ts TypeScript)
Files: src/geometry/surfaces.ts (createBlade, createPetal, width profiles), src/topology/phyllotaxis.ts (Vogel planar
phyllotaxis, golden angle), src/botanical/inflorescences.ts (raceme / spike / panicle / umbel / cyme / capitulum topology).
Models: Vogel 1979 (Math. Biosci. 44:179) phyllotaxis; Prusinkiewicz & Lindenmayer 1990 (The Algorithmic Beauty of Plants)
inflorescence types; Weberling 1989 (Morphology of Flowers and Inflorescences).
Baseline copy, unmodified, not compiled (roblox-ts: math.*, .size()). Boreal port: src/render/flora/plant.ts.
