function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function shelterLandmarkState(distanceMeters, timeSeconds, active = true) {
  const distance = Math.max(0, Number(distanceMeters) || 0);
  const time = Math.max(0, Number(timeSeconds) || 0);
  if (!active) {
    return {
      visible: false,
      beaconOpacity: 0,
      beamOpacity: 0,
      beaconScale: 0.65,
      signGlow: 0.18,
      bobMeters: 0
    };
  }

  // Keep the beacon restrained near the entrance so it does not dominate the
  // camera, but make it increasingly readable from across the town.
  const distanceAmount = clamp01((distance - 2) / 24);
  const pulse = (Math.sin(time * 3.4) + 1) / 2;
  return {
    visible: true,
    beaconOpacity: lerp(0.32, 0.78, distanceAmount) * lerp(0.82, 1, pulse),
    beamOpacity: lerp(0.05, 0.22, distanceAmount) * lerp(0.78, 1, pulse),
    beaconScale: lerp(0.68, 1.05, distanceAmount) * lerp(0.96, 1.04, pulse),
    signGlow: lerp(0.22, 0.48, distanceAmount) * lerp(0.9, 1.08, pulse),
    bobMeters: Math.sin(time * 2.2) * lerp(0.035, 0.09, distanceAmount)
  };
}
