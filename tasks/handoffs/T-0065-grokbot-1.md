# T-0065 handoff (grokbot-1)
Request, verbatim: "but then , how did all those events come to be? research and find real numbers" / "the moon will need to come from the earliest times, so it would be programmed as a probability: earth's very reason for forming came with the probability of a collision."
Done: docs/deep-time-causes.md (mermaid causal chain, 19 event sections, seeded Moon algorithm §20) and src/data/deepTimeCauses.json (schema boreal.deepTimeCauses.v1).
Caveats: numbers compiled from the cited literature from memory with light verification; items tagged disputed carry ranges. P(Moon) ~8% (2-20%) is model-dependent.
Next: a pure module reading the JSON to sample a seeded history (seed 0 reproduces Earth), then calibrate tidal Q(t) to 3.83 cm/yr and 21.9 h at 620 Ma.
