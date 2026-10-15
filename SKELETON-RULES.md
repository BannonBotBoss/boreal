# Procedural skeleton rules

Every animal and bird is generated from one rulebook. A species is only numbers (a *plan*). The generator turns a plan into an invisible skeleton, a connected tree of bones, and `validateSkeleton()` checks every rule below. Code: `src/core/skeleton.ts` (rules and generators) and `src/core/species.ts` (Northwest Ontario species). Tests: `tests/skeleton.test.ts`. Picture: `tools/skeleton-sheet.html`.

Nothing is hand-modelled. Bodies, fur, feathers and animation will hang off these bones.

## Global rules

| # | Rule | Why |
|---|---|---|
| R1 | One root bone per animal: the pelvis (mammals) or synsacrum (birds). | Everything moves relative to the hips. |
| R2 | Every bone connects to at least one other bone, and the whole skeleton is a single tree with no loops. | Your rule: no floating bones. |
| R3 | A bone's joint (its head) lies on its parent bone, at the end or partway along it. | Bones stay attached. |
| R4 | End pieces (snout, jaw, toes, tail tip, wing tip) are attached at one end only and have no children. Every bone with no children is an end piece. | Your jaw rule, generalised. |
| R5 | Joint types: **fixed** (0 movement), **hinge** (1 axis), **ball** (2–3 limited axes). Each joint carries exactly the limits its type allows. | One movement model for every animal. |
| R6 | Every movement has a limit. The resting pose sits inside every limit. Animation must clamp to these limits. | Your "limited in range" rule. |
| R7 | Left and right are mirror images. | Bilateral body plan. |
| R8 | Head: one oval skull. The snout is fixed to the skull and is the nose. The jaw hinges at the rear skull base, below the ears, where the real jaw joint is; it is an end piece; it rests closed against the upper jaw (0°) and opens only downward, to a researched maximum. Birds follow the same rule (upper beak = snout, lower beak = jaw). | Your head design, with the hinge moved back to the real joint position (your later instruction). |
| R9 | The head joint (skull on the first neck bone) limits nod, turn and roll. | Your "head can move, limited" rule. |
| R10 | Neck count: mammals always have **7** cervical vertebrae; birds have **8–25**. | Vertebrate anatomy. |
| R11 | Every bone has a length and a thickness (oval cross-section) for the body to wrap around. | The skin needs a shape. |
| R12 | Every number records its source, or is flagged provisional. | Know what is researched and what is a guess. |
| R13 | Size comes from one measurement per species: shoulder height (mammals) or bill-to-tail length (birds). Everything else is a ratio of it. | Minimal data per species. |
| R14 | For distant or cheap rendering, neighbouring vertebrae may be merged into one bone; their ranges add together. | Minimal resources. |

## Joint limits

Hinge limits use the vets' goniometric convention: the inside angle between the two bones, where 180° is a straight line.

| Joint | Range | Source |
|---|---|---|
| Shoulder | 51–160° | Dog goniometry (Formenton et al. 2019; reported similar to Labradors, Jaegger et al. 2002) |
| Elbow | 50–175° | same |
| Carpus (wrist) | 32–204° | same |
| Hip | 58–181° | same |
| Stifle (knee) | 58–173° | same |
| Tarsus (hock) | 40–188° | same |
| Skull on atlas (nod / turn / roll) | ±16.8° / ±11.7° / ±12.0° | Labrador maxima, upper-cervical fluoroscopy (Front. Vet. Sci. 2021) |
| Atlas on axis (nod / turn / roll) | ±9.7° / ±7.8° / ±15.8° | same |
| Jaw opening | Carnivores: opening angle from measured incisor gap by body weight (67 mm under 5 kg up to 134 mm over 25 kg) over the lower-jaw length. Gray wolf ≈ 34°. | Dog mandibular opening (Front. Vet. Sci. 2016) |
| Bird wing folded | elbow 31.3°, wrist 52.2° | Crown-bird medians (Zoological Letters 2023) |
| Bird wing extended | elbow 160°, wrist 175° | **provisional** |
| Bird wrist | follows the elbow (folding the elbow folds the wrist) | Coupled wing-folding mechanism (Zoological Letters 2023) |
| Owl head roll | 270° each way, shared across 14 neck vertebrae | de Kok-Mercado et al., Johns Hopkins 2013 |
| Other neck, spine, tail, toe and girdle ranges | small symmetric ranges | **provisional** |

The neck values were recorded during natural movement, not at full stretch, so they are conservative.

## Body plans

**Mammals.** Pelvis (root), then lumbar and thoracic spine, 7 cervical vertebrae, skull, snout and jaw. Paired shoulder blade, upper arm, forearm, forefoot and toes; hip socket, thigh, shank, hind foot and toes. Tail vertebrae, count by species. Stance sets the resting angles:

- **Plantigrade** (whole foot down): bear, raccoon, skunk, weasel family, rodents, hare, shrews.
- **Digitigrade** (on the toes): wolf, coyote, foxes, lynx, bobcat, cougar.
- **Unguligrade** (on hooves): moose, elk, deer, caribou.
- **Bat**: forelimb is a folded wing with four long fingers.

**Birds.** Synsacrum (fused pelvis, root), with the thorax fused to it and a keel for flyers. 8–25 neck vertebrae, skull, fixed upper beak and hinged lower beak. Wings: upper arm, forearm and hand, folded at rest. Legs: femur, tibiotarsus and tarsometatarsus (the "backward knee" is really the ankle), then toes. Free tail vertebrae and a fused pygostyle tip. Toe layout by group:

- **Anisodactyl** (3 forward, 1 back): most birds.
- **Zygodactyl** (2 and 2): owls, woodpeckers, cuckoos.
- **Syndactyl**: kingfisher.
- **Pamprodactyl** (all forward): swifts.

