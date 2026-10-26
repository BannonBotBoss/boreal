# Skill: audit drawing paths and plan one picture

Use when asked why a game's drawing paths are separate, and to plan one picture whose detail follows distance. The deliverable is an audit and a plan. Do not rewrite the picture in the same change.

## Steps

1. Pin a commit (`git rev-parse HEAD`) and cite every line against it. Say which files another agent is editing so those lines can move.
2. Find every drawing surface, picture, viewpoint, and loop. Search for `new WebGLRenderer`, `new Scene`, `PerspectiveCamera`, `EffectComposer`, `requestAnimationFrame`, and `renderer.render`. Include dev pages, not only the flight the player sees.
3. For each path record: renderer, scene, camera, who calls the draw, how detail falls off with distance, which shaders, and which data it reads. Cite file:line.
4. Read the history (`git log --follow --diff-filter=A`) and the tasks or pull requests that added each path. The split is usually "this page came first, the other page was added beside it."
5. List the costs with the comments already in the code (a second full-screen draw, a colour fixup, two skies, two depths).
6. Reuse what already serves one picture: one quality ladder for cost, one interest budget, an existing distance tree, an existing feature-size gate as the spatial score. Map every path to keep, merge, leave, or replace. Matthew, 2026-10-25 7:15 PM PT, allows a replacement when keeping a path would compromise the single space-and-time observation pipeline (issues #100–#109, especially #107). Do not add a second drawing technology.
7. Phases are small. Each names a test, the existing frame-time budget, and a frame gate when the picture changes. The first phase writes the observation table (height stations from #107, time levels and the hysteresis pair from #109) and does not let the draw read it. List it. Do not implement it in the audit change.
8. Open the plan and the pull-request description with a plain summary of at most about 12 short lines: what the player will see, what goes away, what stays. No file paths and no acronyms in that summary. Matthew answered the three questions in #107–#109; the summary states those answers and does not ask them again. Put the evidence under it. Newest issue wins where #107–#109 disagree with the plan or with each other.
9. Take the next free task id (skill `next-free-task-id`). Propose. Do not approve your own plan. Handoff uses the evidence gate: finding, file:line, what it became.

## Checks that prove it worked

- A reviewer can open three inventory rows at the pinned commit and see the described draw.
- Every path is keep, merge, leave, or replace, or the plan says why it is out of scope.
- No game drawing code changed in the audit commit.
- The plain summary is the first section of the plan and of the pull request.

## Mistakes to avoid

- Inventing a second distance system when the quadtree and the feature-size gate already measure space. The time dial is the other half of the decision (#107, #109), not a new metre table.
- Keeping a fade, a distance-only cutoff, or a slow-motion multiplier as the layer decision after #107–#109. Replace that path.
- Inventing a rate #109 left blank (stiffness, damping, geological enter, biome enter).
- Editing files another agent has open (here: the in-page flight and the single clock).
- Putting file paths or acronyms in the opening summary. Matthew approves plans he cannot read when the summary is technical.
- Marking the audit complete without the handoff, or approving your own plan.
- Quoting a new distance as if the code already used it. Copy existing constants, or cite a source.
