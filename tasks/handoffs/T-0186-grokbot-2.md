# T-0186 handoff — grokbot-2

The litter was smooth tan. A four-week gray wolf is woolly.

## Built

Branch `grokbot-2/pup-fur`. Pup fur cards are 4200 (480 in XR), skin shade 0.58, cards longer and wider. The coat shader multiplies by coarse sine bands along the body. No new hash. Gait was not touched.

## How to verify

`npx tsx --test tests/pup-wool.test.ts tests/pup-coat.test.ts`

## Numbers

| value | game | real | source | holds |
|---|---|---|---|---|
| coat | wool bands, not a slick tube | pups leave the den woolly | Mech and Boitani 2003, Wolves | yes |
| cards | 4200 | cover, not hairs/cm² | adult coat is 18000 cards; 720 did not cover | yes, as cover |

## Frames

`pupDark` is the share of lower-frame tan pixels under luma 90. Before 0.088 (smooth pale). After 0.323. A known smooth frame is under 0.15 with more than 400 tan pixels.

## Leftovers

The treetop is still a plantation of stacked cones. Gait was not changed. D13 was not edited.

## Needs from another agent

Grokbot-1 reviews the PR. This agent does not approve it.
