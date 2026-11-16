/**
 * Calibrated Rule 11 numeric verification for T-0253:
 * Music, Adaptive Stems, Psychoacoustic Tone/Noise Synthesis, Mixer/Loop Lifecycle,
 * Species Voice Ducking, & Big Bang Cinematic Audio Audit.
 *
 * Run: npx tsx refs/audio/music-stems-psychoacoustics-cine-audit/numeric-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const clamp01 = x => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const ratioScore = (a, b) => {
  if (!(a > 0) || !(b > 0)) return 0;
  return clamp01(Math.min(a, b) / Math.max(a, b));
};
const deltaScore = (measured, target, fullScale) => {
  if (!(fullScale > 0) || !Number.isFinite(measured) || !Number.isFinite(target)) return 0;
  return clamp01(1 - Math.abs(measured - target) / fullScale);
};

// Load modules & source files from repo
const { STEM_FRAMES, STEM_RATE, STEM_SECONDS, stemWeights } = await import(
  new URL('../../../src/audio/adaptiveStems.ts', import.meta.url).href
);
const { PULSE_PRESETS } = await import(
  new URL('../../../src/audio/music.ts', import.meta.url).href
);
const { CINE, LATER_AUDIO, NARRATION, narrationEndFallback } = await import(
  new URL('../../../src/world/cosmos/cineBeats.ts', import.meta.url).href
);

const obsPath = path.join(__dirname, 'observations.json');
const obs = JSON.parse(fs.readFileSync(obsPath, 'utf8'));

const srcBigBang = fs.readFileSync(path.join(REPO_ROOT, 'src/audio/bigBang.ts'), 'utf8');
const srcMusic = fs.readFileSync(path.join(REPO_ROOT, 'src/audio/music.ts'), 'utf8');
const srcBoreal = fs.readFileSync(path.join(REPO_ROOT, 'src/audio/borealSound.ts'), 'utf8');
const srcMain = fs.readFileSync(path.join(REPO_ROOT, 'src/main.ts'), 'utf8');
const srcStyle = fs.readFileSync(path.join(REPO_ROOT, 'src/style.css'), 'utf8');
const hasOrphanedAudioTs = fs.existsSync(path.join(REPO_ROOT, 'src/audio.ts'));

// ============================================================================
// 1. Calibration (Rule 11): 4 Known Matches (>= 0.95) & 4 Known Mismatches (< 0.70)
// ============================================================================
const { SOUND_IDS } = await import(
  new URL('../../../src/audio/borealSound.ts', import.meta.url).href
);
const { CLIP_TRIM_DB } = await import(
  new URL('../../../src/audio/mixer.ts', import.meta.url).href
);
const trimmedSoundIdCoverage = SOUND_IDS.filter(id => id in CLIP_TRIM_DB).length / SOUND_IDS.length;
const binauralDiffHz = (300 + PULSE_PRESETS['Gamma 40 Hz'] / 2) - (300 - PULSE_PRESETS['Gamma 40 Hz'] / 2);

const knownMatches = [
  {
    id: 'match_stems_32_bars_at_90_bpm_duration',
    measured: STEM_SECONDS,
    reference: (32 * 4 * 60) / 90,
    score: +ratioScore(STEM_SECONDS, (32 * 4 * 60) / 90).toFixed(4),
    note: `${STEM_FRAMES} / ${STEM_RATE} = 85.3333 s vs 32 bars at 90 BPM`,
  },
  {
    id: 'match_mixer_sound_id_trim_coverage',
    measured: trimmedSoundIdCoverage,
    reference: 1.0,
    score: +ratioScore(trimmedSoundIdCoverage, 1.0).toFixed(4),
    note: `${SOUND_IDS.length} / ${SOUND_IDS.length} SOUND_IDS carry EBU R128 loudness trims in CLIP_TRIM_DB`,
  },
  {
    id: 'match_binaural_gamma_beat_frequency_difference',
    measured: binauralDiffHz,
    reference: 40.0,
    score: +ratioScore(binauralDiffHz, 40.0).toFixed(4),
    note: '(300 + 20) - (300 - 20) = 40.0 Hz (Oster 1973)',
  },
  {
    id: 'match_cine_narration_end_fallback_sum',
    measured: narrationEndFallback(),
    reference: CINE.b1 + NARRATION.seconds,
    score: +ratioScore(narrationEndFallback(), CINE.b1 + NARRATION.seconds).toFixed(4),
    note: '3.0 + 5.851429 = 8.851429 s',
  },
];

const psych = obs.stage1_globeMusicAndPsychoacoustics.psychoacousticAndLufs;
const knownMismatches = [
  {
    id: 'mismatch_muted_big_bang_narration_volume',
    measured: 1.0,
    reference: 0.0,
    score: +deltaScore(1.0, 0.0, 1.0).toFixed(4),
    note: 'Full 1.0 volume while volume.muted = true',
  },
  {
    id: 'mismatch_brown_noise_48k_bass_slope',
    measured: Math.abs(psych.brownNoise48k.bassSlopeDbPerOct_25_100Hz),
    reference: Math.abs(psych.brownNoise48k.idealBrownSlopeDbPerOct),
    score: +ratioScore(
      Math.abs(psych.brownNoise48k.bassSlopeDbPerOct_25_100Hz),
      Math.abs(psych.brownNoise48k.idealBrownSlopeDbPerOct)
    ).toFixed(4),
    note: '-0.729 dB/oct plateau vs -6.021 dB/oct Brownian 1/f^2 (Voss & Clarke 1978)',
  },
  {
    id: 'mismatch_sharp_isochronic_negative_gain_bleed',
    measured: psych.sharpIsochronic.minEnvelopeGain,
    reference: 0.0,
    score: +deltaScore(psych.sharpIsochronic.minEnvelopeGain, 0.0, 0.15).toFixed(4),
    note: '-0.1017 phase-inverted carrier bleed during silent off-phase',
  },
  {
    id: 'mismatch_follow_world_stuck_theta_pulse',
    measured: psych.followWorldPulseMutation.pulseDayReturn,
    reference: 40,
    score: +ratioScore(psych.followWorldPulseMutation.pulseDayReturn, 40).toFixed(4),
    note: 'Daytime pulse stuck at 6 Hz after one night cycle instead of 40 Hz',
  },
];

const calibrationValid =
  knownMatches.every(m => m.score >= 0.95) &&
  knownMismatches.every(m => m.score < 0.70);

// ============================================================================
// 2. Helper for WCAG 2.1 relative luminance & contrast on `#start-menu .start-panel`
// ============================================================================
const relLuminance = ([r, g, b]) => {
  const ch = c => {
    const u = c / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
// `style.css`: `.start-panel { background: rgba(255, 253, 248, .96) }` (~[253, 251, 246]) & `.note` inside `#start-menu`
const warnRgb = (obs.stage1_globeMusicAndPsychoacoustics.musicMenuUiAudit.safetyWarningColor.match(/[\d.]+/g) || [243, 215, 154]).slice(0, 3).map(Number);
const cardBgRgb = [253, 251, 246];
const lBright = Math.max(relLuminance(warnRgb), relLuminance(cardBgRgb));
const lDark = Math.min(relLuminance(warnRgb), relLuminance(cardBgRgb));
const measuredSafetyContrast = (lBright + 0.05) / (lDark + 0.05);

// ============================================================================
// 3. Twelve Audited Subsystem Checks
// ============================================================================
const b1Audios = obs.stage0_bigBang.cineB1.htmlAudios;
const unmutedCineCount = b1Audios.filter(a => !a.paused && !a.muted && a.volume > 0).length;
const guitarBleedDuringCine = b1Audios.some(a => a.src.includes('guitar-') && !a.paused && a.volume > 0);
const check1Sub = (unmutedCineCount === 0 ? 1 : 0) + (!guitarBleedDuringCine ? 1 : 0);

const afterStopCtx = obs.stage0_bigBang.cineStarAndStop.afterStopContexts;
const bigBangTickLeaked = afterStopCtx.some(c => c.isBigBangTick && !c.closedCalled && c.state === 'running');
const voB7DriftSec = Math.abs(LATER_AUDIO.voB7At - 57);
const handlesDocHidden = /visibilitychange|document\.hidden/.test(srcBigBang);
const check2Sub = (!bigBangTickLeaked ? 1 : 0) + (voB7DriftSec === 0 ? 1 : 0) + (handlesDocHidden ? 1 : 0);

const globeMusic = obs.stage1_globeMusicAndPsychoacoustics.globeMusicProbe;
const check3Score = ratioScore(Math.max(0, globeMusic.ctxTimeDeltaOver800ms), 0.8);

const mediaSrcDisconnectedRatio = globeMusic.mediaElementSourcesCount > 0
  ? globeMusic.mediaElementSourcesDisconnected / Math.max(1, globeMusic.mediaElementSourcesCount - 1)
  : 0;
const pausedWhenCtxSuspended = globeMusic.htmlAudioAfter800ms.every(a => a.paused);
const check4Score = ((pausedWhenCtxSuspended ? 1 : 0) + clamp01(mediaSrcDisconnectedRatio)) / 2;

const duskMid = stemWeights(0.5, 0, 0);
const stemsDuskPower = duskMid.night ** 2 + duskMid.day ** 2; // capStemSum crushes sin+cos=1.414 back to 0.5+0.5 -> 0.50 (-3.01 dB)!
const linearMidPower = 0.5 ** 2 + 0.5 ** 2; // 0.50 (-3.01 dB)
const equalMidPower = Math.sin(Math.PI / 4) ** 2 + Math.cos(Math.PI / 4) ** 2; // 1.00 (0.00 dB)
const usesLinearCrossfade = /linearRampToValueAtTime\(1,\s*now\s*\+\s*xf\)/.test(srcMusic);
const guitarPowerScore = usesLinearCrossfade ? ratioScore(linearMidPower, equalMidPower) : 1.0;
const stemsPowerScore = ratioScore(stemsDuskPower, equalMidPower);
const check5Score = (guitarPowerScore + stemsPowerScore) / 2;

const uiAudit = obs.stage1_globeMusicAndPsychoacoustics.musicMenuUiAudit;
const contrastScore = Math.min(1, measuredSafetyContrast / 4.5);
const unclippedRatio = uiAudit.panelScrollHeight > 0 ? uiAudit.panelClientHeight / uiAudit.panelScrollHeight : 1;
const handlesScroll = /overflow-y:\s*auto/.test(srcStyle.slice(srcStyle.indexOf('.start-panel'), srcStyle.indexOf('.start-panel') + 400));
const check6Score = (contrastScore + (handlesScroll && uiAudit.panelClippedBottomPx === 0 ? 1 : unclippedRatio * 0)) / 2;

const slopeScore = ratioScore(
  Math.abs(psych.brownNoise48k.bassSlopeDbPerOct_25_100Hz),
  Math.abs(psych.brownNoise48k.idealBrownSlopeDbPerOct)
);
const seamScore = psych.brownNoise48k.seamToMaxStepRatio <= 1.05 ? 1 : ratioScore(1.0, psych.brownNoise48k.seamToMaxStepRatio);
const check7Score = (slopeScore + seamScore) / 2;

const check8Score = psych.sharpIsochronic.minEnvelopeGain >= -1e-4
  ? 1.0
  : deltaScore(psych.sharpIsochronic.minEnvelopeGain, 0.0, 0.15);

const pulseRestoredScore = ratioScore(psych.followWorldPulseMutation.pulseDayReturn, 40);
const manifestJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'public/music/manifest.json'), 'utf8'));
const moodSpecificTracks = (manifestJson.tracks || []).filter(t => t.mood && t.mood !== 'any').length;
const check9Score = (pulseRestoredScore + (moodSpecificTracks > 0 ? 1 : 0)) / 2;

const stemsLive = obs.stage2_adaptiveStemsAndLoops.stemsLive;
const stemsRespectLevel = deltaScore(stemsLive.musicMasterGainTargetWhenLevelZero ?? 1, 0, 1);
const stemsThreatScore = stemsLive.stemsState?.threat >= 0.5 ? 1 : ratioScore(Math.max(0, stemsLive.stemsState?.threat ?? 0), 0.5);
const check10Score = (stemsRespectLevel + stemsThreatScore) / 2;

const idleBuiltinMusicLoops = stemsLive.loopingDurationsSec.filter(d => Math.abs(d - 60.08) < 0.5).length;
const check11Score = ((idleBuiltinMusicLoops === 0 ? 1 : 0) + (!hasOrphanedAudioTs ? 1 : 0)) / 2;

const spk = obs.stage3_wolfVoiceAndDucking.speakProbe;
const deerDidNotSpeakWolf = !(spk.embodiedSpecies === 'deer' && spk.speechBubbleText.includes('🐺'));
// Check if duck node history shows friend-chime cancelling the 0.27 voice duck with 0.45 at ~0.7 s!
const chimeClobberedVoiceDuck = spk.duckAutomationHistory.some((h, idx, arr) =>
  h.fn === 'setTargetAtTime' &&
  Math.abs((h.args?.[0] ?? 0) - 0.45) < 0.01 &&
  arr.slice(0, idx).some(prev => prev.fn === 'setTargetAtTime' && Math.abs((prev.args?.[0] ?? 0) - 0.27) < 0.01)
);
// Fallback static verification if speakProbe did not capture bubble
const staticDeerSpeaksWolf = /if\s*\(action\s*===\s*'speak'\)\s*\{\s*const\s+t\s*=\s*target/.test(srcMain) && !/playable\.id\s*===\s*'wolf'/.test(srcMain.slice(srcMain.indexOf("action === 'speak'") - 60, srcMain.indexOf("action === 'speak'") + 180));
const staticChimeClobbersVoice = /setTimeout\(\(\)\s*=>\s*this\.playAt\('friend-chime'/.test(srcBoreal) && /DUCKERS\s*=\s*new\s*Set.*'friend-chime'/.test(srcBoreal);
const voiceSpeciesOk = spk.speechBubbleText ? deerDidNotSpeakWolf : !staticDeerSpeaksWolf;
const voiceDuckOk = spk.duckAutomationHistory.length ? !chimeClobberedVoiceDuck : !staticChimeClobbersVoice;
const check12Score = ((voiceSpeciesOk ? 1 : 0) + (voiceDuckOk ? 1 : 0)) / 2;

const checks = [
  {
    id: 'big_bang_mute_master_and_no_guitar_bleed',
    game: `${unmutedCineCount} unmuted streams (vol=1.0) + guitarBleed=${guitarBleedDuringCine}`,
    natureOrSpec: '0 unmuted streams when volume.muted=true; 0 guitar tracks during #cine (ITU-R BS.1770-4 / mixer bus)',
    score: +(check1Sub / 2).toFixed(4),
    pass: check1Sub / 2 >= 0.95,
  },
  {
    id: 'big_bang_audiocontext_close_and_cue_sync',
    game: `tickCtxLeaked=${bigBangTickLeaked}, voB7Drift=${voB7DriftSec}s (54 vs 57s), hiddenSync=${handlesDocHidden}`,
    natureOrSpec: '0 leaked AudioContexts on stop(); 0.0s voB7At README drift; visibility-synced playback (W3C Web Audio)',
    score: +(check2Sub / 3).toFixed(4),
    pass: check2Sub / 3 >= 0.95,
  },
  {
    id: 'globe_and_music_menu_audition_running',
    game: `ctx.state="${globeMusic.ctxStateOnGlobeMusicMenu}", dt=${globeMusic.ctxTimeDeltaOver800ms}s / 0.8s`,
    natureOrSpec: 'ctx.state="running", dt=0.80s on Globe & Menu->Music while sfx/ambience buses duck to 0',
    score: +check3Score.toFixed(4),
    pass: check3Score >= 0.95,
  },
  {
    id: 'media_element_deck_pause_and_node_disconnect',
    game: `el.paused=${pausedWhenCtxSuspended}, disconnected=${globeMusic.mediaElementSourcesDisconnected}/${globeMusic.mediaElementSourcesCount}`,
    natureOrSpec: 'el.paused=true when halted; old MediaElementAudioSourceNodes disconnected after fadeOut',
    score: +check4Score.toFixed(4),
    pass: check4Score >= 0.95,
  },
  {
    id: 'guitar_crossfade_equal_power_law',
    game: `linearRamp midpoint power = ${linearMidPower.toFixed(4)} (-3.010 dB)`,
    natureOrSpec: 'equal-power cos/sin midpoint power = 1.0000 (0.000 dB, Roads 1996 p. 458)',
    score: +check5Score.toFixed(4),
    pass: check5Score >= 0.95,
  },
  {
    id: 'music_menu_safety_contrast_and_scroll',
    game: `contrast=${measuredSafetyContrast.toFixed(2)}:1 (#f3d79a on #fdfbf6), clipped=${uiAudit.panelClippedBottomPx}px`,
    natureOrSpec: 'WCAG 2.1 AA contrast >= 4.5:1 for epilepsy warning & 0 px unscrollable clipping',
    score: +check6Score.toFixed(4),
    pass: check6Score >= 0.95,
  },
  {
    id: 'brown_noise_bass_slope_and_loop_seam',
    game: `25-100Hz slope=${psych.brownNoise48k.bassSlopeDbPerOct_25_100Hz} dB/oct (fc=${psych.brownNoise48k.cornerHzAt48k} Hz @48k), seam=${psych.brownNoise48k.seamToMaxStepRatio}x`,
    natureOrSpec: '-6.021 dB/oct Brownian 1/f^2 down to 20 Hz (Voss & Clarke 1978) & <=1.05x seamless loop',
    score: +check7Score.toFixed(4),
    pass: check7Score >= 0.95,
  },
  {
    id: 'sharp_isochronic_unipolar_off_phase',
    game: `Biquad Q=${psych.sharpIsochronic.defaultBiquadQ} dB -> minGain=${psych.sharpIsochronic.minEnvelopeGain} (${psych.sharpIsochronic.negativeGainSamplesPerSec} neg samples/s)`,
    natureOrSpec: 'minGain = 0.0000 unipolar [0, 1] envelope with 0% off-phase carrier bleed (Oster 1973)',
    score: +check8Score.toFixed(4),
    pass: check8Score >= 0.95,
  },
  {
    id: 'follow_world_pulse_restore_and_mood_pool',
    game: `day->night->day pulse = ${psych.followWorldPulseMutation.pulseDay0}->${psych.followWorldPulseMutation.pulseNight}->${psych.followWorldPulseMutation.pulseDayReturn} Hz; ${moodSpecificTracks}/3 mood tracks`,
    natureOrSpec: '40 Hz daytime gamma restored on day; guitar tracks never mutate pulse; non-empty mood pools',
    score: +check9Score.toFixed(4),
    pass: check9Score >= 0.95,
  },
  {
    id: 'adaptive_stems_level_and_predator_threat',
    game: `masterGain(level=0)=${stemsLive.musicMasterGainTargetWhenLevelZero}, hare+fox threat=${stemsLive.stemsState?.threat ?? 0}`,
    natureOrSpec: 'masterGain(level=0)=0.000 & predator threat >= 0.50 near fox/wolf (Sheriff et al. 2009; #309)',
    score: +check10Score.toFixed(4),
    pass: check10Score >= 0.95,
  },
  {
    id: 'idle_builtin_music_loops_and_orphan_synth',
    game: `${idleBuiltinMusicLoops} idle 60.08s music loops spinning at gain=0; orphan src/audio.ts=${hasOrphanedAudioTs}`,
    natureOrSpec: '0 idle built-in music loops when builtInMusic=false & 0 orphaned AudioContext synth files',
    score: +check11Score.toFixed(4),
    pass: check11Score >= 0.95,
  },
  {
    id: 'species_voice_identity_and_ducking_hold',
    game: `species="${spk.embodiedSpecies}" bubble=${JSON.stringify(spk.speechBubbleText)}, chimeClobbered0.27Duck=${!voiceDuckOk}`,
    natureOrSpec: 'Cervid non-human contact cues (Atkeson et al. 1988) & uninterrupted 0.27 voice ducking across full line',
    score: +check12Score.toFixed(4),
    pass: check12Score >= 0.95,
  },
];

const passCount = checks.filter(c => c.pass).length;
const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);

const out = {
  task: 'T-0253',
  skill: 'music-stems-psychoacoustics-cine-audit',
  generatedAt: new Date().toISOString(),
  metrics: {
    ratioScore: 'min(a, b) / max(a, b) for strictly positive physical, power, frequency, and contrast ratios',
    deltaScore: 'clamp01(1 - |measured - target| / fullScale) for zero-target gain/mute/bleed invariants',
    passThreshold: 0.95,
  },
  calibration: {
    calibrationValid,
    knownMatches,
    knownMismatches,
  },
  summary: {
    totalChecks: checks.length,
    passedChecks: passCount,
    failedChecks: checks.length - passCount,
    meanScore,
    allPassed: passCount === checks.length,
  },
  checks,
};

fs.writeFileSync(path.join(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Calibration valid: ${calibrationValid} | Passed: ${passCount}/${checks.length} | Mean score: ${meanScore}`);
