# Reference Sources (`T-0305`)

1. **`ref-0-boreal-black-spruce-reference.jpg`**:
   - Generated via `image-generator` (2026-11-25) from the eye-level boreal black spruce (*Picea mariana*) description matching `?tree=1&view=one`: mature ~13–15 m black spruce with narrow conical spire, dense drooping dark-green boughs, characteristic narrow tufted crown top, and reddish-brown scaly lower bark standing on a mossy boreal forest floor in front of a small stand of black spruce trees under a clear pale-blue midday sky.
   - Botanical & forestry sources: Burns & Honkala (1990), *Silvics of North America, Vol. 1: Conifers* (USDA Forest Service Agriculture Handbook 654, *Picea mariana* mature crown shape, spire density, height 9–15 m, DBH 13–23 cm at 90 yr); Viereck & Johnston (1990) boreal black spruce stand architecture.
2. **`ref-1-boreal-wolf-witness-reference.jpg`**:
   - Generated via `image-generator` (2026-11-25) from the elevated (~4 m) witness-camera description matching `?watch=1` (`WITNESS_ALTITUDE_SCALE = 2`, `src/core/enterLiving.ts:18-21`): a wild North American grey wolf (*Canis lupus*) moving naturally through a sunlit Canadian Shield boreal clearing with moss, fallen needles, exposed granite outcrops, and mixed black spruce and white birch trees, with the full animal and its ground plane clearly visible in frame.
   - Ecological & behavioural sources: Mech & Boitani (2003), *Wolves: Behavior, Ecology, and Conservation* (University of Chicago Press) — grey wolf vocalization bioacoustics (howl detection >1 km in open/boreal forest; pack/prey acoustic response) and natural movement/foraging rhythms; Whishaw, Flannigan & Barnsley (1979, *Dev. Psychobiol.* 12:595) tonic immobility / post-release habituation decay (`tau = 180 s`, `friendStrength(at, now) = exp(-(now - at)/tau) <= 1.0`).
3. **Interaction, Accessibility & Input Standards**:
   - ISO 9241-110 (Dialogue Principles: Controllability, Self-Descriptiveness, Error Tolerance — zero silent input drops on fast key taps, clean shifted-key capture release, non-overlapping action buttons).
   - W3C UI Events / KeyboardEvent specification (`KeyboardEvent.code` vs shift-modified `KeyboardEvent.key` across `keydown`/`keyup` release orders).
   - WCAG 2.1 AA 1.4.3 / 1.4.11 & 2.4.11 (Focus Not Obscured — `Back` button must not be occluded by footer chrome).
