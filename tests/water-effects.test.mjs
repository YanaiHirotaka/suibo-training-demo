import assert from 'node:assert/strict';
import test from 'node:test';

import {
  floodSurfaceVisualState,
  wadingEffectState
} from '../modules/water-effects.js';

test('水位が上がるほど浸水面を濃く表示する', () => {
  const early = floodSurfaceVisualState(0.5, 0.1, 1);
  const late = floodSurfaceVisualState(0.5, 0.9, 1);

  assert.ok(late.opacity > early.opacity);
  assert.ok(late.deepColorMix > early.deepColorMix);
});

test('雨が強いほど水面の波紋間隔が短くなる', () => {
  const lightRain = floodSurfaceVisualState(0.1, 0.5, 1);
  const heavyRain = floodSurfaceVisualState(1, 0.5, 1);

  assert.ok(heavyRain.ambientRippleIntervalSeconds < lightRain.ambientRippleIntervalSeconds);
});

test('浸水中に移動した場合だけ歩行水しぶきを有効にする', () => {
  assert.equal(wadingEffectState(0, 3.25).active, false);
  assert.equal(wadingEffectState(0.5, 0).active, false);
  assert.equal(wadingEffectState(0.5, 3.25).active, true);
});

test('スマホでは水しぶきの発生数と頻度を抑える', () => {
  const desktop = wadingEffectState(0.7, 5.3, false);
  const mobile = wadingEffectState(0.7, 5.3, true);

  assert.ok(mobile.splashCount < desktop.splashCount);
  assert.ok(mobile.intervalSeconds > desktop.intervalSeconds);
});

test('水面表示用の入力を安全な範囲へ丸める', () => {
  const minimum = floodSurfaceVisualState(-4, -2, -3);
  const zero = floodSurfaceVisualState(0, 0, 0);
  const maximum = floodSurfaceVisualState(8, 6, 10);

  assert.deepEqual(minimum, zero);
  assert.ok(maximum.opacity <= 0.79);
  assert.ok(maximum.deepColorMix <= 1);
  assert.ok(maximum.textureOffsetX >= 0 && maximum.textureOffsetX < 1);
});
