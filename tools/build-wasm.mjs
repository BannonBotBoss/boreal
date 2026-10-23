// Build rust/boreal-sim to WebAssembly and copy it to public/wasm/boreal_sim.wasm (Vite serves public/ as is, so
// `npx vite` and `vite build` pick it up with no plugin). Works on Windows, macOS and Linux. Needs rustup with the
// wasm32-unknown-unknown target:  rustup target add wasm32-unknown-unknown   (see rust/README.md).
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const crate = join(root, 'rust', 'boreal-sim');
const r = spawnSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown'], { cwd: crate, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) {
  console.error('\ncargo build failed. Install Rust from https://rustup.rs, then run: rustup target add wasm32-unknown-unknown');
  console.error('The game still runs without it: the committed public/wasm/boreal_sim.wasm and the TypeScript fallback are used.');
  process.exit(r.status ?? 1);
}
const out = join(root, 'public', 'wasm');
mkdirSync(out, { recursive: true });
copyFileSync(join(crate, 'target', 'wasm32-unknown-unknown', 'release', 'boreal_sim.wasm'), join(out, 'boreal_sim.wasm'));
console.log(`public/wasm/boreal_sim.wasm  ${statSync(join(out, 'boreal_sim.wasm')).size} bytes`);
