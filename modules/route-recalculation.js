export function shouldRecalculateRoute({
  hasRoute,
  goalChanged,
  forced,
  cooldownSeconds,
  distanceFromRouteMeters,
  deviationThresholdMeters = 2.8
}) {
  if (forced || goalChanged) return true;
  if ((Number(cooldownSeconds) || 0) > 0) return false;
  // Failed searches must also wait: an unreachable goal can exhaust the grid.
  if (!hasRoute) return true;
  return (Number(distanceFromRouteMeters) || 0) > deviationThresholdMeters;
}
