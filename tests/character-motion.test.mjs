import assert from 'node:assert/strict';
import test from 'node:test';

import {
  escortCatchUpMultiplier,
  escortCohesionState,
  escortFormationTarget,
  roleMotionProfile
} from '../modules/character-motion.js';

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

test('同行者との最大距離からグループのまとまりを判定する', () => {
  assert.equal(escortCohesionState([2, 3, 4]).key, 'together');
  assert.equal(escortCohesionState([2, 6, 4]).key, 'warning');
  assert.equal(escortCohesionState([2, 9, 4]).key, 'separated');
  assert.equal(escortCohesionState([2, 9, 4]).nearbyCount, 2);
});

test('離れた同行者は役割別の上限内で追いつく速度を上げる', () => {
  assert.equal(escortCatchUpMultiplier(2, 'resident'), 1);
  assert.ok(escortCatchUpMultiplier(8, 'resident') > 1);
  assert.ok(escortCatchUpMultiplier(20, 'elderly') <= 1.28);
  assert.ok(escortCatchUpMultiplier(20, 'child') > escortCatchUpMultiplier(20, 'elderly'));
});
