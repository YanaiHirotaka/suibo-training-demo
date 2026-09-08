import assert from 'node:assert/strict';
import test from 'node:test';

import { shelterLandmarkState } from '../modules/shelter-landmark.js';

test('遠距離では避難所ビーコンを強く表示する', () => {
  const near = shelterLandmarkState(1.5, 0.4);
  const far = shelterLandmarkState(40, 0.4);

  assert.ok(far.beaconOpacity > near.beaconOpacity);
  assert.ok(far.beamOpacity > near.beamOpacity);
  assert.ok(far.beaconScale > near.beaconScale);
});

test('入口付近ではマーカーを小さく抑える', () => {
  const state = shelterLandmarkState(0, 2);

  assert.ok(state.beaconScale < 0.75);
  assert.ok(state.beamOpacity <= 0.05);
});

test('非表示状態では発光を完全に止める', () => {
  const state = shelterLandmarkState(30, 3, false);

  assert.equal(state.visible, false);
  assert.equal(state.beaconOpacity, 0);
  assert.equal(state.beamOpacity, 0);
});

test('アニメーション値は安全な範囲内に収まる', () => {
  for (const distance of [-10, 0, 12, 1000]) {
    for (const time of [-4, 0, 2.5, 100]) {
      const state = shelterLandmarkState(distance, time);
      assert.ok(state.beaconOpacity >= 0 && state.beaconOpacity <= 0.78);
      assert.ok(state.beamOpacity >= 0 && state.beamOpacity <= 0.22);
      assert.ok(state.beaconScale >= 0.65 && state.beaconScale <= 1.1);
      assert.ok(Math.abs(state.bobMeters) <= 0.09);
    }
  }
});
