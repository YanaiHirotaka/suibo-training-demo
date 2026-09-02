import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CITY_RELIEF_MAX_HEIGHT_BLOCKS,
  cityReliefHeightBlocks
} from '../modules/terrain-elevation.js';

const heightAt = (distanceFromRiverBlocks, overrides = {}) => cityReliefHeightBlocks({
  distanceFromRiverBlocks,
  blockZ: 80,
  mapDepthBlocks: 195,
  ...overrides
});

test('川から離れるほど固定地形が段階的に高くなる', () => {
  assert.equal(heightAt(10), 0);
  assert.equal(heightAt(30), 1);
  assert.equal(heightAt(70), 2);
  assert.equal(heightAt(120), CITY_RELIEF_MAX_HEIGHT_BLOCKS);
});

test('道路は連続した平面を維持する', () => {
  assert.equal(heightAt(120, { isRoad: true }), 0);
});

test('南東側の低地は同距離の北側より1ブロック低い', () => {
  const north = heightAt(70, { blockZ: 80 });
  const south = heightAt(70, { blockZ: 170 });
  assert.equal(south, north - 1);
});
