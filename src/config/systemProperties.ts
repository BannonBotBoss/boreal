/**
 * System properties: the adjustable figures of the game's systems, one commented, typed section per system.
 * Matthew 2026-10-22 ~01:20 PT: "just add those figures to a system properties file."
 * Code reads from here; change a figure here, not at the call site. Keep one top-level key per system (alphabetical) so
 * parallel branches each add their own section and merge without touching each other's lines.
 * (World / terrain thresholds stay in core/tuning.ts, rendering quality tiers in core/renderSettings.ts.)
 */
export const SYSTEM_PROPERTIES = {
  /** Held focus (core/focusLock, T-0035): hold the button to lock the wolf's attention on an object; keep within the radius to keep it. */
  autoFocus: {
    /** Engage and keep-lock radius, metres. From Matthew's red guideline ring (screenshot 01M5HB26..., 2026-10-22): its widest
     *  lateral extent projected onto the ground with the game camera (1.6 m up, 3 m back, 10 deg pitch, 48 deg fov) = 4.5 m. */
    radius: 4.5,
    /** View cone for picking a target: cosine of the angle off the view direction (0.4 = about 66 deg either side). */
    cone: .4,
    /** Auto-steer turn rate, rad/s: the player's own full-stick steering rate (main.ts), so focus never turns faster than the stick. */
    turnRateRadS: 2.2,
    /** Default binding (rebindable in Menu > Controls): gamepad LB (not otherwise bound), keyboard F. */
    binding: { keys: ['f'], pad: ['lb'] },
    /** Object kinds that can never be focused (pebbles: interactable only at nose contact, dozens per patch). */
    excludeKinds: ['rock'],
    /** Camera while locked: field of view (deg) and how fast it eases in / out (1/s); no snap. */
    cameraFovDeg: 36, cameraEase: 8,
    /** Hide the senses halo ring while a target is locked, so the target's glow is the only cue. */
    hideSensesHalo: true,
  },
  /** Target glow (render/targetGlow, T-0035): soft outline tracing the interaction / focus target (three r180 OutlinePass). */
  targetGlow: {
    /** Glow colour (warm cream). */
    color: 0xffd89a,
    /** Thin-edge brightness, wide-glow strength and edge width (OutlinePass edgeStrength / edgeGlow / edgeThickness). */
    edgeStrength: 1.8, edgeGlow: 1.0, edgeThickness: 1.6,
  },
} as const;