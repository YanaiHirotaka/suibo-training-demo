import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createShelterArrivalZone,
  isInsideShelterArrivalZone
} from '../modules/shelter-arrival.js';

const collider = { minX: 10, maxX: 20, minZ: 30, maxZ: 40 };

test('到達ポイントは避難所入口より手前に配置する', () => {
  const zone = createShelterArrivalZone(collider);
  assert.equal(zone.x, 15);
  assert.equal(zone.z, 42.6);
  assert.equal(zone.playerRadius, 2.2);
});

test('同行者の到達範囲はプレイヤーより広くする', () => {
  const zone = createShelterArrivalZone(collider);
  assert.ok(zone.escortRadius > zone.playerRadius);
  assert.equal(isInsideShelterArrivalZone({ x: 15, z: 48.5 }, zone), true);
  assert.equal(isInsideShelterArrivalZone({ x: 15, z: 48.5 }, zone, zone.playerRadius), false);
});

test('到達範囲外の同行者は未到着として扱う', () => {
  const zone = createShelterArrivalZone(collider);
  assert.equal(isInsideShelterArrivalZone({ x: 23, z: 42.6 }, zone), false);
});
