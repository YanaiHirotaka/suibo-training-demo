import assert from 'node:assert/strict';
import test from 'node:test';

import { escortFormationTarget, roleMotionProfile } from '../modules/character-motion.js';

test('同行者は進行方向に対して左右交互に並ぶ', () => {
  const first = escortFormationTarget({ x: 10, z: 20, rotation: 0 }, 0);
  const second = escortFormationTarget({ x: 10, z: 20, rotation: 0 }, 1);

  assert.ok(first.x < 10);
  assert.ok(second.x > 10);
  assert.equal(first.z, 20);
  assert.equal(second.z, 20);
});

test('後ろの同行者ほど追従間隔を広くする', () => {
  const first = escortFormationTarget({ x: 0, z: 0, rotation: 0 }, 0);
  const third = escortFormationTarget({ x: 0, z: 0, rotation: 0 }, 2);

  assert.ok(third.followDistance > first.followDistance);
});

test('子どもは大きく、高齢者は控えめな歩行動作になる', () => {
  const child = roleMotionProfile('child');
  const elderly = roleMotionProfile('elderly');

  assert.ok(child.gaitScale > elderly.gaitScale);
  assert.ok(child.bobScale > elderly.bobScale);
});
