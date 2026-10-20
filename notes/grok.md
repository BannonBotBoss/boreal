# Grok Bot notes

## 2026-10-18 16:55 PT - Grok Bot (shared perf): the intermittent "2 fps on every tier" headless runs are the GPU vsync thread
- **Symptom:** a headless smoke/bench page loads in 140-190 s (not ~30 s), then draws ~2 fps on every tier, Minimum included. Main thread 98 % idle, GPU 0.2-9 ms/frame (timer query), no shader link churn, VRAM 5 of 8 GB. Same build alternates good/bad; the served tree and worktrees both hit it.
- **Cause:** a 3 s browser trace in the bad mode shows `GpuVSyncThread` busy 2999 of 3000 ms (`WinVSyncProvider`): Edge's GPU process waits on Windows' vblank and frames are paced at ~2 Hz. Display state on omen (two monitors, one reported to the session), not app code.
- **Check:** with `--disable-gpu-vsync --disable-frame-rate-limit`, the same build right after two bad runs loaded in 28 s and rendered every tier (smoke PASS).
- **tools/smoke-tiers.mjs** (branch grok/smoke-vsync) now runs with GPU vsync off by default (`SMOKE_VSYNC=1` keeps it), prints link counts per tier, and on a dead tier a trace summary. Vsync-ON benches on omen can still hit the bad mode: check the load time (>100 s = bad) and rerun.
