# Skill: system-properties

Adding a system or a tunable figure to Boreal's one systems properties file (first used by T-0037), so Matthew can see how
everything is rigged up in docs/system-map.md.

## The file
`src/config/systemProperties.ts`, pure data (imports nothing, so workers, tools and tests can read it):
- `SYSTEM_PROPERTIES`: one top-level key per group, alphabetical, `/** one-line comment */ key: value`, `as const`.
  Same shape on every branch (T-0035 autoFocus/targetGlow, T-0036 needsThoughts), so parallel groups merge as whole sections.
- `PROPERTY_META[group]`: `readers` (modules that read the group) and `keys[key] = [units, source]`; source is a citation,
  "Matthew" (his spec), "design", or "estimate (game calibration)". Never leave a real-world number as an estimate if a source
  exists (rule 6): look it up, cite it, and add it to the task's number table.
- `SYSTEM_MAP[system]`: title, what, modules, groups, `dependsOn` (the "feeds" direction is derived), URL `flags`, `tables`
  (links `src/path.ts#EXPORT` to big data tables that stay in their module) and `remaining` (figures still at a call site).
- `PENDING_GROUPS`: groups another branch is adding (so the wiring is complete before they land).

## Steps: move a figure in
1. Find it: module-top literals, exported tuning objects, settings-schema defaults (core/renderSettings RENDER_SETTINGS
   applies its `default` over the module's object at load, so a figure there must be read from the file too, as Menu > Feel does).
2. Check no open branch is editing that file: `git diff --name-only main...<branch> -- src` for each live branch. If one is,
   link it in `tables` / `remaining` instead and move it after that branch merges.
3. Add the figure to its group (or a new group), with a comment that names the unit; add `[units, source]` to PROPERTY_META.
4. In the module keep the old export name and read the file: `export const X: number = SYSTEM_PROPERTIES.g.k;` (annotate `: number`
   or `as number`, or `let a = X` infers a literal type), or `export const OBJ = live(SYSTEM_PROPERTIES.g)` (src/config/live.ts:
   a widened, mutable clone) when settings change the object at runtime. Always write `SYSTEM_PROPERTIES.<group>` literally
   (no alias import): the test greps each reader for it.
5. Add the pre-move value to the values-lock test in tests/system-properties.test.ts (behaviour must not change).
6. `npm run system-map`, then `npm test` and `npx tsc --noEmit`; commit one system at a time.

## Steps: add a system
Add a `SystemId`, a `SYSTEM_MAP` entry (modules must exist; tables must name a real export), wire `dependsOn` both ways by
thinking "whose output does it read?", list its URL flags, regenerate the doc.

## Checks that prove it
tests/system-properties.test.ts: values lock; every figure has units + source; every reader really reads its group; each group
belongs to one system; dependencies are known systems; modules and linked exports exist; docs/system-map.md equals
renderSystemMap() (CRLF-insensitive).

## Mistakes to avoid
- Editing on Windows-checked-out files from Linux: the repo stores CRLF; keep the file's line endings (Python
  `open(p, newline='')`) or the diff rewrites every line.
- Merging a branch that also created the file is an add/add conflict: keep every group, alphabetical, then add the new groups'
  PROPERTY_META and claim them in SYSTEM_MAP (drop them from PENDING_GROUPS), regenerate the doc.
- Do not inline big tables (species, gaits, quality LADDER, materials, flora): link them.
- Do not import game modules into the properties file (cycles, workers).
