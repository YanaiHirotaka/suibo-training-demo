export const EVACUATION_SHELTER_CONFIG = Object.freeze({
  // Located north-west of the starting road. The south ramp ends at the
  // cross street, creating one natural route from the start instead of a
  // long traverse to the far corner of the map.
  centerBlock: Object.freeze({ x: 112.5, z: 84.5 }),
  halfBlocks: 16,
  wallHeightBlocks: 11,
  roofHeightBlocks: 2,
  highGround: Object.freeze({
    heightBlocks: 13,
    plateauPaddingBlocks: 3,
    rampWidthBlocks: 9,
    rampLengthBlocks: 39
  })
});

export function shelterHighGroundHeightBlocks(blockX, blockZ, shelter = EVACUATION_SHELTER_CONFIG) {
  const highGround = shelter.highGround;
  const plateauHalf = shelter.halfBlocks + highGround.plateauPaddingBlocks;
  const plateauMinX = shelter.centerBlock.x - plateauHalf;
  const plateauMaxX = shelter.centerBlock.x + plateauHalf;
  const plateauMinZ = shelter.centerBlock.z - plateauHalf;
  const plateauMaxZ = shelter.centerBlock.z + plateauHalf;

  if (
    blockX >= plateauMinX && blockX <= plateauMaxX
    && blockZ >= plateauMinZ && blockZ <= plateauMaxZ
  ) return highGround.heightBlocks;

  // The shelter faces south (+Z). The ramp follows the existing nine-block
  // ShelterApproach road and loses about one vertical block per three blocks.
  const rampMinX = shelter.centerBlock.x - highGround.rampWidthBlocks / 2;
  const rampMaxX = shelter.centerBlock.x + highGround.rampWidthBlocks / 2;
  const rampStartZ = plateauMaxZ;
  const rampEndZ = rampStartZ + highGround.rampLengthBlocks;
  if (
    blockX < rampMinX || blockX > rampMaxX
    || blockZ <= rampStartZ || blockZ >= rampEndZ
  ) return 0;

  const remaining = (rampEndZ - blockZ) / highGround.rampLengthBlocks;
  return Math.min(highGround.heightBlocks, Math.max(1, Math.ceil(remaining * highGround.heightBlocks)));
}
