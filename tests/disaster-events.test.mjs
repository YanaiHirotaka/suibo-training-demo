import assert from 'node:assert/strict';
import test from 'node:test';

import { lowRoadEventState } from '../modules/disaster-events.js';

test('低地道路イベントは水位上昇に応じて監視から冠水接近へ進む', () => {
  const monitoring = lowRoadEventState(0.05);
  const imminent = lowRoadEventState(0.15);

  assert.equal(monitoring.key, 'monitoring');
  assert.equal(imminent.key, 'imminent');
  assert.ok(imminent.approachRatio > monitoring.approachRatio);
});

test('20パーセント到達または明示的な閉鎖で通行止めになる', () => {
  assert.equal(lowRoadEventState(0.2).key, 'active');
  assert.equal(lowRoadEventState(0.02, true).key, 'active');
});

test('現場を通過済みならイベントを完了扱いにして後戻りさせない', () => {
  const state = lowRoadEventState(0.3, false, true);
  assert.equal(state.key, 'passed');
  assert.match(state.detail, /後戻りは不要/);
});

test('イベント進行率を表示可能な範囲に丸める', () => {
  assert.equal(lowRoadEventState(-2).approachRatio, 0);
  assert.equal(lowRoadEventState(4).approachRatio, 1);
});
