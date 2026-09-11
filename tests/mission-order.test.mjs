import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const functionSource = (name) => source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const noop = () => {};
const element = () => ({ classList: { add: noop, remove: noop }, setAttribute: noop, style: {}, querySelector: () => ({}) });

test('ハザード未確認でもチェックポイント通過を記録し、離れた後も維持する', () => {
  const context = vm.createContext({
    missionShelter: {}, characterChosen: true, missionHazardChecked: false,
    missionCheckpointDone: false, missionHelpNpcDone: false, missionReachShelterDone: false,
    checkpointPosition: { x: 10, z: 20 }, player: { position: { x: 10, z: 20 } },
    missionReachCheckpoint: element(), checkpointMarker: { visible: true },
    guidanceBanner: element(), guidanceArrow: element(), guidanceDistance: {},
    minimapGoal: element(), minimapGoalLine: element(),
    showNpcToast: noop, showTrainingAdvice: noop, updateMissionProgress: noop,
    checkTrainingComplete: noop, currentMissionGoal: () => null,
  });
  vm.runInContext(functionSource('completeCheckpointMission') + functionSource('updateMissionGuidance'), context);
  vm.runInContext('updateMissionGuidance()', context);
  assert.equal(context.missionCheckpointDone, true);
  assert.equal(context.checkpointMarker.visible, false);
  context.player.position.x = 100;
  vm.runInContext('updateMissionGuidance()', context);
  assert.equal(context.missionCheckpointDone, true);
});

test('ハザードとチェックポイントが未達でも近くの人に声をかけられる', () => {
  const npc = { rescued: false, marker: { render: noop } };
  const context = vm.createContext({
    characterChosen: true, missionHazardChecked: false, missionCheckpointDone: false,
    nearestUnrescuedNpc: () => npc, npcDistanceFromPlayer: () => 1,
    NPC_HELP_RADIUS_METERS: 1.4, rescuedPeopleTotal: () => npc.rescued ? 1 : 0,
    performance: { now: () => 0 }, npcHelpers: [npc, {}, {}],
    missionHelpNpc: { classList: { toggle: noop } }, setInteractionPrompt: noop,
    nextNpcToHelp: () => ({ label: '次の人' }), showNpcToast: noop,
    showTrainingAdvice: noop, updateMissionProgress: noop,
  });
  vm.runInContext(functionSource('tryHelpNpc') + '\ntryHelpNpc()', context);
  assert.equal(npc.rescued, true);
});

test('全員到着は他のミッションと独立して記録するが、同行者未到着では完了しない', () => {
  const context = vm.createContext({
    missionReachShelterDone: false, missionHazardChecked: false, missionCheckpointDone: false,
    missionHelpNpcDone: true, allRescuedPeopleAtShelter: () => false,
    missionReachShelter: element(), guidanceArrow: {}, guidanceBanner: element(), guidanceDistance: {},
    poseNpcShelterCelebration: noop, updateMissionProgress: noop, checkTrainingComplete: noop,
  });
  vm.runInContext(functionSource('completeMissionReachShelter'), context);
  vm.runInContext('completeMissionReachShelter()', context);
  assert.equal(context.missionReachShelterDone, false);
  context.allRescuedPeopleAtShelter = () => true;
  vm.runInContext('completeMissionReachShelter()', context);
  assert.equal(context.missionReachShelterDone, true);
});
