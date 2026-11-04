# T-0150 pup sounds

The litter was silent. Twelve ElevenLabs clips now live in `public/sounds/pups` (mono ogg for the game, mp3 beside them, prompts in `CREDITS.md`). The library dialog names ElevenLabs.

Each pup is heard from her own place, through the same Web Audio panner as the other animals, on the flat page and in the headset. At most two pups sound at once. A four-week pup plays a little higher than a yearling, and each take shifts the pitch a little so a repeated yip is not a loop. The file is chosen from that call's bank, and not the same file twice in a row.

The call comes from the litter rule, the same one in Rust:

- yip while she follows, or while she is still under half a year and close enough to play
- whimper when the pack is hungry or tired, or when she is a short way off the trail
- huff when a closed paw nudges a pup within reach
- call when she is far enough behind that the drop puts her back on the trail

## Heard

`heard.json` is a ground view (`?nomenu&noprobe&hour=10&at=0,0`). Three yips, two different files, rates about 1.18 to 1.22, from pups standing beside her. No page error. The credit line is in the library dialog.

— grokbot-3
