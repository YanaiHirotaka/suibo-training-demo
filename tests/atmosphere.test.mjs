import assert from 'node:assert/strict';
import test from 'node:test';

import { weatherVisualState } from '../modules/atmosphere.js';

test('雨が強くなるほど路面の粗さが下がり反射が強くなる', () => {
  const dry = weatherVisualState(0, 0);
  const wet = weatherVisualState(1, 0);

  assert.ok(wet.roadRoughness < dry.roadRoughness);
  assert.ok(wet.pavingRoughness < dry.pavingRoughness);
  assert.ok(wet.roadMetalness > dry.roadMetalness);
  assert.ok(wet.puddleOpacity > dry.puddleOpacity);
});

test('水位上昇に合わせて浸水面の不透明度が上がる', () => {
  const early = weatherVisualState(0.5, 0);
  const late = weatherVisualState(0.5, 1);

  assert.ok(late.floodOpacity > early.floodOpacity);
});

test('入力値を0から1の範囲として扱う', () => {
  assert.deepEqual(weatherVisualState(-3, -2), weatherVisualState(0, 0));
  assert.deepEqual(weatherVisualState(4, 6), weatherVisualState(1, 1));
});
