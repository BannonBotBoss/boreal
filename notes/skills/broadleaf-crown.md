# Skill: a broadleaf crown is an oval, not a ball on a stick

Use when a birch, aspen, or poplar reads as a green icosahedron on a trunk.

## Search before writing

1. Conifers already use `spireCrown` in `src/render/trees.ts` (uneven whorls). Do not put a birch on that path.
2. Black spruce in the near ring is trees v2 (`src/render/trees/game.ts`). Birch is not in `TREES_V2.species`, so it still takes the old builder.
3. The old builder's `blob` was `icosphere` from `src/render/rocks.ts`. That is the lollipop. The billboard atlas (`src/render/trees/billboardAtlas.ts`) is a flat card, not this mesh.

## Steps

1. Build the crown as stacked ragged rings (`broadleafCrown`). Paper birch is narrowly oval (Farrar 1995). Jack pine stays wider.
2. Keep a few real limbs at full detail. The far LOD is the oval only, so the stick does not end in a ball.
3. Score the leaf cloud with `crownShape`: vertex count, radius spread, and height over width.

## Checks

- `tests/birch-crown.test.ts`. A lollipop is under 80 leaf vertices, or a sphere (`cv` under 0.1 and aspect under 1.05). Paper birch at detail 1 and 2 fails that and is taller than it is wide.
- The 40 m eye frame, before and after, at the same URL.

## Mistakes to avoid

- Do not add birch to the black-spruce Weber-Penn batch in the same change. That path is conifer cards.
- Do not bring `IcosahedronGeometry` back. `tests/rules.test.ts` only lets that builder shrink.
