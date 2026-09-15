import assert from 'node:assert/strict';
import test from 'node:test';

import { routePulseState, sampleRoutePolyline } from '../modules/route-presentation.js';

test('長い経路をほぼ一定間隔の矢印位置へ変換する', () => {
  const samples = sampleRoutePolyline(
    [{ x: 0, z: 0 }, { x: 0, z: 5 }],
    { spacing: 1, startOffset: 0.5, endPadding: 0.25 }
  );

  assert.equal(samples.length, 5);
  assert.deepEqual(samples.map((sample) => sample.z), [0.5, 1.5, 2.5, 3.5, 4.5]);
});

test('折れ曲がった経路でも累積距離を保って配置する', () => {
  const samples = sampleRoutePolyline(
    [{ x: 0, z: 0 }, { x: 0, z: 2 }, { x: 3, z: 2 }],
    { spacing: 1, startOffset: 0.5, endPadding: 0.25 }
  );

  assert.equal(samples.length, 5);
  assert.ok(samples.some((sample) => sample.x > 0 && sample.z === 2));
  assert.ok(samples.every((sample, index) => index === 0 || sample.distance > samples[index - 1].distance));
});

test('無効または短すぎる経路では矢印を生成しない', () => {
  assert.deepEqual(sampleRoutePolyline([]), []);
  assert.deepEqual(sampleRoutePolyline([{ x: 0, z: 0 }]), []);
  assert.deepEqual(sampleRoutePolyline([{ x: 0, z: 0 }, { x: 0.1, z: 0 }]), []);
});

test('流れる発光値は描画に安全な範囲に収まる', () => {
  for (const time of [0, 0.5, 4, 100]) {
    const state = routePulseState(time, 12);
    assert.ok(state.intensity >= 0.76 && state.intensity <= 1);
    assert.ok(state.scale >= 1.08 && state.scale <= 1.2);
    assert.ok(state.heightOffset >= 0.025 && state.heightOffset <= 0.06);
  }
});
