import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRecalculateRoute } from '../modules/route-recalculation.js';

test('到達不能な避難所への再探索は60fpsの10秒間で4回に制限する', () => {
  let cooldownSeconds = 0;
  let searches = 0;
  for (let frame = 0; frame < 600; frame++) {
    cooldownSeconds -= 1 / 60;
    if (shouldRecalculateRoute({
      hasRoute: false,
      goalChanged: frame === 0,
      forced: false,
      cooldownSeconds,
      distanceFromRouteMeters: Infinity
    })) {
      searches++;
      cooldownSeconds = 2.5;
    }
  }
  assert.equal(searches, 4);
});

test('未発見のルートも待機後に再試行し、目標変更と通行止めは直ちに反映する', () => {
  const base = { hasRoute: false, goalChanged: false, forced: false, distanceFromRouteMeters: Infinity };
  assert.equal(shouldRecalculateRoute({ ...base, cooldownSeconds: 1 }), false);
  assert.equal(shouldRecalculateRoute({ ...base, cooldownSeconds: 0 }), true);
  assert.equal(shouldRecalculateRoute({ ...base, cooldownSeconds: 1, goalChanged: true }), true);
  assert.equal(shouldRecalculateRoute({ ...base, cooldownSeconds: 1, forced: true }), true);
});

test('経路上を歩いている間は移動距離にかかわらず再探索しない', () => {
  assert.equal(shouldRecalculateRoute({
    hasRoute: true,
    goalChanged: false,
    forced: false,
    cooldownSeconds: 0,
    distanceFromRouteMeters: 0.4
  }), false);
});

test('経路から大きく外れた場合は再探索する', () => {
  assert.equal(shouldRecalculateRoute({
    hasRoute: true,
    goalChanged: false,
    forced: false,
    cooldownSeconds: 0,
    distanceFromRouteMeters: 3.2
  }), true);
});

test('目標変更と明示的な更新では直ちに再探索する', () => {
  const base = { hasRoute: true, cooldownSeconds: 4, distanceFromRouteMeters: 0 };
  assert.equal(shouldRecalculateRoute({ ...base, goalChanged: true, forced: false }), true);
  assert.equal(shouldRecalculateRoute({ ...base, goalChanged: false, forced: true }), true);
});

test('ルート外でもクールダウン中は連続再探索しない', () => {
  assert.equal(shouldRecalculateRoute({
    hasRoute: true,
    goalChanged: false,
    forced: false,
    cooldownSeconds: 0.5,
    distanceFromRouteMeters: 4
  }), false);
});
