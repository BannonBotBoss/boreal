/** Node read of the committed store dump. The page uses `livingPack.ts` instead, so the browser bundle does not import `node:fs`. */
import { readFileSync } from 'node:fs';
import { readStoredPack } from './storedAnimal';

/** The committed fixture, written by `STORE_DUMP=1 cargo test --lib store_fixture_matches`. */
export function readStoredFixture(path = new URL('../../tests/fixtures/stored-wolf-pack.bin', import.meta.url)) {
  return readStoredPack(readFileSync(path));
}
