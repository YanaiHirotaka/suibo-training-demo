import assert from 'node:assert/strict';
import test from 'node:test';

import { cableSagOffset, createUrbanUtilityPlan } from '../modules/urban-utilities.js';

const bounds = {
  mainRoadSideX: 150,
  mainRoadNorthZ: 20,
  mainRoadSouthZ: 185,
  crossStreetSideZ: 138,
  crossStreetWestX: 106,
  crossStreetEastX: 150
};

test('電柱は幹線道路と横断道路の両方へ計画される', () => {
  const plan = createUrbanUtilityPlan(bounds);
  assert.ok(plan.poles.some(({ line }) => line === 'main'));
  assert.ok(plan.poles.some(({ line }) => line === 'cross'));
  assert.equal(plan.spans.length, plan.poles.length - 2);
});

test('スマホでは電柱数と電線分割数を削減する', () => {
  const desktop = createUrbanUtilityPlan(bounds);
  const mobile = createUrbanUtilityPlan({ ...bounds, mobile: true });
  assert.ok(mobile.poles.length < desktop.poles.length);
  assert.ok(mobile.cableSegmentsPerSpan < desktop.cableSegmentsPerSpan);
});

test('電線のたるみは両端で0、中央で最大になる', () => {
  assert.equal(cableSagOffset(0), 0);
  assert.equal(cableSagOffset(1), 0);
  assert.equal(cableSagOffset(0.5), -0.32);
  assert.ok(cableSagOffset(0.25) < 0);
});
