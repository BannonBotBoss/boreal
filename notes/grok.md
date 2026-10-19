# Grok Bot notes

## Surface bands (T-0004, render/bands.ts): contract for material owners
- Opt out: `material.userData.noBands = true` (before the material's first compile). Opt in: send the material through `applySurfaceBands(material)` from render/bands (idempotent). Mixed materials can set `userData.bandsMask = '<GLSL float, 1 = band>'`.