## Species (Northwest Ontario)

Lists from the Thunder Bay Field Naturalists checklists: mammals (56 species, 2018) and birds (376 species, 2025).

**Mammals: 52 native species are generated.**

| Plan | Species |
|---|---|
| Canid | gray wolf, coyote, red fox, gray fox |
| Felid | Canada lynx, bobcat, cougar |
| Mustelid | wolverine, river otter, marten, ermine, mink, fisher, badger |
| Procyonid/skunk | raccoon, striped skunk |
| Ursid | black bear |
| Cervid | moose, elk, white-tailed deer, woodland caribou |
| Leporid | snowshoe hare |
| Large rodent | beaver, porcupine, woodchuck, muskrat |
| Rodent | squirrels, chipmunks, voles, mice, jumping mice, lemming, flying squirrel |
| Insectivore | 6 shrews, star-nosed mole |
| Bat | 6 bats |

Not generated for the 1400s, because they were introduced after European arrival: European hare, house mouse, Norway rat, nutria.

**Birds: all 47 checklist groups** map to 20 plans:

- songbird, corvid, raptor, owl, waterfowl, swan
- grouse, diver (loons, grebes), wader (herons, cranes), rail, shorebird, gull
- pelecaniform, pigeon, cuckoo, nightjar, swift, hummingbird, kingfisher, woodpecker

Not generated for the 1400s: European starling, house sparrow, rock pigeon.

## Open research

- **Hoofed animals, bears, cats, weasels and rodents** currently use dog joint ranges. They need their own measurements.
- **Bats** are a rough first pass.
- **Bird joints**: extended wing angles, leg ranges, neck counts per group (only the owl's 14 and the swan maximum of 25 are sourced), and gape.
- **Body proportions** for every plan are approximate, as are species sizes.
- **Range history**: the checklists are modern. Some species' ranges in the 1400s differed (for example gray fox, which has expanded north recently). This needs checking once the region and nation are chosen.

## Sources

- Formenton M.R. et al. 2019, *Goniometric assessment in French Bulldogs*, Front. Vet. Sci. 6:424 — https://frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2019.00424/full
- *Upper cervical spine motion in Chihuahuas and Labradors*, Front. Vet. Sci. 2021 8:709967 — https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2021.709967/pdf
- *Vertical mandibular range of motion in dogs and cats*, Front. Vet. Sci. 2016 3:51 — https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2016.00051/full
- Elbow and wrist angles in birds and theropods, Zoological Letters 2023 — https://link.springer.com/10.1186/s40851-023-00204-x
- Bird anatomy (vertebrae, synsacrum, pygostyle, toe arrangements) — https://en.wikipedia.org/wiki/Bird_anatomy
- Owl head rotation, Johns Hopkins (ScienceDaily 2013) — https://www.sciencedaily.com/releases/2013/01/130131144102.htm
- Thunder Bay Field Naturalists mammal checklist 2018 — https://tbfn.net/wp-content/uploads/2019/06/TBFN_mammal_checklist_2018.pdf
- Thunder Bay Field Naturalists bird checklist 2025 — https://tbfn.net/wp-content/uploads/2026/01/Bird-checklist-field-copy-2025.pdf

## Skin and fur (wolf first)

The body is now drawn from the skeleton instead of from separate boxes. Code: `src/core/body.ts` (tubes to a skinned mesh), `src/core/wolfBody.ts` (the wolf's tubes), `src/render/fur.ts` (fur), `src/render/playerWolf.ts` (bones and animation). Picture: `tools/wolf-sheet.html`.

- **Tubes.** The body is a handful of tubes: elliptical rings swept along a path (trunk, skull and snout, jaw, ears, four legs, four feet, tail). Each ring lists the bones that move it. Rings near a joint share weight between two bones, so the shoulder, knee and neck bend smoothly with no seams.
- **Rules kept.** The snout is fixed to the skull and its tip is the nose. The lower jaw is its own mesh, hinged at the rear skull base below the ears (cranium bone → jaw bone), and opens only downward. Eyes sit forward in sculpted sockets. Legs are digitigrade 5-bone chains (girdle, upper, lower, foot bone, paw): front shoulder → upper arm → forearm → wrist → paw; rear hip → thigh → stifle (forward) → hock (back) → paw. The tail is a 4-bone chain whose sway lags joint to joint.
- **Proportions.** Every part is sized from published gray-wolf measurements (shoulder height 80–85 cm, skull 23–28 cm long and 13–15 cm wide, ears 9–11 cm, tail 29–50 cm, narrow deep chest, thick neck, large paws; source: Wikipedia "Wolf"). `tests/body.test.ts` measures the built body against those ranges, so a change that makes the wolf too big, too wide or too long fails the tests.
- **Coat.** Colour is made from the seed: grey (most common), tan or black, with small variation. Back, belly and dark parts (nose, paws, ear tips, tail tip) are blended per vertex.
- **Fur.** Hair cards, no image files: about 13,000 tapered strips (3 triangles each) scattered over the base skin by a seeded, area-weighted sampler (`core/surfaceSampler.ts`). Each card leans out of the skin at the root and bends over to lie along the fur direction (`setFromUnitVectors`), so it lies flat head → tail on the body, down the legs and up the ears. Length and width follow the skin's fur multiplier: longest on the neck ruff and tail, shortest on the muzzle, forehead and paws. Colour runs from a dark root to a lighter tip. Cards copy the bone weights of the vertex they grow from and are merged into one SkinnedMesh (`render/furCards.ts`). Coats: timber grey, golden tan, black.
- **Not yet done.** The deer and other animals still use the old boxes. Pups should be darker and lighten as they grow (wolves are born darker), and the coat is not yet tied to the growth stage.
