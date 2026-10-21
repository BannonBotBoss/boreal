---
id: T-0020
title: Every behaviour has an animation, gated by generated frame-by-frame reference images (95% match)
author: grok
scratch: true
research: true
skill: false
tags: [animation, behaviour, quality-gate]
credits: 90
---
# T-0020 Behaviour = animation, with a reference-image quality gate

**Status: proposed by grok (2026-10-21 10:35 PT), on Matthew's instruction. Open claim: no owner.** Ownership is claim-based.

**Credits: 90** (= 10 x 5 objectives x (1 + 0.5 scratch + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Every behaviour an agent can be in (graze, alert/head-up, flee, trot, rest, scan, stalk, crawl, leap, pin, bite, carry, consume, release, drink, sleep, ...) maps 1:1 to an animation. Each animation is built against a reference and must pass a quality gate before it ships.

## Pipeline (Matthew, 2026-10-21)
1. The animation asks: **"What is happening?"** The behaviour emits a short, concrete description of the real-world action (species, action, phase, terrain, speed), e.g. "a snowshoe hare grazing clover with its head down, then lifting its head to scan, side view".
2. An agent converts that description into an image-generation prompt: **"Generate a frame-by-frame sequence of reference images depicting [object behaviour description]."** (fixed camera, side view plus one 3/4 view, plain background, evenly spaced frames over one cycle).
3. The reference frames are saved under `refs/<species>/<behaviour>/` with the prompt, tool and date.
4. The animation itself is **procedurally generated** (driven by the gait/pose solvers and species data, no hand keyframes or baked clips). The reference is only the target it is tested against.
5. The animator uses that reference as its **quality gate**: the animation must resemble the reference by **at least 95%**.

## Why
Behaviours are becoming need-driven (T-0009 onward), so each new state needs an animation that reads as the real animal doing that thing. Today several states share one pose or have none (e.g. the hare is a root position plus tilt; the wolf has no crawl, pin, bite or carry pose).

## Files
- `src/core/behaviourData.ts` (behaviour -> animation id + "what is happening" description)
- `tools/ref-prompt.ts` (description -> generation prompt; writes refs/<species>/<behaviour>/meta.json)
- `tools/anim-gate.ts` (renders the in-game animation with the existing strip tools, e.g. tools/run-strip.ts / strip-shot.mjs, at the reference's camera and frame times, and scores it)
- `refs/` (reference frames + metadata)

## Quality test: a series of questions (Matthew, 2026-10-21)
The gate is a fixed list of questions, each answered pass/fail from data, asked of every animation:
1. **Recording:** when I record my animation (in game, fixed camera matching the reference) and sample it frame by frame at the reference's frame times, do I get the same number of frames over one cycle?
2. **Overall match:** do my sampled frames match the reference frames, frame for frame? (silhouette overlap after scale and position normalisation)
3. **Body parts:** in each frame, are the nose, ears, spine, shoulders, hips, four paws and tail where the reference has them? (fraction of key points within 5% of body length)
4. **Order and timing:** do the phases happen in the same order and at the same points in the cycle (e.g. which paws are down, head down vs head up, airborne)?
5. **Contact:** do feet, jaws and body touch the ground or target in the same frames as the reference?
6. **Real data:** do cadence, stride and duty factor agree with measured data where it exists (gaitData sources)?
Score = share of questions passed, weighted by frame; **pass at >= 0.95**. The tool prints each question with its answer and the frames that failed, next to a side-by-side strip (recording above, reference below).
## Size and risk
- Size: L
- Risk: medium (generated references can be anatomically wrong: check each set against real footage or photos before using it as a gate)

## Depends on
- T-0009 (behaviour states come from the shared agent core)

## What Matthew will see
Every action an animal takes has its own animation that looks like the real animal doing it, with a side-by-side reference strip and a pass score for each one.

## Acceptance criteria
- Every behaviour state in behaviourData maps to an animation id; a test fails if one is missing
- Each animation has a reference set in refs/ generated from its "what is happening" prompt
- tools/anim-gate.ts produces a side-by-side strip and a score per animation; >= 0.95 to pass
- The hare's graze / head-up / flee and the wolf's stalk / leap / pin / bite / carry are the first ones through the gate

## Objectives
- [ ] Behaviour -> animation map and "what is happening" descriptions in behaviourData
- [ ] Reference prompt tool and refs/ layout
- [ ] Animation gate: record, sample frame by frame, answer the question list, side-by-side strip
- [ ] First animations through the gate (hare set, then wolf hunting set)
- [ ] Tests
