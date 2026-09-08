const EPSILON = 1e-7;

export function yawTowardPoint(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

function containsPoint(box, x, z) {
  return x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ;
}

function expandedBox(box, padding) {
  return {
    minX: box.minX - padding,
    maxX: box.maxX + padding,
    minZ: box.minZ - padding,
    maxZ: box.maxZ + padding
  };
}

function segmentBoxEntryRatio(start, delta, box, maximumRatio) {
  let entry = 0;
  let exit = maximumRatio;

  for (const axis of ['x', 'z']) {
    const origin = start[axis];
    const direction = delta[axis];
    const suffix = axis.toUpperCase();
    const minimum = box[`min${suffix}`];
    const maximum = box[`max${suffix}`];

    if (Math.abs(direction) < EPSILON) {
      if (origin < minimum || origin > maximum) return null;
      continue;
    }

    let near = (minimum - origin) / direction;
    let far = (maximum - origin) / direction;
    if (near > far) [near, far] = [far, near];
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }

  return entry >= 0 && entry <= maximumRatio ? entry : null;
}

function ratioInsideBounds(start, delta, bounds) {
  let ratio = 1;
  if (delta.x > EPSILON) ratio = Math.min(ratio, (bounds.maxX - start.x) / delta.x);
  else if (delta.x < -EPSILON) ratio = Math.min(ratio, (bounds.minX - start.x) / delta.x);
  if (delta.z > EPSILON) ratio = Math.min(ratio, (bounds.maxZ - start.z) / delta.z);
  else if (delta.z < -EPSILON) ratio = Math.min(ratio, (bounds.minZ - start.z) / delta.z);
  return Math.max(0, Math.min(1, ratio));
}

export function resolveThirdPersonCamera({
  target,
  desired,
  colliders = [],
  bounds = null,
  collisionRadius = 0.2,
  clearance = 0.1
}) {
  const delta = {
    x: desired.x - target.x,
    y: desired.y - target.y,
    z: desired.z - target.z
  };
  const horizontalDistance = Math.hypot(delta.x, delta.z);
  let ratio = bounds ? ratioInsideBounds(target, delta, bounds) : 1;
  let occluded = ratio < 1 - EPSILON;

  for (const collider of colliders) {
    const padded = expandedBox(collider, collisionRadius);
    const collisionBox = containsPoint(padded, target.x, target.z)
      && !containsPoint(collider, target.x, target.z)
      ? collider
      : padded;
    if (containsPoint(collisionBox, target.x, target.z)) continue;

    const entry = segmentBoxEntryRatio(target, delta, collisionBox, ratio);
    if (entry === null) continue;
    const clearanceRatio = horizontalDistance > EPSILON ? clearance / horizontalDistance : 0;
    ratio = Math.max(0, entry - clearanceRatio);
    occluded = true;
  }

  return {
    x: target.x + delta.x * ratio,
    y: target.y + delta.y * ratio,
    z: target.z + delta.z * ratio,
    ratio,
    occluded
  };
}
