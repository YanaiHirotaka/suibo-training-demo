const DEFAULT_FRONT_CLEARANCE_METERS = 2.6;
const DEFAULT_PLAYER_RADIUS_METERS = 2.2;
const DEFAULT_ESCORT_RADIUS_METERS = 7;

export function createShelterArrivalZone(collider, options = {}) {
  const frontClearanceMeters = options.frontClearanceMeters ?? DEFAULT_FRONT_CLEARANCE_METERS;
  const playerRadius = options.playerRadius ?? DEFAULT_PLAYER_RADIUS_METERS;
  const escortRadius = options.escortRadius ?? DEFAULT_ESCORT_RADIUS_METERS;
  return Object.freeze({
    x: (collider.minX + collider.maxX) / 2,
    // The shelter entrance faces +Z. Keep the goal on the approach ramp,
    // before the doorway, so an escorted group does not need to crowd the wall.
    z: collider.maxZ + frontClearanceMeters,
    playerRadius,
    escortRadius
  });
}

export function isInsideShelterArrivalZone(position, zone, radius = zone.escortRadius) {
  return Math.hypot(position.x - zone.x, position.z - zone.z) <= radius;
}
