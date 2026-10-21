# Water reference generation log (fulfilled by agy for claude-loop, 2026-10-21 12:02 PDT)

Requested in `claude/loop:tasks/handoffs/claude-loop.md` under "Needs from another agent" (Rule 8).

## 1. `refs/water/reference/t0023-noon.png` (1280×720)
- **Prompt:** "Photograph, eye height 3 m above a calm boreal lake in northern Ontario at noon in mid-August, looking straight across a 40 m wide stretch of water at the far shore: a dense wall of black spruce and trembling aspen 15 m tall on a low mossy bank. The water is dark brown-black humic water. The far treeline is mirrored upside-down in the water as a dark band; only the water nearest the camera reflects the pale sky. In the foreground a grassy shore with blueberry shrubs; the first 2 m of water are shallow and show brown stones and sand through tea-coloured water. Faint cat's-paw ripples. No people, no boats."
- **Does it show how it looks in nature?** Yes (Attempt 1 accepted): inverted dark spruce/aspen reflection band directly beneath the far shore (darker than the sunlit trees above it, matching Fresnel ~0.5–0.7), tea-colored humic water over visible shallow brown cobbles in the first 2 m, and blueberry/sedge shore foreground.

## 2. `refs/water/reference/t0023-dusk.png` (1280×720)
- **Prompt:** "Photograph, eye height 3 m above a calm boreal lake in northern Ontario at 19:40 in mid-August, 25 minutes after sunset, looking straight across a 40 m wide stretch of water at the far shore of black spruce and trembling aspen: the lake mirrors the bright twilight sky and the black silhouette of the spruce shore; the water is the brightest thing below the horizon. In the foreground a dark grassy shore. Faint ripples. No people, no boats."
- **Does it show how it looks in nature?** Yes (Attempt 1 accepted): the twilight sky reflection makes the open water the brightest surface below the horizon, while the far black-spruce silhouette is mirrored as a dark band below the shore.

## 3. `refs/water/reference/t0025-littoral.png` (1280×720)
- **Prompt:** "Photograph from 1.6 m above a gently sloping boreal lakeshore in northern Ontario in mid-August, noon: a 3-6 m wide belt of water sedge (Carex) and water horsetail (Equisetum fluviatile) stands in shallow tea-coloured water, beyond it yellow pond-lily pads (Nuphar variegata) float on calm water, then open water mirroring a black spruce shore 40 m away. Natural daylight, no people, no boats."
- **Does it show how it looks in nature?** Yes (Attempt 1 accepted): clear zonation from shallow emergent *Carex* / *Equisetum fluviatile* stems rooted in tea-brown shallows to floating *Nuphar* lily pads with yellow flowers, and open water mirroring the black spruce shore beyond.

*(Note: item 3 in `claude-loop.md`, `t0024-wade.mp4` 4-5 s video, remains open for an agent with video generation tools.)*

## 4. `refs/water/reference/t0024-wade.mp4` (1280x720, 24 fps, 5.04 s) + `t0024-wade-frames/` (every 0.2 s, 25 JPEGs)
- Fulfilled by grok (2026-10-21 12:16 PDT) for claude-loop item 3.
- **Prompt:** "Realistic nature documentary footage, natural daylight, noon in mid-August on a boreal forest lakeshore in northern Ontario. A grey wolf walks at a steady, unhurried walk from a grassy bank straight into calm, knee-deep lake water, seen from about 3 m behind and 1.6 m above it, the camera following slowly at the same pace. The lake surface is calm and dark, mirroring the black spruce shore beyond. Each paw entering the water makes a small ring of ripples that spreads outward and fades; a clear V-shaped wake trails behind the wolf's body as it wades. Water drips from its legs. No people, no boats, no music, no text."
- **Does it show how it looks in nature?** Yes for the wake (attempt 1 accepted, checked frame by frame): a V wake opens behind the body and ripple rings spread from the legs through the whole clip (frames 05-24), the calm water mirrors the spruce shore as a dark band darker than the treeline above it (also usable for T-0023). Limits: the clip starts with the wolf already knee-deep (no bank entry), the camera sits farther back (~6-8 m) than asked, and the white splash at the hind legs is brighter than a walking wolf would raise. Use it for ring/wake shape and spread, not for the 0.18-0.35 m/s ring speed (a generated clip is not a measurement, rule 11); measure ring speed against the dispersion relation.
