function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

export function floodSurfaceVisualState(weatherIntensity, floodProgress, timeSeconds = 0) {
  const rain = clamp01(weatherIntensity);
  const flood = clamp01(floodProgress);
  const time = Math.max(0, Number(timeSeconds) || 0);
  const activity = clamp01(rain * 0.65 + flood * 0.35);

  return {
    opacity: lerp(0.64, 0.79, flood),
    deepColorMix: clamp01(flood * 0.58 + rain * 0.24),
    textureOffsetX: wrap01(time * lerp(0.008, 0.018, activity)),
    textureOffsetY: wrap01(time * lerp(0.012, 0.028, activity)),
    ambientRippleIntervalSeconds: lerp(1.15, 0.42, rain),
    roadSheenPulse: 0.9 + Math.sin(time * 1.7) * 0.1
  };
}

export function floodDepthVisualState(depthMeters, maximumDepthMeters = 3) {
  const maximum = Math.max(0.1, Number(maximumDepthMeters) || 3);
  const depth = Math.max(0, Number(depthMeters) || 0);
  const depthAmount = clamp01(depth / maximum);

  return {
    depthAmount,
    opacityBoost: lerp(-0.05, 0.09, depthAmount),
    deepColorMix: lerp(0.08, 0.92, depthAmount),
    foamOpacity: lerp(0.28, 0.62, clamp01(depth / 0.65))
  };
}

export function floodRiskState(levelMeters, maximumLevelMeters = 3) {
  const maximum = Math.max(0.1, Number(maximumLevelMeters) || 3);
  const ratio = clamp01((Number(levelMeters) || 0) / maximum);
  const thresholdRatio = ratio + Number.EPSILON * 8;

  if (thresholdRatio >= 0.78) return { key: 'danger', label: '氾濫危険', ratio };
  if (thresholdRatio >= 0.48) return { key: 'warning', label: '避難判断', ratio };
  if (thresholdRatio >= 0.2) return { key: 'watch', label: '氾濫注意', ratio };
  return { key: 'normal', label: '平常', ratio };
}

export function wadingEffectState(floodDepthMeters, movementSpeed, mobile = false) {
  const depth = Math.max(0, Number(floodDepthMeters) || 0);
  const speed = Math.max(0, Number(movementSpeed) || 0);
  const depthAmount = clamp01(depth / 1.1);
  const speedAmount = clamp01(speed / 5.3);
  const active = depth > 0.03 && speed > 0.05;

  return {
    active,
    intensity: active ? clamp01(0.3 + depthAmount * 0.42 + speedAmount * 0.28) : 0,
    intervalSeconds: lerp(0.46, 0.18, speedAmount) * (mobile ? 1.24 : 1),
    rippleRadiusMeters: lerp(0.2, 0.42, depthAmount),
    splashCount: active ? (mobile ? 2 : 3) : 0
  };
}
