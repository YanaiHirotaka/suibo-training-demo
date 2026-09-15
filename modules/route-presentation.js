function finitePoint(point) {
  return point
    && Number.isFinite(Number(point.x))
    && Number.isFinite(Number(point.z));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sampleRoutePolyline(points, options = {}) {
  const route = Array.isArray(points) ? points.filter(finitePoint) : [];
  if (route.length < 2) return [];

  const spacing = clamp(Number(options.spacing) || 1.05, 0.35, 4);
  const startOffset = clamp(Number(options.startOffset) || 0.42, 0, spacing);
  const endPadding = clamp(Number(options.endPadding) || 0.3, 0, spacing);
  const segments = [];
  let totalDistance = 0;

  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1];
    const to = route[index];
    const dx = Number(to.x) - Number(from.x);
    const dz = Number(to.z) - Number(from.z);
    const length = Math.hypot(dx, dz);
    if (length < 0.001) continue;
    segments.push({ from, dx, dz, length, startDistance: totalDistance });
    totalDistance += length;
  }
  if (!segments.length || totalDistance <= startOffset + endPadding) return [];

  const samples = [];
  let segmentIndex = 0;
  for (let distance = startOffset; distance <= totalDistance - endPadding; distance += spacing) {
    while (
      segmentIndex < segments.length - 1
      && distance > segments[segmentIndex].startDistance + segments[segmentIndex].length
    ) segmentIndex += 1;
    const segment = segments[segmentIndex];
    const amount = clamp(
      (distance - segment.startDistance) / segment.length,
      0,
      1
    );
    samples.push({
      x: Number(segment.from.x) + segment.dx * amount,
      z: Number(segment.from.z) + segment.dz * amount,
      yaw: Math.atan2(-segment.dx, -segment.dz),
      distance
    });
  }
  return samples;
}

export function routePulseState(timeSeconds, distanceMeters = 0) {
  const time = Math.max(0, Number(timeSeconds) || 0);
  const distance = Math.max(0, Number(distanceMeters) || 0);
  const wave = (Math.sin(time * 4.6 - distance * 1.15) + 1) / 2;

  return {
    intensity: 0.76 + wave * 0.24,
    scale: 1.08 + wave * 0.12,
    heightOffset: 0.025 + wave * 0.035,
    markerScale: 0.98 + wave * 0.12
  };
}
