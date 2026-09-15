import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MISSION_GOAL,
  canCompleteShelter,
  isTrainingMissionComplete,
  isWithinMissionRadius,
  missionGoalKey,
  missionGoalKind,
  missionProgressState
} from '../modules/mission-state.js';

test('ミッション状態から次の目的を一意に決定する', () => {
  assert.equal(missionGoalKind({ hazardChecked: false }), MISSION_GOAL.HAZARD);
  assert.equal(missionGoalKind({ hazardChecked: true, checkpointDone: false }), MISSION_GOAL.CHECKPOINT);
  assert.equal(missionGoalKind({ hazardChecked: true, checkpointDone: true, helpDone: false }), MISSION_GOAL.HELPER);
  assert.equal(missionGoalKind({ hazardChecked: true, checkpointDone: true, helpDone: true, shelterDone: false }), MISSION_GOAL.SHELTER);
  assert.equal(missionGoalKind({ hazardChecked: true, checkpointDone: true, helpDone: true, shelterDone: true }), MISSION_GOAL.COMPLETE);
  assert.equal(missionGoalKey({ hazardChecked: true, checkpointDone: true, helpDone: false }, 'elderly'), 'helper:elderly');
});

test('チェックポイントはハザード確認状態に関係なく距離で判定する', () => {
  assert.equal(isWithinMissionRadius({ x: 10, z: 20 }, { x: 11, z: 21 }, 2.2), true);
  assert.equal(isWithinMissionRadius({ x: 10, z: 20 }, { x: 13, z: 20 }, 2.2), false);
});

test('避難所完了には救助と全員到着が必要', () => {
  assert.equal(canCompleteShelter({ alreadyComplete: false, helpDone: true, allAtShelter: true }), true);
  assert.equal(canCompleteShelter({ alreadyComplete: false, helpDone: true, allAtShelter: false }), false);
  assert.equal(canCompleteShelter({ alreadyComplete: true, helpDone: true, allAtShelter: true }), false);
});

test('任意ミッションを含む進捗と訓練完了を計算する', () => {
  assert.deepEqual(missionProgressState([
    { id: 'hazard', complete: true },
    { id: 'checkpoint', complete: false },
    { id: 'detour', active: false, complete: false }
  ]), { complete: 1, total: 2, currentId: 'checkpoint' });

  const completeState = {
    hazardChecked: true,
    checkpointDone: true,
    helpDone: true,
    shelterDone: true
  };
  assert.equal(isTrainingMissionComplete(completeState), true);
  assert.equal(isTrainingMissionComplete({ ...completeState, detourActive: true }), false);
  assert.equal(isTrainingMissionComplete({ ...completeState, detourActive: true, detourConfirmed: true }), true);
});
