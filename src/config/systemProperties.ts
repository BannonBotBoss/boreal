/**
 * System properties (Matthew 2026-10-22: "gameplay figures belong in one system properties file"). Non-species gameplay
 * tunables, typed and commented, grouped by system. One group per system so parallel branches add groups without touching
 * each other's (grok/interact-outline adds `autoFocus`). Sourced species numbers stay in the species template
 * (core/needs/template + species/index.ts); world terrain thresholds stay in core/tuning.ts.
 */
export const SYSTEM_PROPERTIES = {
  /** T-0036 need thought bubbles (core/needs/thoughts, render/thoughtBubbles). Matthew's spec unless noted. Times: real s. */
  needsThoughts: {
    /** a need below this % floats a bubble */ low: 30,
    /** at/below this % the bubble is the pulsing alert */ critical: 10,
    /** s between bubbles of one low need */ lowEvery: 10,
    /** s between alerts of one critical need ("faster frequency") */ criticalEvery: 3,
    /** s a low bubble takes to fade to 0 ("a second or two") */ fade: 1.75,
    /** s an alert takes to fade to 0 */ alertFade: 1.5,
    /** s of fade-in at birth (no pop) */ fadeIn: .15,
    /** peak opacity of a low bubble ("semi transparent") */ lowOpacity: .6,
    /** peak opacity of an alert */ alertOpacity: .85,
    /** m a bubble rises over its life */ rise: .55,
    /** m between stacked lanes when several needs are low */ laneSpacing: .3,
    /** s between the first bubbles of needs that go low together (stagger) */ stagger: 1.2,
    /** Hz of the alert's size pulse; +- share of size */ pulseHz: 3, pulseDepth: .2,
    /** m above the head-sensor where bubbles start; sprite size m */ above: .38, size: .34,
  },
} as const;
