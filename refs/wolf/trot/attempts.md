# wolf-trot reference attempts

Prompt: Generate a frame-by-frame sequence of reference images depicting a gray wolf trotting at the measured canid trot, side view. Fixed camera, side view plus one 3/4 view, plain background, evenly spaced frames over one cycle.

## Try 1 — photoreal sequence
Not accepted as the position reference. Rule 11: a generated picture is what to look for, not a certificate of position. This run has no calibrated picker that turns a photograph into nose, ear, spine, shoulder, hip, paw, and tail points, so a photo cannot score the 5 % band.

## Accepted — sagittal diagram
Tool: tools/anim-gate.ts diagramPose, 8 frames at phases i/8.
The foot timing is the behaviour row (HARE_GAIT or canidPlan, cited on the row). Question 6 of the gate measures that timing on the recording and compares it with the row.
duty 0.450,0.455,0.455,0.450 vs 0.450,0.450,0.450,0.450; hz 2.100 vs 2.100
Gate score of the recording against this diagram: 1.000.
