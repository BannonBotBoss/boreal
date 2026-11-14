/** The home lake's nearest dry cell is the waterline. The drop and the cold start stand on the bank. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/core/stages/elevation';
import { clearOfWater, surfaceAt } from '../src/core/stages/surfaceAt';
import { LEVEL } from '../src/core/tuning';
import { dropStand } from '../src/world/globe/forestLanding';
import { landSpawn } from '../src/world/globe/handoff';

test('the shore mark is not clear of the lake, and the drop stands on the bank', () => {
  STAGES.on = true;
  const shore = landSpawn({ x: 0, z: 0 }, true);
  assert.equal(clearOfWater(shore.x, shore.z), false, `shore ${shore.x},${shore.z} is still the waterline`);
  const bank = dropStand({ x: 0, z: 0 }, -0.35);
  assert.equal(clearOfWater(bank.x, bank.z), true, `bank ${bank.x},${bank.z}`);
  const feet = surfaceAt(bank.x, bank.z);
  assert.ok(feet.height >= LEVEL.shore, `feet ${feet.height}`);
  assert.ok(Math.hypot(bank.x, bank.z) > 8, 'the bank is not the lake centre');
  assert.ok(Math.hypot(bank.x - shore.x, bank.z - shore.z) > 4, 'the bank is inland of the waterline');
});
