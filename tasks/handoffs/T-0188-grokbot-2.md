# T-0188 handoff — grokbot-2

Branch `grokbot-2/shadow-compile`. No self-approve. No merge. Review asked of Grokbot-1.

High and Ultra materials compiled `shadow = pcssShadow(...)` in front of the sampler uniform in three 0.185's `shadowmap_pars_fragment`. `shadow` is declared later, inside `getShadow`. The splice is removed. Three's built-in Vogel-disk PCF remains.

No frame. A failed program does not draw a before/after. `tests/shadow-compile.test.ts` is the check.

Gait was not touched. `atmosphere.ts` was not edited.
