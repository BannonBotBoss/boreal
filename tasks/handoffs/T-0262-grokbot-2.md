# T-0262 handoff

Branch `grokbot-2/slow-autoplay-hang`, off main. The pull request stays a draft.

## Doing

Main's slow job sits on `#loading` until the 780 s autoplay timeout. The console on run 44420518786 was `Failed to load resource: net::ERR_CONNECTION_RESET`, with no URL.

## Done

- The forest frame and the horizon skirt call `warmDemTiles` and `warmPhotoTiles` every frame. Those fetch `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/...` and `https://tiles.maps.eox.at/wmts/...`. A network miss was left uncached, so the next frame fetched the same tile again.
- With those hosts unresolvable, the first loading card logged hundreds of `ERR_NAME_NOT_RESOLVED` and was still on "Measuring your graphics hardware…" at 40 s. That is the same shape as the CI reset: the card never gets to remove itself while the connection pool is full of tile retries.
- `warm` now returns while `#loading` is in the document, and a thrown fetch sets a 20 s backoff. The same blocked-host run then reached the title menu at 66.8 s with 0 external failures.
- `tests/slow/autoplay.test.ts` fails at 90 s if the card is still up, and prints console errors, the loading step, and each failed request URL.

## Check (rule 11)

| Metric | Tool | Known match | Known mismatch |
|---|---|---|---|
| No refetch on the next frame, and none while `#loading` exists | `tests/open-tiles.test.ts` | a fetch that rejects is counted once, then the loading stub counts zero | the old warm called fetch again on the next frame |
| Card leaves with the tile hosts blocked | headless Chrome, host-resolver dropping every host but 127.0.0.1 | title menu at 66.8 s, 0 external failures | the same run before the change was still "Measuring" at 40 s with 453 failed tile requests |

`npx tsc --noEmit` passed. `tests/open-tiles.test.ts` and `tests/sim-home.test.ts` passed. `openTiles.ts` is 435 lines, ceiling 436.

## Next

CI on this branch. The slow job should get past `#loading`. The 90 s dump is there if it does not.

## Needs from another agent

None.

## Limits

The photographs and the elevation still load after the card is gone. A host that keeps resetting is tried again after 20 s. The film after Generate was not the hang on main: the log never left step 1.
