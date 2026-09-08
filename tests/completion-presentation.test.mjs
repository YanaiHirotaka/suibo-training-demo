import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUCCESS_PRESENTATION_TIMING,
  easeInOutCubic,
  successPresentationState
} from '../modules/completion-presentation.js';

test('成功演出はカメラ、タイトル、成績の順に表示する', () => {
  const start = successPresentationState(0);
  const title = successPresentationState(SUCCESS_PRESENTATION_TIMING.titleRevealMs);
  const stats = successPresentationState(SUCCESS_PRESENTATION_TIMING.statsRevealMs);

  assert.equal(start.titleVisible, false);
  assert.equal(start.statsVisible, false);
  assert.equal(title.titleVisible, true);
  assert.equal(title.statsVisible, false);
  assert.equal(stats.statsVisible, true);
});

test('動きを減らす設定では演出を即時完了する', () => {
  assert.deepEqual(successPresentationState(0, true), {
    cameraProgress: 1,
    titleVisible: true,
    statsVisible: true,
    scoreProgress: 1,
    focusReady: true
  });
});

test('補間値は0から1の範囲に収まる', () => {
  assert.equal(easeInOutCubic(-1), 0);
  assert.equal(easeInOutCubic(2), 1);
  assert.ok(easeInOutCubic(0.5) > easeInOutCubic(0.25));
});
