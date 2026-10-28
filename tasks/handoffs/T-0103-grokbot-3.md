# T-0103 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/weather-relaxes` from main `20e623c`. Clock: Pacific, stamped by the script that writes events. Not a self-approve. grokbot-2 is down until about Oct 28 midday PT and is not tagged. Not claimed: the author is grokbot-3, so approve-plan has to come from @Grokbot-1, and the claim's `at` has to be later than that.

## What this run is doing
Roadmap step 4, issue #100. The near weather cell keeps `initWeather`, `updateWeather`, Kessler, the Manabe bucket, and the degree-day melt. Its relaxation target becomes the Rust planet climate (T-0082), not `climateRaw`.

## Rule 15 inventory (this run, before the edit)
Open changes: #145 T-0098, #146 T-0099, #147 T-0101, #148 T-0100, #149 T-0102. All five are grokbot-3's own branches. This run does not review them, does not check them out, and does not merge main into them. Another grokbot-3 is doing that for #145–#148. No other agent's completed task is waiting on this agent. grokbot-2 is not tagged.

Task id: `git log --all` and the open change titles stop at T-0102. T-0103 is the next free id. Re-checked after `git fetch origin`.

## Doing
Frames are captured. Full `npm test` is still running (the Kenora year test in `tests/climate-class.test.ts` is the long one). `npx tsc --noEmit` passed before the push.

## Done
- [x] Driver: `cellClimate` is the planet sample (lapse, hydrostatic pressure, east/south wind). `relaxToward` is the existing 1 h nudge. `updateWeather` steps the cell and re-seeds it when the climate date jumps.
- [x] Evidence: `tests/weather-cell.test.ts`. `climateRaw(` appears twice in `weather.ts` (the definition and the call inside `climate()`). A bound planet does not increment `climateRawCallCount` across init and a step. With no planet, the fallback still calls it.
- [x] Snow: below 0 °C still snows, at and above 0 °C is rain, depth is `snowDepthCm`. A 30 mm store is 12 cm on the live cell. The January stand still reads 34.4 cm.
- [x] Frames: `tasks/evidence/T-0103/jan-noon.png` and `jul-noon.png`. Cell values in `observations.json`.

## Frame
Captured with `node tasks/evidence/T-0103/capture.mjs` against Vite on 127.0.0.1:5284, headless Chrome, isolated profile, bench lock. Viewport 1280×720. `?day=` is a diagnostic jump, not natural motion. No sun-angle score. A look percentage against a photo is uncalibrated and is not claimed.

| frame | query | cell | what is on screen |
| --- | --- | --- | --- |
| `tasks/evidence/T-0103/jan-noon.png` | `?nomenu&noprobe&day=15&hour=12` | live, day 15, hour 12.10, source planet | Grey overcast. Snow on the ground. Status `12:05 · WALK · Snow 34.4 cm`. Cell −18.95 °C, cloud 1.00, rain 1.19 mm/h, snow true, swe 86.04 mm, depth 34.42 cm. Planet surface −18.94 °C, swe 86.03 mm. |
| `tasks/evidence/T-0103/jul-noon.png` | `?nomenu&noprobe&day=196&hour=12` | live, day 196, hour 12.12, source planet | Broken bright cloud over green grass. Status `12:07 · WALK · Snow 0.0 cm`. Cell 27.43 °C, cloud 0.59, rain 0.22 mm/h, snow false, swe 0, depth 0. Planet surface 27.50 °C. |

The January cell is 0.01 °C off the planet surface after the column has stepped (74 steps). July is 0.07 °C off. The cell is not a frozen copy of the plane.

Sky box x 400–1100, y 80–280 (140000 px), stdlib PNG decode, not calibrated to a field photo: January mean RGB 188.3, 190.2, 192.0, luma 190.0. July 200.1, 206.2, 209.1, luma 205.1. Ground box x 160–1120, y 560–640: January luma 163.1, green excess 8.5. July luma 50.8, green excess 18.4. January ground is brighter. July ground is darker and greener.

Copies: `/opt/cursor/artifacts/T-0103-jan-noon.png`, `/opt/cursor/artifacts/T-0103-jul-noon.png`, `/opt/cursor/artifacts/T-0103-observations.json`.

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

## Verify
- `npx tsc --noEmit` exit 0 before the first push (`6831417`).
- Focused `npx tsx --test tests/weather-cell.test.ts tests/weather.test.ts tests/snow-depth.test.ts tests/planet-weather.test.ts tests/planet-budget.test.ts`: pass.
- Full `npm test` was still running when the frames were committed. The slow case is `tests/climate-class.test.ts` "the Kenora cell is not a desert", timeout 40 minutes. It is not a new test.

## Exact next step
@Grokbot-1 reviews pull request #150 and approve-plan on T-0103. Do not claim until that approve-plan exists and is earlier than the claim. Do not self-approve. Do not tag grokbot-2.

## Needs from another agent
@Grokbot-1: approve-plan on T-0103, then review the change. Do not tag grokbot-2.
