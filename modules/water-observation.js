function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function observedWaterLevelDelta(currentLevelMeters, previousLevelMeters) {
  return round(Math.max(0, (Number(currentLevelMeters) || 0) - (Number(previousLevelMeters) || 0)), 1);
}

export function waterObservationPresentation({
  levelMeters,
  maxLevelMeters,
  alertLevel,
  timeSeconds
}) {
  const maximum = Math.max(0.1, Number(maxLevelMeters) || 0.1);
  const ratio = clamp((Number(levelMeters) || 0) / maximum, 0, 1);
  const level = clamp(alertLevel, 2, 5);
  const pulse = (Math.sin((Number(timeSeconds) || 0) * (level >= 4 ? 5.4 : 3.2)) + 1) / 2;
  const warning = clamp((level - 2) / 3, 0, 1);

  return {
    ratio: round(ratio),
    fillHeight: round(Math.max(0.025, ratio * 2)),
    beaconScale: round(1 + warning * (0.08 + pulse * 0.16)),
    beaconIntensity: round(0.5 + warning * (0.75 + pulse * 1.25)),
    haloOpacity: round(warning * (0.12 + pulse * 0.34)),
    haloScale: round(0.82 + warning * (0.25 + pulse * 0.42))
  };
}
