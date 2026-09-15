export const MISSION_GOAL = Object.freeze({
  HAZARD: 'hazard',
  CHECKPOINT: 'checkpoint',
  HELPER: 'helper',
  SHELTER: 'shelter',
  COMPLETE: 'complete'
});

export function missionGoalKind({
  hazardChecked,
  checkpointDone,
  helpDone,
  shelterDone
}) {
  if (!hazardChecked) return MISSION_GOAL.HAZARD;
  if (!checkpointDone) return MISSION_GOAL.CHECKPOINT;
  if (!helpDone) return MISSION_GOAL.HELPER;
  return shelterDone ? MISSION_GOAL.COMPLETE : MISSION_GOAL.SHELTER;
}

export function missionGoalKey(state, helperId = 'none') {
  const kind = missionGoalKind(state);
  return kind === MISSION_GOAL.HELPER ? `${kind}:${helperId || 'none'}` : kind;
}

export function isWithinMissionRadius(position, target, radiusMeters) {
  if (!position || !target) return false;
  return Math.hypot(target.x - position.x, target.z - position.z) < radiusMeters;
}

export function canCompleteShelter({ alreadyComplete, helpDone, allAtShelter }) {
  return !alreadyComplete && helpDone && allAtShelter;
}

export function isTrainingMissionComplete({
  hazardChecked,
  checkpointDone,
  helpDone,
  shelterDone,
  detourActive = false,
  detourConfirmed = false
}) {
  return Boolean(
    hazardChecked
    && checkpointDone
    && helpDone
    && shelterDone
    && (!detourActive || detourConfirmed)
  );
}

export function missionProgressState(stages) {
  const activeStages = stages.filter((stage) => stage.exists !== false && stage.active !== false);
  return {
    complete: activeStages.filter((stage) => stage.complete).length,
    total: activeStages.length,
    currentId: activeStages.find((stage) => !stage.complete)?.id ?? null
  };
}
