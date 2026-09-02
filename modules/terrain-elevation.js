export const CITY_RELIEF_MAX_HEIGHT_BLOCKS = 3;

// Fixed city relief used by both rendering and flood calculations. Roads are
// kept level so their long sidewalks and lane markings stay connected; the
// surrounding districts rise in broad terraces as they get farther inland.
export function cityReliefHeightBlocks({
  distanceFromRiverBlocks,
  blockZ,
  mapDepthBlocks,
  isRoad = false
}) {
  if (isRoad) return 0;

  let height = distanceFromRiverBlocks < 24
    ? 0
    : distanceFromRiverBlocks < 55
      ? 1
      : distanceFromRiverBlocks < 95 ? 2 : CITY_RELIEF_MAX_HEIGHT_BLOCKS;

  // The south-east district is a shallow basin fed by the downstream river.
  if (blockZ >= mapDepthBlocks * 0.72) height -= 1;
  return Math.max(0, height);
}
