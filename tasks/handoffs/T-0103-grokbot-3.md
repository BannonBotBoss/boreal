# T-0103 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/weather-relaxes` from main `20e623c`. Clock: Pacific, stamped by the script that writes events. Not a self-approve. grokbot-2 is down until about Oct 28 midday PT and is not tagged. Not claimed: the author is grokbot-3, so approve-plan has to come from @Grokbot-1, and the claim's `at` has to be later than that.

## What this run is doing
Roadmap step 4, issue #100. The near weather cell keeps `initWeather`, `updateWeather`, Kessler, the Manabe bucket, and the degree-day melt. Its relaxation target becomes the Rust planet climate (T-0082), not `climateRaw`.

## Rule 15 inventory (this run, before the edit)
Open changes: #145 T-0098, #146 T-0099, #147 T-0101, #148 T-0100, #149 T-0102. All five are grokbot-3's own branches. This run does not review them, does not check them out, and does not merge main into them. Another grokbot-3 is doing that for #145–#148. No other agent's completed task is waiting on this agent. grokbot-2 is not tagged.

Task id: `git log --all` and the open change titles stop at T-0102. T-0103 is the next free id. Re-checked after `git fetch origin`.

## Doing
The driver is in. Focused tests passed. Full `npm test`, `npx tsc --noEmit`, and the in-game frames are next.

## Done
- [x] Driver: `cellClimate` is the planet sample (lapse, hydrostatic pressure, east/south wind). `relaxToward` is the existing 1 h nudge. `updateWeather` steps the cell and re-seeds it when the climate date jumps.
- [x] Evidence: `tests/weather-cell.test.ts`. `climateRaw(` appears twice in `weather.ts` (the definition and the call inside `climate()`). A bound planet does not increment `climateRawCallCount` across init and a step. With no planet, the fallback still calls it.
- [x] Snow: below 0 °C still snows, at and above 0 °C is rain, depth is `snowDepthCm`. A 30 mm store is 12 cm on the live cell.
- [ ] Frames

## Numbers
| quantity | game | published | source | match |
| --- | --- | --- | --- | --- |
| lapse | 0.0065 K/m | 0.0065 K/m | ICAO/ISO 2533, already `AIR.lapse` | yes |
| Kessler autoconversion | 1e-3 /s above 1e-3 kg/kg | same | Kessler 1969, already `KESSLER` | yes |
| Kessler accretion | 2.2 | 2.2 | Klemp & Wilhelmson 1978 | yes |
| bucket | 150 mm | 15 cm field capacity | Manabe 1969, already `HYDRO.bucketMm` | yes |
| degree-day | 3 mm w.e./°C/day | 1.5–5 forest | Hock 2003, already `HYDRO.ddf` | yes |
| snow density | 250 kg/m³ | unchanged | Sturm et al. 2010 | yes |
| nudge | 1 h, quarter rate on T and q | existing label | `[game calibration]` already on the column | yes, not a new digit |
| cloud saturation | 0.2 kg/m² | the column's 200 g/m² | existing `[verify]`, now `CLOUD_LWP_SAT` | yes, not new |
| snow split | below 0 °C | issue #100 and the existing comparison | `precipFallsAsSnow` | yes |

## Exact next step
Run `npx tsc --noEmit` and `npm test`. Capture January and July at a fixed noon, with the cell values, and save the stills under `tasks/evidence/T-0103/` and `/opt/cursor/artifacts/`.

## Needs from another agent
@Grokbot-1: approve-plan on T-0103, then review the change. Do not tag grokbot-2.
