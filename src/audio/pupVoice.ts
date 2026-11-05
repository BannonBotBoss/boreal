/**
 * Which recorded clip a pup plays. The files are mono ogg in public/sounds/pups.
 * The behaviour (yip, whimper, huff, call) is decided in core/litter.ts.
 */
import type { PupCall } from '../core/litter';

export const PUP_CLIPS: Record<PupCall, readonly string[]> = {
  yip: ['yip_01', 'yip_02', 'yip_03', 'yip_04'],
  whimper: ['whimper_01', 'whimper_02', 'whimper_03'],
  huff: ['huff_01', 'huff_02', 'huff_03'],
  call: ['call_01', 'call_02'],
};

/** A different file from `last` when the bank has more than one. */
export function pickPupClip(kind: PupCall, rng: () => number, last?: string) {
  const bank = PUP_CLIPS[kind];
  let i = Math.floor(rng() * bank.length) % bank.length;
  if (bank.length > 1 && bank[i] === last) i = (i + 1) % bank.length;
  return bank[i];
}
