import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRecalculateRoute } from '../modules/route-recalculation.js';

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
