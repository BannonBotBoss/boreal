# Grok Bot notes

## 2026-10-18 16:55 PT - Grok Bot (shared perf): the intermittent "2 fps on every tier" headless runs are the GPU vsync thread
- **Symptom:** a headless smoke/bench page loads in 140-190 s (not ~30 s), then draws ~2 fps on every tier, Minimum included. Main thread 98 % idle, GPU 0.2-9 ms/frame (timer query), no shader link churn, VRAM 5 of 8 GB. Same build alternates good/bad; the served tree and worktrees both hit it.
- **Cause:** a 3 s browser trace in the bad mode shows `GpuVSyncThread` busy 2999 of 3000 ms (`WinVSyncProvider`): Edge's GPU process waits on Windows' vblank and frames are paced at ~2 Hz. Display state on omen (two monitors, one reported to the session), not app code.
- **Check:** with `--disable-gpu-vsync --disable-frame-rate-limit`, the same build right after two bad runs loaded in 28 s and rendered every tier (smoke PASS).
- **tools/smoke-tiers.mjs** (branch grok/smoke-vsync) now runs with GPU vsync off by default (`SMOKE_VSYNC=1` keeps it), prints link counts per tier, and on a dead tier a trace summary. Vsync-ON benches on omen can still hit the bad mode: check the load time (>100 s = bad) and rerun.

## perf6 after-run (omen, 2026-10-18/19, Grok Bot)
Build: grok/medium-ladder 2b82415 (on perf6/near-shadows 4c8d933), served from a worktree on 5184. Scripts: tools/perf6/ (they take the bench lock and track their Edge processes).
Uncapped (vsync off), all tiers: frame ms / GPU ms / draws, settled
- Ultra 7.14 / 3.21 / 222; High 6.99 / 3.11 / 217; Medium 7.64 / 3.31 / 259; Low 6.73 / 2.05 / 222; Very low 5.92 / 1.30 / 218; Minimum 3.34 / 0.25 / 90
- Medium is still not between High and Low: frames are CPU/draw-bound (~7 ms), and Medium draws more than High.
With vsync on, all tiers ran at 850-930 ms per frame (~1 fps; load took 142 s). This is the Edge GPU vsync stall (see above), not the app. Draws 231-254, GPU 1-6 ms.
Not finished: the governor 150 s run, the base (ba5677d) tier tables, and the after Ultra/Medium captures. They were stopped at wrap-up.
AO A/B (Ultra, ba5677d): new 145 fps / 242 draws / 2.0 ms GPU; old 102 / 435 / 3.3; off 141 / 250 / 2.2.
