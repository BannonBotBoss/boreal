/**
 * Reference prompt and refs/ layout (T-0020). The prompt is the fixed sentence around the behaviour's
 * "what is happening" line. The frames written here are the diagram the gate scores, not a photograph.
 * Rule 11: a generated picture is a reference for what to look for, not a certificate of position.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BEHAVIOURS, type BehaviourAnim } from '../src/core/behaviourData';
import { FRAME_N, diagramPose, frameSvg, gateLines, scoreAnimation, seeFrames, stripSvg } from './anim-gate';

export function generationPrompt(b: BehaviourAnim) {
  return `Generate a frame-by-frame sequence of reference images depicting ${b.happening}. Fixed camera, side view plus one 3/4 view, plain background, evenly spaced frames over one cycle.`;
}

export function attemptsMarkdown(b: BehaviourAnim, q6: string, score: number) {
  return `# ${b.id} reference attempts

Prompt: ${generationPrompt(b)}

## Try 1 — photoreal sequence
Not accepted as the position reference. Rule 11: a generated picture is what to look for, not a certificate of position. This run has no calibrated picker that turns a photograph into nose, ear, spine, shoulder, hip, paw, and tail points, so a photo cannot score the 5 % band.

## Accepted — sagittal diagram
Tool: tools/anim-gate.ts diagramPose, ${FRAME_N} frames at phases i/${FRAME_N}.
The foot timing is the behaviour row (HARE_GAIT or canidPlan, cited on the row). Question 6 of the gate measures that timing on the recording and compares it with the row.
${q6}
Gate score of the recording against this diagram: ${score.toFixed(3)}.
`;
}

/** Writes meta.json, attempts.md, see.txt, strip.svg, and reference/frame-N.svg for every behaviour. */
export function writeReferenceSet(root: string, date: string) {
  const written: string[] = [];
  for (const b of BEHAVIOURS) {
    const dir = join(root, b.species, b.behaviour);
    const frames = join(dir, 'reference');
    mkdirSync(frames, { recursive: true });
    const report = scoreAnimation(b.id);
    const meta = {
      species: b.species, behaviour: b.behaviour, animation: b.id, happening: b.happening,
      prompt: generationPrompt(b), tool: 'tools/anim-gate.ts diagramPose', date, frames: FRAME_N,
      accepted: 'diagram', source: b.source, score: Number(report.score.toFixed(6)),
    };
    writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    writeFileSync(join(dir, 'attempts.md'), attemptsMarkdown(b, report.q6, report.score));
    writeFileSync(join(dir, 'see.txt'), seeFrames(b.id) + '\n');
    writeFileSync(join(dir, 'strip.svg'), stripSvg(b.id));
    writeFileSync(join(dir, 'gate.txt'), gateLines(report) + '\n');
    for (let i = 0; i < FRAME_N; i++) {
      const phase = i / FRAME_N;
      writeFileSync(join(frames, `frame-${i}.svg`), frameSvg(diagramPose(b.id, phase), b.bones.bodyLength, `${b.id} reference ${phase.toFixed(3)}`));
    }
    written.push(dir);
  }
  return written;
}
