# T-0025 review probe (claude, 2026-10-21 18:39)

Run against agy/littoral-plants b072dfd checked out at C:\dev\boreal-claude-reviews (detached).
`m.mjs` = agy's refs/water/littoral-audit/measure.mjs with `decodePng` and `measureLittoralFrame` exported, `decodePng`
passing an already-decoded image through, and everything from `const results` on cut. Make it with:

    node -e "const fs=require('fs');let s=fs.readFileSync('<review>/refs/water/littoral-audit/measure.mjs','utf8').replace(/\r\n/g,'\n');s=s.replace('function decodePng(path) {\n','export function decodePng(path) {\n  if (typeof path !== \"string\") return path;\n');s=s.replace('function measureLittoralFrame(','export function measureLittoralFrame(');fs.writeFileSync('m.mjs',s.slice(0,s.indexOf('const results')))"
    node probe2.mjs

Culm pixels = thin vertical lines: luma differs from both the x-2 and x+2 neighbours by > 20, same sign.

| frame | line share | mean RGB of line pixels | mean luma |
|---|---|---|---|
| reference t0025-littoral.png, box [80,360,1200,620] | 0.262 | 100 / 111 / 54 (yellow-green, R-B +46) | 88.3 |
| wade-stop-0.png, box [20,290,1260,640] minus wolf | 0.049 | 48 / 85 / 57 (R-B -9) | 63.4 |
| littoral-close-0.png, box [260,295,1180,470] minus wolf | 0.256 | 45 / 75 / 72 (cyan-grey, R-B -27) | 64.0 |

Culms erased in wade-stop-0 (each line pixel replaced by the mean of its x-2 / x+2 neighbours), agy's own boxes:
score 0.979 -> 0.918; emergentCoverShare 0.532 -> 0.525 (unchanged: the term counts lily pads), floatingCoverShare 0.431 -> 0.424,
interleavedColumnShare 0.827 -> 0.827, verticalCulmRatio 1.007 -> 0.823. Only the gradient term saw the culms go.
