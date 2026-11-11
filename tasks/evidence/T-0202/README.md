# T-0202 frames

SwiftShader, 1280×720. URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`.

HUD on both loads: prairie, vegetation 0.33, water false, 49.77 N, 65.54 E, elevation 216 m, day 227, about 08:43, sun about 37°, snow 0. Census: red fox.

Before is main `28fad190`. After is this branch.

| frame | what it shows |
|---|---|
| `before-eye40.png` | Floating ground plates, a flat blue-grey horizon, a brown smear on the left, and spruce poles with leaf cards. No feather-grass tufts. |
| `before-eye1.7.png` | Standing eye behind the wolf. Full spruce and a leafy pole, a grey water sheet, bare dirt with short sprouts, smooth tan pups. |
| `after-eye40.png` | The poles and the teal sheet are gone. The floating plates, the flat blue horizon, and the brown smear are still there. Tufts are not readable at this height. Dark-green pixel count in the view (green well above red, red under 70) fell from 302 to 0. |
| `after-eye1.7.png` | Re-shot after the merge of main `28fad190`, same URL, standing eye, clock 08:43. Straw tufts fill the foreground (805 in the near field). No spruce. The wolf has turned since the previous after, so the far ridge is a different slice and a little blue shows at the right (about 4% of that window). The horizon is still a pale cut. |

The spruce count is pixels with red under 70, green above red by 35, green above blue by 20, and green under 180. That scores 32 on the previous after and 0 on this re-shot. A spruce in the before frame is hundreds of those pixels.
