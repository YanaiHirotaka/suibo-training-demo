export const FLOOD_ARRIVAL_BAND_COUNT = 8;
export const MAX_FLOOD_ARRIVAL_RATIO = 0.42;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

class FloodPriorityQueue {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  isEarlier(a, b) {
    return a.spillHeight < b.spillHeight
      || (a.spillHeight === b.spillHeight && a.distance < b.distance);
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.isEarlier(items[index], items[parent])) break;
      [items[index], items[parent]] = [items[parent], items[index]];
      index = parent;
    }
  }

  pop() {
    const items = this.items;
    const first = items[0];
    const last = items.pop();
    if (!items.length) return first;
    items[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let next = index;
      if (left < items.length && this.isEarlier(items[left], items[next])) next = left;
      if (right < items.length && this.isEarlier(items[right], items[next])) next = right;
      if (next === index) break;
      [items[index], items[next]] = [items[next], items[index]];
      index = next;
    }
    return first;
  }
}

// Finds the lowest connected route from the river into every land tile.
// `spillHeightBlocks` is the highest terrain step that water must cross on
// that route. A ridge therefore delays the cells behind it until the water
// reaches the ridge, while openings and low roads let water pass earlier.
export function buildConnectedFloodMap({
  width,
  depth,
  isFloodable,
  heightAt,
  isSource
}) {
  const size = width * depth;
  const spillHeightBlocks = new Float64Array(size);
  const distanceSteps = new Float64Array(size);
  spillHeightBlocks.fill(Number.POSITIVE_INFINITY);
  distanceSteps.fill(Number.POSITIVE_INFINITY);
  const queue = new FloodPriorityQueue();
  const indexOf = (x, z) => z * width + x;

  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFloodable(x, z) || !isSource(x, z)) continue;
      const index = indexOf(x, z);
      const spillHeight = Math.max(0, heightAt(x, z));
      spillHeightBlocks[index] = spillHeight;
      distanceSteps[index] = 0;
      queue.push({ index, x, z, spillHeight, distance: 0 });
    }
  }

  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.size) {
    const current = queue.pop();
    if (
      current.spillHeight !== spillHeightBlocks[current.index]
      || current.distance !== distanceSteps[current.index]
    ) continue;

    for (const [dx, dz] of directions) {
      const x = current.x + dx;
      const z = current.z + dz;
      if (x < 0 || x >= width || z < 0 || z >= depth || !isFloodable(x, z)) continue;
      const index = indexOf(x, z);
      const spillHeight = Math.max(current.spillHeight, Math.max(0, heightAt(x, z)));
      const distance = current.distance + 1;
      const isBetter = spillHeight < spillHeightBlocks[index]
        || (spillHeight === spillHeightBlocks[index] && distance < distanceSteps[index]);
      if (!isBetter) continue;
      spillHeightBlocks[index] = spillHeight;
      distanceSteps[index] = distance;
      queue.push({ index, x, z, spillHeight, distance });
    }
  }

  return { width, depth, spillHeightBlocks, distanceSteps };
}

export function connectedFloodArrivalRatio(
  spillHeightBlocks,
  distanceSteps,
  {
    blockSizeMeters,
    maximumLevelMeters,
    mapWidthBlocks,
    maximumTravelRatio = MAX_FLOOD_ARRIVAL_RATIO
  }
) {
  if (!Number.isFinite(spillHeightBlocks) || !Number.isFinite(distanceSteps)) return 1;
  if (maximumLevelMeters <= 0) return 1;
  const heightRatio = spillHeightBlocks * blockSizeMeters / maximumLevelMeters;
  const travelRatio = mapWidthBlocks > 0
    ? clamp01(distanceSteps / mapWidthBlocks) * maximumTravelRatio
    : 0;
  return clamp01(Math.max(heightRatio, travelRatio));
}

export function localFloodLevelMeters(globalLevelMeters, maximumLevelMeters, arrivalRatio) {
  if (maximumLevelMeters <= 0 || globalLevelMeters <= 0) return 0;
  const globalProgress = clamp01(globalLevelMeters / maximumLevelMeters);
  if (globalProgress <= clamp01(arrivalRatio)) return 0;
  return Math.min(globalLevelMeters, maximumLevelMeters);
}

export function floodArrivalBandIndex(
  arrivalRatio,
  bandCount = FLOOD_ARRIVAL_BAND_COUNT,
  maximumArrivalRatio = MAX_FLOOD_ARRIVAL_RATIO
) {
  if (bandCount <= 1 || maximumArrivalRatio <= 0) return 0;
  const normalized = clamp01(arrivalRatio / maximumArrivalRatio);
  return Math.min(bandCount - 1, Math.floor(normalized * bandCount));
}

export function floodArrivalRatioForBand(
  bandIndex,
  bandCount = FLOOD_ARRIVAL_BAND_COUNT,
  maximumArrivalRatio = MAX_FLOOD_ARRIVAL_RATIO
) {
  if (bandCount <= 1) return 0;
  return clamp01(bandIndex / (bandCount - 1)) * maximumArrivalRatio;
}
