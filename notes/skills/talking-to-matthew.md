# Skill: talking to Matthew

Use before any message, plan, or audit that Matthew will read. The binding text is the section "Talking to Matthew" in `PROJECT-RULES.md`. Do not copy those rules into a second file. If this skill and that section disagree, the section wins. T-0079 added the section.

## Steps
1. Read `PROJECT-RULES.md` "Talking to Matthew" and follow it. Two or three plain sentences about what he will see or experience. Spell abbreviations out. One plain sentence of what you think he wants, before you build. One yes/no question, and only when the decision is his. A plan that needs his approval opens with a "Plain-English summary" of about 12 short lines. Reuse what is already in the repo. He draws: describe the change in visual, in-game terms, show before/after pictures or short clips, and treat a sketch as the spec. One plain question about the picture when it is unclear. Warmth is fine if the message stays short.
2. A direct chat request is recorded under `tasks/RULES.md` rule 16 by a bot in `tools/tasks.ts` `RELAYS_MATTHEW`, in that bot's own name, with `"for": "matthew"`. The event steps and the clock stamp are `notes/skills/grokbot-relay-reviewer.md`. The next id is `notes/skills/next-free-task-id.md`. Do not invent a second event format.
3. Work with nothing on screen uses the rule 12 evidence gate. A change he can see in the game still needs the pictures the section asks for.

## Checks that prove it worked
- The heading "Talking to Matthew" is above the numbered rules in `PROJECT-RULES.md`.
- `tasks/RULES.md` rule 16, the place that says to report what landed, points at that section in one line. `SKELETON-RULES.md` has no reporting section, so it has no pointer.

## Mistakes to avoid
- File paths, function names, or abbreviations in a message to him, unless he asked for them.
- A second copy of the eight rules that can drift away from `PROJECT-RULES.md`.
- More than one question at a time, or a question whose answer is obvious.
- Hand-typing an event time. Stamp `at` from the clock inside the writer (`America/Los_Angeles`). The filename matches that stamp.
