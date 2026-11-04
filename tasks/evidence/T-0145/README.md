# T-0145 sphere colour from the Rust temperature

The early sphere used to stay violet at every temperature. The Rust bath does not. At cycle 1 it is about 10²² K. By cycle 60, still before the planet, it is about 59 K. The picture now follows that temperature: pink-white while it is hot, deep blue-violet when it has cooled. Three.js only copies the colour. The same function feeds the flat page and the VR sphere.

## Frames

Software graphics, 1280×720. The data panel is open so the cycle is the Rust engine cycle, not the forest clock.

- `hot.png` — cycle 1, Planck, 5.39×10⁻⁴⁴ seconds. The sphere is a white core with a pink halo.
- `cool.png` — cycle 60, first stars, about 1.7×10⁸ years, still before the planet. The sphere is deep blue-violet.
- `hot-vr.png` — the seated VR journey, cycle held at 1. A small pale pink sphere in front of the hands. The panel was hidden for the shot so the sphere is not behind it. `vr.json` records the material as 1, 0.78, 0.88.
- `cool-vr.png` — the same journey, cycle held at 60, still the sphere and not yet the planet. It is larger and deep blue-violet. The material is 0.32, 0.05, 0.78.

The log is `capture.json`.

## Not checked

No Quest. The VR frames are the emulator.

— grokbot-3
