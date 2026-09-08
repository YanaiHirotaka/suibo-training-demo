import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveThirdPersonCamera, yawTowardPoint } from '../modules/camera-geometry.js';

test('目的地点へ向くヨー角を計算する', () => {
  assert.ok(Math.abs(yawTowardPoint({ x: 0, z: 0 }, { x: 0, z: -5 })) < 1e-8);
  assert.ok(yawTowardPoint({ x: 0, z: 0 }, { x: -1, z: -5 }) > 0);
});

test('建物がプレイヤーとカメラの間にある場合は壁の手前へ寄せる', () => {
  const resolved = resolveThirdPersonCamera({
    target: { x: 0, y: 1, z: 0 },
    desired: { x: 0, y: 2, z: 5 },
    colliders: [{ minX: -1, maxX: 1, minZ: 2, maxZ: 3 }],
    collisionRadius: 0.2,
    clearance: 0.1
  });

  assert.equal(resolved.occluded, true);
  assert.ok(resolved.z < 1.8);
  assert.ok(resolved.z > 1.5);
});

test('障害物が横にある場合は希望位置を維持する', () => {
  const resolved = resolveThirdPersonCamera({
    target: { x: 0, y: 1, z: 0 },
    desired: { x: 0, y: 2, z: 5 },
    colliders: [{ minX: 2, maxX: 3, minZ: 2, maxZ: 3 }]
  });

  assert.equal(resolved.occluded, false);
  assert.equal(resolved.ratio, 1);
  assert.equal(resolved.z, 5);
});

test('マップ外へ出るカメラは境界内に収める', () => {
  const resolved = resolveThirdPersonCamera({
    target: { x: 0, y: 1, z: 4 },
    desired: { x: 0, y: 2, z: 8 },
    bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }
  });

  assert.equal(resolved.occluded, true);
  assert.equal(resolved.z, 5);
  assert.equal(resolved.ratio, 0.25);
});
