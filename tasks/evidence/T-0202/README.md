# T-0202 frames

SwiftShader, 1280×720. URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`.

HUD on both loads: prairie, vegetation 0.33, water false, 49.77 N, 65.54 E, elevation 216 m, day 227, about 08:43, sun about 37°, snow 0. Census: red fox.

Before is main `28fad190`. After is this branch.

| frame | what it shows |
|---|---|
| `before-eye40.png` | Floating ground plates, a flat blue-grey horizon, a brown smear on the left, and spruce poles with leaf cards. No feather-grass tufts. |
| `before-eye1.7.png` | Standing eye behind the wolf. Full spruce and a leafy pole, a grey water sheet, bare dirt with short sprouts, smooth tan pups. |
| `after-eye40.png` | The poles and the teal sheet are gone. The floating plates, the flat blue horizon, and the brown smear are still there. Tufts are not readable at this height. Dark-green pixel count in the view (green well above red, red under 70) fell from 302 to 0. |
| `after-eye1.7.png` | Straw tufts fill the foreground around the wolf. They read as knee-high clumps, not poles. No spruce. No water sheet. The same dark-green count fell from 1741 to 32. The ground past the tufts is still bare soil. The horizon is still a flat cut. |

The 32 leftover dark-green pixels are not a tree. A spruce in the before frame is hundreds to thousands of those pixels.
