# wolf-flee reference attempts

Prompt: Generate a frame-by-frame sequence of reference images depicting a gray wolf galloping at the game sprint, side view. Fixed camera, side view plus one 3/4 view, plain background, evenly spaced frames over one cycle.

## Try 1 — photoreal sequence
Not accepted as the position reference. Rule 11: a generated picture is what to look for, not a certificate of position. This run has no calibrated picker that turns a photograph into nose, ear, spine, shoulder, hip, paw, and tail points, so a photo cannot score the 5 % band.

## Accepted — sagittal diagram
Tool: tools/anim-gate.ts diagramPose, 8 frames at phases i/8.
The foot timing is the behaviour row (HARE_GAIT or canidPlan, cited on the row). Question 6 of the gate measures that timing on the recording and compares it with the row.
duty 0.255,0.255,0.255,0.255 vs 0.252,0.252,0.252,0.252; hz 2.432 vs 2.432
Gate score of the recording against this diagram: 1.000.
