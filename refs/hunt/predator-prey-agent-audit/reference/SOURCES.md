# Wildlife Reference Photographs — T-0238 Predator-Prey, Clover/Forage, Trace & Agent Pipeline Audit

All four reference photographs are unmanipulated Public Domain field photographs from Wikimedia Commons (National Park Service & U.S. Fish and Wildlife Service), matched 1-to-1 against the four recorded gameplay scenes (`frame-0.png`..`frame-3.png`).

1. **`ref-0-wolf-chasing-stalking-prey.jpg`** (matches `frame-0.png`: predator pursuit, ballistic leap kinematics, and ungulate/prey targeting)
   - **Commons Title**: `File:Wolves and elk.jpg`
   - **Source URL**: <https://commons.wikimedia.org/wiki/File:Wolves_and_elk.jpg>
   - **Author / Agency**: Doug Smith / U.S. National Park Service (Yellowstone Wolf Project)
   - **License**: Public domain (U.S. federal government work)
   - **What it verifies**: Real gray wolves (*Canis lupus*) accelerate smoothly up to bounding/gallop pursuit (`<= 13–30 m/s^2` ground-reaction impulse, never a `240 m/s^2 = 24.5 g` standstill horizontal launch), follow purely ballistic parabolic trajectories once all four paws leave the ground (`0 m/s^2` mid-air lateral turn vs Boreal's `13 m/s^2` mid-air `steerLeap`), and primarily hunt cervids/ungulates (`70–95%` of boreal wolf dietary biomass; Mech & Boitani 2003) rather than excluding `100%` of cervids from `preyList`.

2. **`ref-1-wolf-carrying-prey-in-jaws.jpg`** (matches `frame-1.png`: prey jaw-carry posture, forelimb locomotion while carrying prey, and carcass consumption/sharing)
   - **Commons Title**: `File:Wolf with Caribou Hindquarter.jpg`
   - **Source URL**: <https://commons.wikimedia.org/wiki/File:Wolf_with_Caribou_Hindquarter.jpg>
   - **Author / Agency**: Denali National Park and Preserve / U.S. National Park Service
   - **License**: Public domain (U.S. federal government work)
   - **What it verifies**: A wolf carrying prey in its jaws grips the prey near its center of mass so the carcass hangs downward under gravity (not pitched upward vertically at `+66 deg` on an upper canine), uses both forelimbs normally in alternating stance/swing stride underneath the shoulders (`0.0 rad` carry bias on forelegs during locomotion, never `+0.9 rad` outstretched forepaw-pin lock on both forelegs while running at `6 m/s`), requires real forepaw pinning (`~0.5–1.5 s`) and multi-minute tearing/chewing bouts (`~120–600 s`) rather than a `0.00 s` synchronous `pin -> bite -> hold` overwrite and `0.00 s` instant swallow, and provisions dependent pups at the rendezvous/litter site (Mech, Wolf & Packard 1999).

3. **`ref-2-snowshoe-hare-foraging-clover-grass.jpg`** (matches `frame-0.png` & `frame-2.png`: snowshoe hare herbaceous clover/graminoid grazing vs Boreal's unmounted clover field)
   - **Commons Title**: `File:Snowshoe hare eating grass.jpg`
   - **Source URL**: <https://commons.wikimedia.org/wiki/File:Snowshoe_hare_eating_grass.jpg>
   - **Author / Agency**: U.S. Fish and Wildlife Service
   - **License**: Public domain (U.S. federal government work)
   - **What it verifies**: Wild snowshoe hares (*Lepus americanus*) spend active foraging bouts cropping herbaceous ground cover (`Trifolium` clover, graminoids, and low forbs: ~`167 g` DM / `~550–670 g` fresh herbage per day, depositing `~576` fecal pellets/day; Belovsky 1984; Hodges 2000), recruiting across real boreal understory cover rather than spawning in a `5`-hare `18–45 m` ring around the player on a `25–45 s` wall timer over an empty `SimWorld.food = []` list (`createCloverField` unmounted in the live game).

4. **`ref-3-white-tailed-deer-alert-boreal-forest.jpg`** (matches `frame-3.png`: white-tailed deer long-range `60–150 m` vigilance, ear/head orientation, and flight initiation)
   - **Commons Title**: `File:White tailed doe odocoileus virginianus standing alertly in low brush and looking.jpg`
   - **Source URL**: <https://commons.wikimedia.org/wiki/File:White_tailed_doe_odocoileus_virginianus_standing_alertly_in_low_brush_and_looking.jpg>
   - **Author / Agency**: Steve Hillebrand / U.S. Fish and Wildlife Service
   - **License**: Public domain (U.S. federal government work)
   - **What it verifies**: Northern white-tailed deer (*Odocoileus virginianus*) actively scan, flick ears, snort, browse, and initiate alert/flight responses to cursorial canids at `50–150 m` (sight `80 m`, hearing `60 m`, downwind scent `150 m`; Lingle & Wilson 2001; Stankowich & Coss 2006), never standing frozen like un-animated statues at `40–90 m` because `withinEarshot` (`PLAYER_HEARING_RADIUS = 40 m`) prematurely skips `stepAgent` and `rig.animate(dt)` while `paintPopulation` keeps their 3D meshes visible.
