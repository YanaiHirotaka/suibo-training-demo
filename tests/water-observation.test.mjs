import assert from 'node:assert/strict';
import test from 'node:test';

import {
  observedWaterLevelDelta,
  waterObservationPresentation
} from '../modules/water-observation.js';

test('観測差分は0.1m単位で表示し、水位低下時は負数にしない', () => {
  assert.equal(observedWaterLevelDelta(1.06, 0.81), 0.3);
  assert.equal(observedWaterLevelDelta(0.7, 0.9), 0);
});

test('水位ゲージは最高水位を超えて描画しない', () => {
  const state = waterObservationPresentation({
    levelMeters: 9,
    maxLevelMeters: 3,
    alertLevel: 5,
    timeSeconds: 2
  });
  assert.equal(state.ratio, 1);
  assert.equal(state.fillHeight, 2);
});

test('高い警戒レベルほど警告灯を強く表示する', () => {
  const safe = waterObservationPresentation({ levelMeters: 0.2, maxLevelMeters: 3, alertLevel: 2, timeSeconds: 1 });
  const danger = waterObservationPresentation({ levelMeters: 2.4, maxLevelMeters: 3, alertLevel: 5, timeSeconds: 1 });
  assert.ok(danger.beaconIntensity > safe.beaconIntensity);
  assert.ok(danger.haloOpacity > safe.haloOpacity);
  assert.ok(danger.beaconScale > safe.beaconScale);
});

test('アニメーション値は描画に安全な範囲に収まる', () => {
  for (let time = 0; time < 12; time += 0.2) {
    const state = waterObservationPresentation({ levelMeters: 1.4, maxLevelMeters: 3, alertLevel: 4, timeSeconds: time });
    assert.ok(state.beaconScale >= 1 && state.beaconScale <= 1.3);
    assert.ok(state.beaconIntensity >= 0.5 && state.beaconIntensity <= 2.5);
    assert.ok(state.haloOpacity >= 0 && state.haloOpacity <= 0.46);
  }
});
