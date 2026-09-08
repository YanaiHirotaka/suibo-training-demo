import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVACUATION_SHELTER_CONFIG,
  shelterHighGroundHeightBlocks
} from '../modules/shelter-terrain.js';

const shelter = EVACUATION_SHELTER_CONFIG;
const heightAt = (x, z) => shelterHighGroundHeightBlocks(x, z, shelter);

test('避難所は現在の確定位置にある', () => {
  assert.deepEqual(shelter.centerBlock, { x: 112.5, z: 84.5 });
});

test('避難所高台は最大水位3.2mより高い', () => {
  const heightMeters = shelter.highGround.heightBlocks * 0.3125;
  assert.equal(heightMeters, 4.0625);
  assert.ok(heightMeters > 3.2);
  assert.equal(heightAt(112, 84), 13);
});

test('南側の坂道が横断道路まで連続する', () => {
  const samples = [];
  for (let z = 105; z <= 141; z += 3) samples.push(heightAt(112, z));
  assert.equal(samples[0], 13);
  assert.equal(samples.at(-1), 1);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(Math.abs(samples[index] - samples[index - 1]) <= 1);
  }
  assert.equal(heightAt(112, 143), 0);
  assert.equal(heightAt(118, 120), 0);
});
