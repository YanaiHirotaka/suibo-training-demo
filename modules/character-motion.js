const ROLE_PROFILES = Object.freeze({
  elderly: Object.freeze({ gaitScale: 0.56, bobScale: 0.012 }),
  child: Object.freeze({ gaitScale: 0.92, bobScale: 0.034 }),
  resident: Object.freeze({ gaitScale: 0.74, bobScale: 0.024 }),
  rescue: Object.freeze({ gaitScale: 0.74, bobScale: 0.024 }),
  rain: Object.freeze({ gaitScale: 0.74, bobScale: 0.024 })
});

export function roleMotionProfile(role) {
  return ROLE_PROFILES[role] || ROLE_PROFILES.rain;
}

export function escortFormationTarget(target, index, baseFollowDistance = 1.3) {
  const safeIndex = Math.max(0, Math.floor(Number(index) || 0));
  const side = safeIndex % 2 === 0 ? -1 : 1;
  const lateralOffset = 0.28 + safeIndex * 0.06;
  const rotation = Number(target.rotation) || 0;

  return {
    x: Number(target.x) + Math.cos(rotation) * side * lateralOffset,
    z: Number(target.z) - Math.sin(rotation) * side * lateralOffset,
    followDistance: baseFollowDistance + safeIndex * 0.18
  };
}
