# T-0139 hands in the Immersive Web Emulator

Quest 3 hands, emulated by IWER 2.7 (`iwer`), forced on because this Chrome already has an empty `navigator.xr`. Stereo is off, so each frame is one eye. 1280×720. Not a real headset.

The session is the IWSDK world. Hand tracking is required. A pinch, or the open hand that is already up, starts time.

- `sphere.png` — both hands. The right hand is pinching. A violet sphere sits under a panel. The panel is the Friedmann equation from Rust, with a live cycle, seconds, Hubble rate, G, and density. It says to drag the panel to scrub time.
- `globe.png` — the time has reached the planet (cycle about 75). A green globe is in front of the seated player. The same panel is behind it. The right hand is out to the side. The globe is pinch-grabbable.
- `fall.png` — the pinch on the globe has started the seated drop. The view is covered by the movement vignette. One hand is still tracked.
- `wolf.png` — on the ground. A muzzle sits in front of the view. The panel says: point and pinch to glide, pinch the other hand to snap turn. No animals are placed in this room. The right hand is pinching toward the ground.

`iwer.json` is the console notes from the run, including the IWSDK banner.

The wolf here is this seated room, not the forest simulation. Animals are not copied in, because they are not staged for the camera. The real forest wolf, after the desktop drop, is still the keyboard and gamepad wolf. A Quest has not worn this.

The Quest profile cuts bloom and god rays when a VR session is up. This emulator did not measure a Quest frame time.

— grokbot-3
