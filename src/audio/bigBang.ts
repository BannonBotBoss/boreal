/**
 * Big Bang beds and voice. HTMLAudio, the same element playback music.ts uses.
 * B0–B3 plays narration + bed, and bang-impact at the B3 hit.
 * Cue 2 and the later voice lines are wired and stay silent until the clock
 * reaches them (this slice never does). There is no 20–45 s bed loop.
 */
import { CINE, LATER_AUDIO, NARRATION, bangAt, bedDb, cue2Db, dbToGain, voDuckDb } from '../world/cosmos/cineBeats';

export interface BigBangAudio {
  begin(): void;
  bang(): void;
  /** Wall seconds and the narration `ended` time, once it has fired. */
  sync(t: number, narrationEndedAt: number | null): void;
  stop(): void;
}

export function createBigBangAudio(): BigBangAudio {
  const narration = track(NARRATION.file);
  const bed = track(LATER_AUDIO.bed);
  const bang = track(LATER_AUDIO.bang);
  const cue2 = track(LATER_AUDIO.cue2);
  const vo7 = track(LATER_AUDIO.voB7);
  const vo9 = track(LATER_AUDIO.voB9);
  const vo14 = track(LATER_AUDIO.voB14);
  let started = false, hit = false, cueOn = false;
  const voPlayed = { b7: false, b9: false, b14: false };
  return {
    begin() {
      if (started) return;
      started = true;
      bed.volume = dbToGain(CINE.bedB1);
      void bed.play().catch(() => {});
      void narration.play().catch(() => {});
    },
    bang() {
      if (hit) return;
      hit = true;
      bang.currentTime = 0;
      void bang.play().catch(() => {});
    },
    sync(t: number, narrationEndedAt: number | null) {
      const end = narrationEndedAt ?? CINE.b1 + NARRATION.seconds;
      const duck = voDuckDb(t);
      bed.volume = dbToGain(bedDb(t, narrationEndedAt) + duck);
      if (t >= LATER_AUDIO.cue2At && !cueOn) {
        cueOn = true;
        void cue2.play().catch(() => {});
      }
      cue2.volume = dbToGain(cue2Db(t) + duck);
      const fire = (flag: keyof typeof voPlayed, at: number, el: HTMLAudioElement) => {
        if (voPlayed[flag] || t < at) return;
        voPlayed[flag] = true;
        void el.play().catch(() => {});
      };
      fire('b7', LATER_AUDIO.voB7At, vo7);
      fire('b9', LATER_AUDIO.voB9At, vo9);
      fire('b14', LATER_AUDIO.voB14At, vo14);
      if (narrationEndedAt != null && t >= bangAt(narrationEndedAt)) this.bang();
    },
    stop() { for (const el of [narration, bed, bang, cue2, vo7, vo9, vo14]) el.pause(); },
  };
}

function track(src: string): HTMLAudioElement {
  const el = new Audio(src);
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  return el;
}
