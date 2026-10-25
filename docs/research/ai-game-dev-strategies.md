# Game development strategies with AI

## Recommended strategy for Boreal

> **Use AI where output is checkable: code against tests, assets against a budget, playtests against metrics. Keep a human gate on merges and on anything players hear or see as story.**
>
> My judgement, from the sources below and Boreal's current setup (bots working GitHub issues and the T-series board, coordinated in BannonBotBoss discussions).

1. One issue, one agent, one PR: every task on the T-series board carries acceptance criteria and a test; a second bot reviews, Matt merges.
2. Route by cost: cheap fast models for triage, docs, small fixes and test writing; the strongest model only for architecture, physics and cross-file refactors.
3. Add a headless Playwright playtest bot to CI: load each phase, fly the globe, descend, walk, and fail on frame-time or error regressions using the governor's own numbers.
4. Generate props, not heroes: text- or image-to-3D for rocks, logs and clutter, then retopology, LOD and KTX2 through a fixed pipeline; animals stay authored or rigged by hand.
5. Keep world generation deterministic and seeded; use LLMs offline to write rules, names and lore tables, not at runtime.
6. Disclose AI content if Boreal ships on Steam.

## Tools

| Area | Tools | Strength | Watch out |
| --- | --- | --- | --- |
| Coding agents | GitHub Copilot coding agent, Cursor agents, Claude Code style CLIs | Issue to PR loop with CI and review | METR found experienced devs 19 percent slower on their own repos in early 2025 |
| Text/image to 3D | Meshy, Tripo, TRELLIS, Hunyuan3D 2 | Fast prop drafts with PBR textures | Messy topology, licence terms differ, needs cleanup |
| Textures | Diffusion models, Meshy/Tripo texturing | Tileable materials quickly | Seams, inconsistent style |
| Audio | ElevenLabs sound effects, Stable Audio Open | Ambience and foley drafts | Rights and voice consent |
| Animation | Cascadeur AI-assisted posing, video-to-motion tools | Speeds keyframing | Quadrupeds are still weak |
| NPCs and dialogue | Inworld, Ubisoft NEO NPC prototype, generative agents | Reactive characters | Runtime cost, latency, off-script output |
| Playtesting | Playwright, RL agents (EA SEED) | Repeatable regression and coverage runs | Agents find bugs, not fun |

## What worked and what went wrong

- Worked: AI for boilerplate, tests and tooling; RL agents covering maps faster than scripted tests (EA SEED).
- Worked: generative agents produced believable daily routines and social behaviour in a sandbox (Park et al. 2023), at high token cost.
- Went wrong: AI-written code merged without tests creates churn; agents slowed experienced devs in the METR trial.
- Went wrong: player backlash to visible AI art and voices; GDC 2025 survey shows growing developer concern about AI.
- Policy: Steam requires disclosure of pre-generated and live AI content since January 2024.

## Gaps

- No first-hand cost numbers for Boreal's bots; token spend per issue not measured.
- Indie case studies are mostly anecdotal; I did not verify specific named indie postmortems this round.
- Text-to-3D licences and pricing change often; check each before use.

## Sources: AI

- [About Copilot coding agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent) — GitHub Docs
- [Measuring the impact of early-2025 AI on experienced developers](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) — METR
- [GDC 2025 State of the Game Industry](https://gdconf.com/news/gdc-2025-state-game-industry-devs-weigh-layoffs-ai-and-more) — GDC
- [Meshy](https://www.meshy.ai) — meshy.ai
- [Tripo](https://www.tripo3d.ai) — tripo3d.ai
- [TRELLIS](https://github.com/microsoft/TRELLIS) — GitHub, Microsoft
- [Hunyuan3D 2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) — GitHub, Tencent
- [Sound effects](https://elevenlabs.io/sound-effects) — ElevenLabs
- [Stable Audio Open 1.0](https://huggingface.co/stabilityai/stable-audio-open-1.0) — Hugging Face
- [Cascadeur](https://cascadeur.com) — cascadeur.com
- [Generative Agents](https://arxiv.org/abs/2304.03442) — arXiv, Park et al.
- [Inworld AI](https://inworld.ai) — inworld.ai
- [Augmenting automated game testing with deep RL](https://arxiv.org/abs/2103.15819) — arXiv, EA SEED
- [Playwright](https://playwright.dev) — playwright.dev
- [AI content on Steam](https://store.steampowered.com/news/group/4145017/view/3862463747997849618) — Steam

---

*Research compiled 2026-10-24 by Grok Bot (read-only review of the repo; recommendations are judgement unless sourced). Full reading list: [sources.md](sources.md). Index: [README.md](README.md).*
