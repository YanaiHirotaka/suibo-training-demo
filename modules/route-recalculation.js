export function shouldRecalculateRoute({
  hasRoute,
  goalChanged,
  forced,
  cooldownSeconds,
  distanceFromRouteMeters,
  deviationThresholdMeters = 2.8
}) {
  if (forced || goalChanged || !hasRoute) return true;
  if ((Number(cooldownSeconds) || 0) > 0) return false;
  return (Number(distanceFromRouteMeters) || 0) > deviationThresholdMeters;
}
