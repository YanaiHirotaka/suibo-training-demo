import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#game');
const guide = document.querySelector('#startGuide');
const fpsCounter = document.querySelector('#fpsCounter');
const characterSelect = document.querySelector('#characterSelect');
const editToggle = document.querySelector('#editToggle');
const editTools = document.querySelector('#editTools');
const brushSizeSelect = document.querySelector('#brushSize');
const brushSizeRow = document.querySelector('#brushSizeRow');
const exportPaintButton = document.querySelector('#exportPaint');
const clearPaintButton = document.querySelector('#clearPaint');
const materialRow = document.querySelector('#materialRow');
const blockActionRow = document.querySelector('#blockActionRow');
const rangeRow = document.querySelector('#rangeRow');
const rangeStatus = document.querySelector('#rangeStatus');
const rangeResetButton = document.querySelector('#rangeReset');
const rangeFloatToggle = document.querySelector('#rangeFloatToggle');
const rangeFloatToggleRow = document.querySelector('#rangeFloatToggleRow');
const structureRow = document.querySelector('#structureRow');
const structureStatus = document.querySelector('#structureStatus');
const structureDeselectButton = document.querySelector('#structureDeselect');
const characterCards = document.querySelectorAll('.character-card');
const minimapMap = document.querySelector('#minimapMap');
const minimapContent = document.querySelector('#minimapContent');
const minimapFrame = document.querySelector('#minimapFrame');
const minimapGround = document.querySelector('#minimapGround');
const minimapGrid = document.querySelector('#minimapGrid');
const minimapRoads = document.querySelector('#minimapRoads');
const minimapRiver = document.querySelector('#minimapRiver');
const minimapHouse = document.querySelector('#minimapHouse');
const minimapAdditionalHouses = document.querySelector('#minimapAdditionalHouses');
const minimapPlayer = document.querySelector('#minimapPlayer');
const minimapSizeLabel = document.querySelector('#minimapSizeLabel');

const mapConfig = Object.freeze({
  // 1 Three.js unit = 1 metre. Keep this value fixed so assets remain the same scale.
  blockSize: 0.3125,
  // Block coordinates use the minimap convention: northwest is (0, 0), east is +X, south is +Z.
  // Width was 105; expanded by 7 cells (105 blocks) to the west, so every
  // existing X-anchored position below is shifted +105 to stay in the same
  // physical spot relative to the (unmoved) east edge.
  blocks: {
    width: 105 + 7 * 15,
    depth: 195
  },
  cellBlocks: 15,
  playerStartBlock: {
    x: 75 + 7 * 15,
    z: 187.5
  },
  structures: {
    startHouse: {
      centerBlock: {
        x: 52.5 + 7 * 15,
        z: 182.5
      },
      halfBlocks: 7
    },
    additionalHouses: [
      {
        name: 'SmallBlueHouse',
        label: '青い家',
        centerBlock: { x: 52.5 + 7 * 15, z: 162.5 },
        halfBlocks: 6,
        wallHeightBlocks: 10,
        roofHeightBlocks: 4,
        colors: { foundation: 0x858782, wall: 0xb8c6d7, trim: 0x4f6170, glass: 0x5fa9c7, door: 0x5b3a2d, roof: 0x2f5572 }
      },
      {
        name: 'BlockApartment',
        label: 'アパート',
        centerBlock: { x: 52.5 + 7 * 15, z: 142.5 },
        halfBlocks: 7,
        wallHeightBlocks: 24,
        roofHeightBlocks: 2,
        apartment: true,
        colors: { foundation: 0x747874, wall: 0xb8b6aa, trim: 0x6e726f, glass: 0x4a88a6, door: 0x463a32, roof: 0x5d6568 }
      }
    ]
  },
  areas: {
    roadFromHouse: {
      widthBlocks: 15,
      gapFromHouseRightBlocks: 5,
      targetCellFromNorth: 9
    },
    stairsFromRoad: {
      angleDegrees: 60,
      widthBlocks: 15,
      lengthBlocks: 60,
      stepRunBlocks: 3,
      connectionOverlapBlocks: 2
    },
    river: {
      // Upstream is the north edge. "Rightから28ブロック目" means x = width - 28.
      // Shifted 5 blocks further left than before (both banks, same width).
      upstream: {
        leftFromRight: 28,
        rightFromRight: 13
      },
      downstream: {
        leftFromRight: 14,
        rightFromRight: 0
      },
      minWidthBlocks: 13,
      maxWidthBlocks: 17
    },
    riverFence: {
      offsetBlocks: 1.75,
      postSpacingBlocks: 6,
      blockMargin: 0.65,
      collisionHalfWidthBlocks: 0.95
    }
  }
});

// How far the map was widened to the west, in blocks (7 cells x 15).
const WEST_EXPANSION_BLOCKS = 7 * mapConfig.cellBlocks;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x83cffa);
scene.fog = new THREE.Fog(0xbce5f5, 58, 150);

const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.05, 220);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

scene.add(new THREE.HemisphereLight(0xe9f8ff, 0x6c8a55, 1.7));
const sun = new THREE.DirectionalLight(0xfff1cf, 2.35);
sun.position.set(-32, 48, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -58;
sun.shadow.camera.right = 58;
sun.shadow.camera.top = 58;
sun.shadow.camera.bottom = -58;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

function canvasTexture(draw, size = 128) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = size;
  const ctx = surface.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

const grassTexture = canvasTexture((ctx, size) => {
  ctx.fillStyle = '#6fae47';
  ctx.fillRect(0, 0, size, size);
  let seed = 71;
  const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (let i = 0; i < 1300; i++) {
    const light = random() > 0.48;
    ctx.fillStyle = light ? 'rgba(151,198,91,.22)' : 'rgba(52,112,48,.18)';
    const s = 1 + Math.floor(random() * 3);
    ctx.fillRect(random() * size, random() * size, s, s);
  }
});
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(1, 1);

const riverSurfaceTexture = canvasTexture((ctx, size) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#0b5a76');
  gradient.addColorStop(0.38, '#1a92b0');
  gradient.addColorStop(0.68, '#146f8c');
  gradient.addColorStop(1, '#0a4a60');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  let seed = 193;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  ctx.lineCap = 'round';

  for (let i = 0; i < 180; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = 22 + random() * 78;
    const alpha = 0.05 + random() * 0.16;
    ctx.strokeStyle = `rgba(178, 226, 240, ${alpha})`;
    ctx.lineWidth = 1 + random() * 1.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + w * 0.32,
      y - 3 + random() * 6,
      x + w * 0.68,
      y - 3 + random() * 6,
      x + w,
      y + random() * 4 - 2
    );
    ctx.stroke();
  }

  for (let i = 0; i < 90; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = 34 + random() * 94;
    const alpha = 0.09 + random() * 0.22;
    ctx.strokeStyle = `rgba(225, 249, 255, ${alpha})`;
    ctx.lineWidth = 1 + random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + w * 0.25,
      y + random() * 5 - 2.5,
      x + w * 0.72,
      y + random() * 5 - 2.5,
      x + w,
      y + random() * 4 - 2
    );
    ctx.stroke();
  }

  for (let i = 0; i < 180; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = 10 + random() * 38;
    ctx.fillStyle = `rgba(8, 58, 74, ${0.05 + random() * 0.09})`;
    ctx.fillRect(x, y, w, 1 + random() * 2);
  }
}, 256);
riverSurfaceTexture.wrapS = riverSurfaceTexture.wrapT = THREE.RepeatWrapping;
riverSurfaceTexture.repeat.set(1.08, 6.2);

const riverReflectionTexture = canvasTexture((ctx, size) => {
  ctx.clearRect(0, 0, size, size);
  let seed = 877;
  const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);

  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(210, 250, 255, 0.25)';
  ctx.shadowBlur = 2.4;

  for (let i = 0; i < 95; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = 44 + random() * 116;
    const alpha = 0.18 + random() * 0.40;
    ctx.strokeStyle = `rgba(240, 253, 255, ${alpha})`;
    ctx.lineWidth = 1.1 + random() * 2.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + w * 0.28,
      y + random() * 7 - 3.5,
      x + w * 0.72,
      y + random() * 7 - 3.5,
      x + w,
      y + random() * 5 - 2.5
    );
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  for (let i = 0; i < 40; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = 20 + random() * 54;
    ctx.strokeStyle = `rgba(160, 220, 235, ${0.10 + random() * 0.20})`;
    ctx.lineWidth = 1 + random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + random() * 3 - 1.5);
    ctx.stroke();
  }
}, 256);
riverReflectionTexture.wrapS = riverReflectionTexture.wrapT = THREE.RepeatWrapping;
riverReflectionTexture.repeat.set(0.86, 4.8);

// Field dimensions, block scale, and gameplay positions come from mapConfig.
const field = new THREE.Group();
const tileSize = mapConfig.blockSize;
const tilesWide = mapConfig.blocks.width;
const tilesDeep = mapConfig.blocks.depth;
const fieldWidth = tileSize * tilesWide;
const fieldDepth = tileSize * tilesDeep;
const halfFieldWidth = fieldWidth / 2;
const halfFieldDepth = fieldDepth / 2;

function worldXFromBlock(blockX) {
  return -halfFieldWidth + blockX * tileSize;
}

function worldZFromBlock(blockZ) {
  return -halfFieldDepth + blockZ * tileSize;
}

function blockXFromWorld(worldX) {
  return (worldX + halfFieldWidth) / tileSize;
}

function blockZFromWorld(worldZ) {
  return (worldZ + halfFieldDepth) / tileSize;
}

function riverEdgesAtBlockZ(blockZ) {
  const river = mapConfig.areas.river;
  const t = blockZ / (tilesDeep - 1);
  const upstreamLeft = tilesWide - river.upstream.leftFromRight;
  const upstreamRight = tilesWide - river.upstream.rightFromRight;
  const downstreamLeft = tilesWide - river.downstream.leftFromRight;
  const downstreamRight = tilesWide - river.downstream.rightFromRight;
  const baseLeft = THREE.MathUtils.lerp(upstreamLeft, downstreamLeft, t);
  const baseRight = THREE.MathUtils.lerp(upstreamRight, downstreamRight, t);
  const endpointDamp = Math.sin(t * Math.PI);
  const targetWidth = THREE.MathUtils.lerp(
    river.minWidthBlocks,
    river.maxWidthBlocks,
    0.5 + Math.sin(t * Math.PI * 4.2 + 0.65) * 0.5
  );
  const baseWidth = baseRight - baseLeft;
  const widthOffset = ((targetWidth - baseWidth) / 2) * endpointDamp;
  const leftWave = (Math.sin(t * Math.PI * 7.5) * 0.85 + Math.sin(t * Math.PI * 17) * 0.35) * endpointDamp;
  const rightWave = (Math.cos(t * Math.PI * 6.3) * 0.75 + Math.sin(t * Math.PI * 13 + 1.2) * 0.3) * endpointDamp;

  return {
    left: THREE.MathUtils.clamp(baseLeft - widthOffset + leftWave, 0, tilesWide),
    right: THREE.MathUtils.clamp(baseRight + widthOffset + rightWave, 0, tilesWide)
  };
}

function isRiverBlock(blockX, blockZ) {
  const { left, right } = riverEdgesAtBlockZ(blockZ);
  return blockX >= Math.floor(left) && blockX <= Math.ceil(right) - 1;
}

function riverPointAt(blockZ, lane = 0.5) {
  const wrappedZ = ((blockZ % tilesDeep) + tilesDeep) % tilesDeep;
  const { left, right } = riverEdgesAtBlockZ(wrappedZ);
  const x = THREE.MathUtils.lerp(left + 1.2, right - 1.2, lane);
  return {
    blockX: x,
    blockZ: wrappedZ,
    worldX: worldXFromBlock(x),
    worldZ: worldZFromBlock(wrappedZ)
  };
}

function getRoadFromHouseBounds() {
  const house = mapConfig.structures.startHouse;
  const road = mapConfig.areas.roadFromHouse;
  const left = house.centerBlock.x + house.halfBlocks + 0.5 + road.gapFromHouseRightBlocks;
  const right = left + road.widthBlocks;
  const targetZ = (road.targetCellFromNorth - 0.5) * mapConfig.cellBlocks;
  const bottomZ = mapConfig.blocks.depth;

  return {
    left,
    right,
    top: targetZ,
    bottom: bottomZ
  };
}

// The map layout is static, so this profile never changes after the first
// call. It was being recomputed (with trig + object allocations) every
// single frame via getWalkableHeight -> getRampHeightAt; cache it instead.
let cachedStairProfile = null;
function getStairProfile() {
  if (cachedStairProfile) return cachedStairProfile;
  const road = getRoadFromHouseBounds();
  const stairs = mapConfig.areas.stairsFromRoad;
  const angle = THREE.MathUtils.degToRad(stairs.angleDegrees);
  const forward = {
    x: -Math.sin(angle),
    z: -Math.cos(angle)
  };
  const across = {
    x: Math.cos(angle),
    z: -Math.sin(angle)
  };

  cachedStairProfile = {
    startX: (road.left + road.right) / 2,
    startZ: road.top,
    forward,
    across,
    width: stairs.widthBlocks,
    length: stairs.lengthBlocks,
    stepRun: stairs.stepRunBlocks,
    overlap: stairs.connectionOverlapBlocks
  };
  return cachedStairProfile;
}

function stairLocalPosition(blockX, blockZ) {
  const stair = getStairProfile();
  const dx = blockX - stair.startX;
  const dz = blockZ - stair.startZ;
  return {
    along: dx * stair.forward.x + dz * stair.forward.z,
    across: dx * stair.across.x + dz * stair.across.z,
    stair
  };
}

function isStairBlock(blockX, blockZ) {
  const { along, across, stair } = stairLocalPosition(blockX + 0.5, blockZ + 0.5);
  return along >= -stair.overlap
    && along < stair.length
    && Math.abs(across) <= stair.width / 2;
}

function isRoadBlock(blockX, blockZ) {
  const road = getRoadFromHouseBounds();
  return blockX >= Math.floor(road.left)
    && blockX <= Math.ceil(road.right) - 1
    && blockZ >= Math.floor(road.top)
    && blockZ <= Math.ceil(road.bottom) - 1;
}

// The straight path continuing north from the top of the stairs to the map
// edge, over the flattened plateau. Deeply overlaps the angled top of the
// stairs (about a full stair-width) so the seam between the straight edge
// and the diagonal ramp edge is buried inside shared coverage instead of
// sitting right at the jagged boundary between the two shapes.
let cachedPlateauPathBounds = null;
function getPlateauPathBounds() {
  if (cachedPlateauPathBounds) return cachedPlateauPathBounds;
  const stair = getStairProfile();
  const halfWidth = Math.floor(stair.width / 2);
  const centerBlockX = stair.startX + stair.forward.x * stair.length;
  const topBlockZ = stair.startZ + stair.forward.z * stair.length;
  cachedPlateauPathBounds = {
    minBlockX: Math.floor(centerBlockX - halfWidth),
    maxBlockX: Math.ceil(centerBlockX + halfWidth),
    endBlockZ: Math.min(tilesDeep, Math.ceil(topBlockZ) + stair.width)
  };
  return cachedPlateauPathBounds;
}

function isPlateauPathBlock(blockX, blockZ) {
  const bounds = getPlateauPathBounds();
  if (blockX < bounds.minBlockX || blockX >= bounds.maxBlockX) return false;
  if (blockZ < 0 || blockZ >= bounds.endBlockZ) return false;
  // Clip the path's south end along the stairs' top edge (the diagonal line
  // perpendicular to the stairs' travel direction), so both sides of the
  // junction meet the ramp at the same diagonal instead of the rectangle's
  // horizontal bottom cutting past the ramp into the grass.
  const { along, stair } = stairLocalPosition(blockX + 0.5, blockZ + 0.5);
  return along >= stair.length;
}

function houseConfigs() {
  return [mapConfig.structures.startHouse, ...mapConfig.structures.additionalHouses];
}

function distanceFromHouseFootprint(blockX, blockZ, house) {
  const margin = 1.5;
  const minX = house.centerBlock.x - house.halfBlocks - margin;
  const maxX = house.centerBlock.x + house.halfBlocks + margin;
  const minZ = house.centerBlock.z - house.halfBlocks - margin;
  const maxZ = house.centerBlock.z + house.halfBlocks + margin;
  const dx = blockX < minX ? minX - blockX : blockX > maxX ? blockX - maxX : 0;
  const dz = blockZ < minZ ? minZ - blockZ : blockZ > maxZ ? blockZ - maxZ : 0;
  return Math.hypot(dx, dz);
}

function terrainHeightLimitedByHouses(blockX, blockZ, heightBlocks) {
  let limitedHeight = heightBlocks;
  for (const house of houseConfigs()) {
    const distance = distanceFromHouseFootprint(blockX + 0.5, blockZ + 0.5, house);
    const allowedHeight = Math.floor(distance / 3);
    limitedHeight = Math.min(limitedHeight, allowedHeight);
  }
  return Math.max(0, limitedHeight);
}

function rampLevelFromAlong(along, stair) {
  return Math.floor(Math.max(0, along) / stair.stepRun);
}

// Flatten the upper-left area at and beyond the cell that is 8 cells up from
// the bottom and 3 cells in from the left, to a uniform height of 13 blocks.
const flattenPlateauHeight = 13;
const flattenPlateauMaxBlockX = 3 * mapConfig.cellBlocks + WEST_EXPANSION_BLOCKS;
const flattenPlateauMaxBlockZ = (tilesDeep / mapConfig.cellBlocks - 8 + 1) * mapConfig.cellBlocks;

// Hand-edited height deltas from the in-game "積む/削除" edit tools. Keyed by
// "x,z", value is a signed integer number of blocks added (or removed, if
// negative) on top of the procedurally-generated height. River blocks and
// cells with an actual ramp step are never editable, so they're excluded
// before this is consulted.
const heightPaintOverrides = new Map();

// isStairBlock(x, z) marks a much wider along/across polygon than the
// visible zigzag steps - most of it is flat (baseLevel <= 0) and looks
// identical to the surrounding grass/road, but used to be hard-excluded
// from editing anyway, which is why clicks near the road/stairs junction
// silently did nothing. Only cells with an actual positive ramp height are
// owned by the ramp mesh and need to stay off-limits.
function isRampActive(blockX, blockZ) {
  return isStairBlock(blockX, blockZ) && getBaseTerrainHeightBlocks(blockX, blockZ) > 0;
}

function getTerrainHeightBlocks(blockX, blockZ) {
  const base = getBaseTerrainHeightBlocks(blockX, blockZ);
  if (isRiverBlock(blockX, blockZ) || isRampActive(blockX, blockZ)) return base;
  const delta = heightPaintOverrides.get(blockX + ',' + blockZ);
  if (!delta) return base;
  return THREE.MathUtils.clamp(base + delta, 0, 40);
}

function getBaseTerrainHeightBlocks(blockX, blockZ) {
  if (blockX < 0 || blockX >= tilesWide || blockZ < 0 || blockZ >= tilesDeep) return 0;
  if (isRiverBlock(blockX, blockZ)) return 0;
  // The 7-cell western expansion just extrudes whatever height the old west
  // edge (now at WEST_EXPANSION_BLOCKS) had for this row, so existing terrain
  // shapes (plateau, ramp...) are preserved rather than recomputed against an
  // edge that moved. Everything east of that boundary is untouched (X clamps
  // to itself there).
  const effectiveBlockX = Math.max(blockX, WEST_EXPANSION_BLOCKS);
  if (effectiveBlockX < flattenPlateauMaxBlockX && blockZ < flattenPlateauMaxBlockZ) return flattenPlateauHeight;

  const { along, across, stair } = stairLocalPosition(effectiveBlockX + 0.5, blockZ + 0.5);
  if (along < 0) return 0;

  const isBeyondRampEnd = along >= stair.length;
  const levelAlong = isBeyondRampEnd ? stair.length - 0.001 : along;
  const baseLevel = rampLevelFromAlong(levelAlong, stair);
  if (baseLevel <= 0) return 0;

  const rampHalfWidth = stair.width / 2;
  const sideDistanceFromRamp = Math.max(0, Math.abs(across) - rampHalfWidth);
  const sameHeightShoulderWidth = 9;
  const shoulderDrop = Math.floor(Math.max(0, sideDistanceFromRamp - sameHeightShoulderWidth) / 4);

  const riverLeft = riverEdgesAtBlockZ(blockZ).left;
  const distanceToRiver = riverLeft - (effectiveBlockX + 0.5);
  if (distanceToRiver <= 0) return 0;

  const riverSlopeWidth = 22;
  const rawRiverDrop = Math.max(0, Math.ceil((riverSlopeWidth - distanceToRiver) / 5));
  const riverInfluence = THREE.MathUtils.clamp((sideDistanceFromRamp - sameHeightShoulderWidth - 4) / 14, 0, 1);
  const riverDrop = Math.floor(rawRiverDrop * riverInfluence);
  const maxRampHeight = 13;
  const height = Math.min(maxRampHeight, Math.max(0, baseLevel - shoulderDrop - riverDrop));
  // Apply the house-proximity height limit everywhere, including past the
  // ramp's end - otherwise the field just beyond the last step is exempt
  // from it while the last step itself isn't, creating a sudden cliff. Beyond
  // the ramp, use the frozen boundary position (not the real, ever-further
  // blockX/blockZ) so the limit itself stays flat too, instead of climbing
  // again as the field gets farther from nearby houses.
  const limitBlockX = isBeyondRampEnd
    ? Math.floor(stair.startX + stair.forward.x * levelAlong + stair.across.x * across)
    : effectiveBlockX;
  const limitBlockZ = isBeyondRampEnd
    ? Math.floor(stair.startZ + stair.forward.z * levelAlong + stair.across.z * across)
    : blockZ;
  return terrainHeightLimitedByHouses(limitBlockX, limitBlockZ, height);
}

function getTerrainHeightAt(x, z) {
  const blockX = Math.floor(blockXFromWorld(x));
  const blockZ = Math.floor(blockZFromWorld(z));
  return getTerrainHeightBlocks(blockX, blockZ) * tileSize;
}

const lowerSoil = new THREE.Mesh(
  new THREE.BoxGeometry(fieldWidth, 3.9, fieldDepth),
  new THREE.MeshLambertMaterial({ color: 0x75523b })
);
lowerSoil.position.y = -2.0;
lowerSoil.receiveShadow = true;
field.add(lowerSoil);

const tileSurfaceThickness = 0.07;
const rampSurfaceThickness = 0.072;
const tileGeometry = new THREE.BoxGeometry(tileSize - 0.003, tileSurfaceThickness, tileSize - 0.003);
const tileMatrix = new THREE.Matrix4();
const tileColor = new THREE.Color();

// Hand-painted road/grass overrides from the in-game edit mode. Keyed by
// "x,z", value is 'road' or 'grass'. This is a full export (エクスポート
// button) of the live tilePaintOverrides map, already in final/absolute
// block coordinates (post west-expansion) - no shifting needed.
const DEFAULT_TILE_OVERRIDES = [
  ["180,126","road"], ["181,126","road"], ["181,125","road"], ["182,126","road"], ["183,126","road"], ["182,125","road"], ["130,91","road"], ["130,90","road"],
  ["132,90","road"], ["132,85","road"], ["132,86","road"], ["132,88","road"], ["132,87","road"], ["131,87","road"], ["131,88","road"], ["131,89","road"],
  ["130,89","road"], ["131,90","road"], ["132,89","road"], ["131,91","road"], ["132,91","road"], ["132,92","road"], ["118,109","grass"], ["118,108","grass"],
  ["118,107","grass"], ["119,107","grass"], ["119,106","grass"], ["118,106","grass"], ["118,105","grass"], ["118,104","grass"], ["119,104","grass"], ["119,105","grass"],
  ["120,105","grass"], ["120,104","grass"], ["137,95","road"], ["136,94","road"], ["135,93","road"], ["134,92","road"], ["133,91","road"], ["133,92","road"],
  ["134,93","road"], ["135,94","road"], ["16,103","grass"], ["15,102","grass"], ["14,101","grass"], ["13,101","grass"], ["14,102","grass"], ["13,102","grass"],
  ["14,103","grass"], ["13,103","grass"], ["15,103","grass"], ["49,89","road"], ["50,89","road"], ["51,89","road"], ["52,89","road"], ["53,89","road"],
  ["54,89","road"], ["55,89","road"], ["56,89","road"], ["57,89","road"], ["58,89","road"], ["59,89","road"], ["60,89","road"], ["61,89","road"],
  ["62,89","road"], ["63,89","road"], ["64,89","road"], ["65,89","road"], ["66,89","road"], ["67,89","road"], ["68,89","road"], ["69,89","road"],
  ["70,89","road"], ["71,89","road"], ["72,89","road"], ["73,89","road"], ["74,89","road"], ["75,89","road"], ["76,89","road"], ["77,89","road"],
  ["78,89","road"], ["79,89","road"], ["80,89","road"], ["81,89","road"], ["82,89","road"], ["83,89","road"], ["84,89","road"], ["85,89","road"],
  ["86,89","road"], ["87,89","road"], ["88,89","road"], ["89,89","road"], ["90,89","road"], ["91,89","road"], ["92,89","road"], ["93,89","road"],
  ["94,89","road"], ["95,89","road"], ["96,89","road"], ["97,89","road"], ["98,89","road"], ["99,89","road"], ["100,89","road"], ["101,89","road"],
  ["102,89","road"], ["103,89","road"], ["104,89","road"], ["105,89","road"], ["106,89","road"], ["107,89","road"], ["108,89","road"], ["109,89","road"],
  ["110,89","road"], ["111,89","road"], ["112,89","road"], ["113,89","road"], ["114,89","road"], ["115,89","road"], ["116,89","road"], ["117,89","road"],
  ["49,90","road"], ["50,90","road"], ["51,90","road"], ["52,90","road"], ["53,90","road"], ["54,90","road"], ["55,90","road"], ["56,90","road"],
  ["57,90","road"], ["58,90","road"], ["59,90","road"], ["60,90","road"], ["61,90","road"], ["62,90","road"], ["63,90","road"], ["64,90","road"],
  ["65,90","road"], ["66,90","road"], ["67,90","road"], ["68,90","road"], ["69,90","road"], ["70,90","road"], ["71,90","road"], ["72,90","road"],
  ["73,90","road"], ["74,90","road"], ["75,90","road"], ["76,90","road"], ["77,90","road"], ["78,90","road"], ["79,90","road"], ["80,90","road"],
  ["81,90","road"], ["82,90","road"], ["83,90","road"], ["84,90","road"], ["85,90","road"], ["86,90","road"], ["87,90","road"], ["88,90","road"],
  ["89,90","road"], ["90,90","road"], ["91,90","road"], ["92,90","road"], ["93,90","road"], ["94,90","road"], ["95,90","road"], ["96,90","road"],
  ["97,90","road"], ["98,90","road"], ["99,90","road"], ["100,90","road"], ["101,90","road"], ["102,90","road"], ["103,90","road"], ["104,90","road"],
  ["105,90","road"], ["106,90","road"], ["107,90","road"], ["108,90","road"], ["109,90","road"], ["110,90","road"], ["111,90","road"], ["112,90","road"],
  ["113,90","road"], ["114,90","road"], ["115,90","road"], ["116,90","road"], ["117,90","road"], ["49,91","road"], ["50,91","road"], ["51,91","road"],
  ["52,91","road"], ["53,91","road"], ["54,91","road"], ["55,91","road"], ["56,91","road"], ["57,91","road"], ["58,91","road"], ["59,91","road"],
  ["60,91","road"], ["61,91","road"], ["62,91","road"], ["63,91","road"], ["64,91","road"], ["65,91","road"], ["66,91","road"], ["67,91","road"],
  ["68,91","road"], ["69,91","road"], ["70,91","road"], ["71,91","road"], ["72,91","road"], ["73,91","road"], ["74,91","road"], ["75,91","road"],
  ["76,91","road"], ["77,91","road"], ["78,91","road"], ["79,91","road"], ["80,91","road"], ["81,91","road"], ["82,91","road"], ["83,91","road"],
  ["84,91","road"], ["85,91","road"], ["86,91","road"], ["87,91","road"], ["88,91","road"], ["89,91","road"], ["90,91","road"], ["91,91","road"],
  ["92,91","road"], ["93,91","road"], ["94,91","road"], ["95,91","road"], ["96,91","road"], ["97,91","road"], ["98,91","road"], ["99,91","road"],
  ["100,91","road"], ["101,91","road"], ["102,91","road"], ["103,91","road"], ["104,91","road"], ["105,91","road"], ["106,91","road"], ["107,91","road"],
  ["108,91","road"], ["109,91","road"], ["110,91","road"], ["111,91","road"], ["112,91","road"], ["113,91","road"], ["114,91","road"], ["115,91","road"],
  ["116,91","road"], ["117,91","road"], ["49,92","road"], ["50,92","road"], ["51,92","road"], ["52,92","road"], ["53,92","road"], ["54,92","road"],
  ["55,92","road"], ["56,92","road"], ["57,92","road"], ["58,92","road"], ["59,92","road"], ["60,92","road"], ["61,92","road"], ["62,92","road"],
  ["63,92","road"], ["64,92","road"], ["65,92","road"], ["66,92","road"], ["67,92","road"], ["68,92","road"], ["69,92","road"], ["70,92","road"],
  ["71,92","road"], ["72,92","road"], ["73,92","road"], ["74,92","road"], ["75,92","road"], ["76,92","road"], ["77,92","road"], ["78,92","road"],
  ["79,92","road"], ["80,92","road"], ["81,92","road"], ["82,92","road"], ["83,92","road"], ["84,92","road"], ["85,92","road"], ["86,92","road"],
  ["87,92","road"], ["88,92","road"], ["89,92","road"], ["90,92","road"], ["91,92","road"], ["92,92","road"], ["93,92","road"], ["94,92","road"],
  ["95,92","road"], ["96,92","road"], ["97,92","road"], ["98,92","road"], ["99,92","road"], ["100,92","road"], ["101,92","road"], ["102,92","road"],
  ["103,92","road"], ["104,92","road"], ["105,92","road"], ["106,92","road"], ["107,92","road"], ["108,92","road"], ["109,92","road"], ["110,92","road"],
  ["111,92","road"], ["112,92","road"], ["113,92","road"], ["114,92","road"], ["115,92","road"], ["116,92","road"], ["117,92","road"], ["49,93","road"],
  ["50,93","road"], ["51,93","road"], ["52,93","road"], ["53,93","road"], ["54,93","road"], ["55,93","road"], ["56,93","road"], ["57,93","road"],
  ["58,93","road"], ["59,93","road"], ["60,93","road"], ["61,93","road"], ["62,93","road"], ["63,93","road"], ["64,93","road"], ["65,93","road"],
  ["66,93","road"], ["67,93","road"], ["68,93","road"], ["69,93","road"], ["70,93","road"], ["71,93","road"], ["72,93","road"], ["73,93","road"],
  ["74,93","road"], ["75,93","road"], ["76,93","road"], ["77,93","road"], ["78,93","road"], ["79,93","road"], ["80,93","road"], ["81,93","road"],
  ["82,93","road"], ["83,93","road"], ["84,93","road"], ["85,93","road"], ["86,93","road"], ["87,93","road"], ["88,93","road"], ["89,93","road"],
  ["90,93","road"], ["91,93","road"], ["92,93","road"], ["93,93","road"], ["94,93","road"], ["95,93","road"], ["96,93","road"], ["97,93","road"],
  ["98,93","road"], ["99,93","road"], ["100,93","road"], ["101,93","road"], ["102,93","road"], ["103,93","road"], ["104,93","road"], ["105,93","road"],
  ["106,93","road"], ["107,93","road"], ["108,93","road"], ["109,93","road"], ["110,93","road"], ["111,93","road"], ["112,93","road"], ["113,93","road"],
  ["114,93","road"], ["115,93","road"], ["116,93","road"], ["117,93","road"], ["49,94","road"], ["50,94","road"], ["51,94","road"], ["52,94","road"],
  ["53,94","road"], ["54,94","road"], ["55,94","road"], ["56,94","road"], ["57,94","road"], ["58,94","road"], ["59,94","road"], ["60,94","road"],
  ["61,94","road"], ["62,94","road"], ["63,94","road"], ["64,94","road"], ["65,94","road"], ["66,94","road"], ["67,94","road"], ["68,94","road"],
  ["69,94","road"], ["70,94","road"], ["71,94","road"], ["72,94","road"], ["73,94","road"], ["74,94","road"], ["75,94","road"], ["76,94","road"],
  ["77,94","road"], ["78,94","road"], ["79,94","road"], ["80,94","road"], ["81,94","road"], ["82,94","road"], ["83,94","road"], ["84,94","road"],
  ["85,94","road"], ["86,94","road"], ["87,94","road"], ["88,94","road"], ["89,94","road"], ["90,94","road"], ["91,94","road"], ["92,94","road"],
  ["93,94","road"], ["94,94","road"], ["95,94","road"], ["96,94","road"], ["97,94","road"], ["98,94","road"], ["99,94","road"], ["100,94","road"],
  ["101,94","road"], ["102,94","road"], ["103,94","road"], ["104,94","road"], ["105,94","road"], ["106,94","road"], ["107,94","road"], ["108,94","road"],
  ["109,94","road"], ["110,94","road"], ["111,94","road"], ["112,94","road"], ["113,94","road"], ["114,94","road"], ["115,94","road"], ["116,94","road"],
  ["117,94","road"], ["49,95","road"], ["50,95","road"], ["51,95","road"], ["52,95","road"], ["53,95","road"], ["54,95","road"], ["55,95","road"],
  ["56,95","road"], ["57,95","road"], ["58,95","road"], ["59,95","road"], ["60,95","road"], ["61,95","road"], ["62,95","road"], ["63,95","road"],
  ["64,95","road"], ["65,95","road"], ["66,95","road"], ["67,95","road"], ["68,95","road"], ["69,95","road"], ["70,95","road"], ["71,95","road"],
  ["72,95","road"], ["73,95","road"], ["74,95","road"], ["75,95","road"], ["76,95","road"], ["77,95","road"], ["78,95","road"], ["79,95","road"],
  ["80,95","road"], ["81,95","road"], ["82,95","road"], ["83,95","road"], ["84,95","road"], ["85,95","road"], ["86,95","road"], ["87,95","road"],
  ["88,95","road"], ["89,95","road"], ["90,95","road"], ["91,95","road"], ["92,95","road"], ["93,95","road"], ["94,95","road"], ["95,95","road"],
  ["96,95","road"], ["97,95","road"], ["98,95","road"], ["99,95","road"], ["100,95","road"], ["101,95","road"], ["102,95","road"], ["103,95","road"],
  ["104,95","road"], ["105,95","road"], ["106,95","road"], ["107,95","road"], ["108,95","road"], ["109,95","road"], ["110,95","road"], ["111,95","road"],
  ["112,95","road"], ["113,95","road"], ["114,95","road"], ["115,95","road"], ["116,95","road"], ["117,95","road"], ["49,96","road"], ["50,96","road"],
  ["51,96","road"], ["52,96","road"], ["53,96","road"], ["54,96","road"], ["55,96","road"], ["56,96","road"], ["57,96","road"], ["58,96","road"],
  ["59,96","road"], ["60,96","road"], ["61,96","road"], ["62,96","road"], ["63,96","road"], ["64,96","road"], ["65,96","road"], ["66,96","road"],
  ["67,96","road"], ["68,96","road"], ["69,96","road"], ["70,96","road"], ["71,96","road"], ["72,96","road"], ["73,96","road"], ["74,96","road"],
  ["75,96","road"], ["76,96","road"], ["77,96","road"], ["78,96","road"], ["79,96","road"], ["80,96","road"], ["81,96","road"], ["82,96","road"],
  ["83,96","road"], ["84,96","road"], ["85,96","road"], ["86,96","road"], ["87,96","road"], ["88,96","road"], ["89,96","road"], ["90,96","road"],
  ["91,96","road"], ["92,96","road"], ["93,96","road"], ["94,96","road"], ["95,96","road"], ["96,96","road"], ["97,96","road"], ["98,96","road"],
  ["99,96","road"], ["100,96","road"], ["101,96","road"], ["102,96","road"], ["103,96","road"], ["104,96","road"], ["105,96","road"], ["106,96","road"],
  ["107,96","road"], ["108,96","road"], ["109,96","road"], ["110,96","road"], ["111,96","road"], ["112,96","road"], ["113,96","road"], ["114,96","road"],
  ["115,96","road"], ["116,96","road"], ["117,96","road"], ["49,97","road"], ["50,97","road"], ["51,97","road"], ["52,97","road"], ["53,97","road"],
  ["54,97","road"], ["55,97","road"], ["56,97","road"], ["57,97","road"], ["58,97","road"], ["59,97","road"], ["60,97","road"], ["61,97","road"],
  ["62,97","road"], ["63,97","road"], ["64,97","road"], ["65,97","road"], ["66,97","road"], ["67,97","road"], ["68,97","road"], ["69,97","road"],
  ["70,97","road"], ["71,97","road"], ["72,97","road"], ["73,97","road"], ["74,97","road"], ["75,97","road"], ["76,97","road"], ["77,97","road"],
  ["78,97","road"], ["79,97","road"], ["80,97","road"], ["81,97","road"], ["82,97","road"], ["83,97","road"], ["84,97","road"], ["85,97","road"],
  ["86,97","road"], ["87,97","road"], ["88,97","road"], ["89,97","road"], ["90,97","road"], ["91,97","road"], ["92,97","road"], ["93,97","road"],
  ["94,97","road"], ["95,97","road"], ["96,97","road"], ["97,97","road"], ["98,97","road"], ["99,97","road"], ["100,97","road"], ["101,97","road"],
  ["102,97","road"], ["103,97","road"], ["104,97","road"], ["105,97","road"], ["106,97","road"], ["107,97","road"], ["108,97","road"], ["109,97","road"],
  ["110,97","road"], ["111,97","road"], ["112,97","road"], ["113,97","road"], ["114,97","road"], ["115,97","road"], ["116,97","road"], ["117,97","road"],
  ["49,98","road"], ["50,98","road"], ["51,98","road"], ["52,98","road"], ["53,98","road"], ["54,98","road"], ["55,98","road"], ["56,98","road"],
  ["57,98","road"], ["58,98","road"], ["59,98","road"], ["60,98","road"], ["61,98","road"], ["62,98","road"], ["63,98","road"], ["64,98","road"],
  ["65,98","road"], ["66,98","road"], ["67,98","road"], ["68,98","road"], ["69,98","road"], ["70,98","road"], ["71,98","road"], ["72,98","road"],
  ["73,98","road"], ["74,98","road"], ["75,98","road"], ["76,98","road"], ["77,98","road"], ["78,98","road"], ["79,98","road"], ["80,98","road"],
  ["81,98","road"], ["82,98","road"], ["83,98","road"], ["84,98","road"], ["85,98","road"], ["86,98","road"], ["87,98","road"], ["88,98","road"],
  ["89,98","road"], ["90,98","road"], ["91,98","road"], ["92,98","road"], ["93,98","road"], ["94,98","road"], ["95,98","road"], ["96,98","road"],
  ["97,98","road"], ["98,98","road"], ["99,98","road"], ["100,98","road"], ["101,98","road"], ["102,98","road"], ["103,98","road"], ["104,98","road"],
  ["105,98","road"], ["106,98","road"], ["107,98","road"], ["108,98","road"], ["109,98","road"], ["110,98","road"], ["111,98","road"], ["112,98","road"],
  ["113,98","road"], ["114,98","road"], ["115,98","road"], ["116,98","road"], ["117,98","road"], ["49,99","road"], ["50,99","road"], ["51,99","road"],
  ["52,99","road"], ["53,99","road"], ["54,99","road"], ["55,99","road"], ["56,99","road"], ["57,99","road"], ["58,99","road"], ["59,99","road"],
  ["60,99","road"], ["61,99","road"], ["62,99","road"], ["63,99","road"], ["64,99","road"], ["65,99","road"], ["66,99","road"], ["67,99","road"],
  ["68,99","road"], ["69,99","road"], ["70,99","road"], ["71,99","road"], ["72,99","road"], ["73,99","road"], ["74,99","road"], ["75,99","road"],
  ["76,99","road"], ["77,99","road"], ["78,99","road"], ["79,99","road"], ["80,99","road"], ["81,99","road"], ["82,99","road"], ["83,99","road"],
  ["84,99","road"], ["85,99","road"], ["86,99","road"], ["87,99","road"], ["88,99","road"], ["89,99","road"], ["90,99","road"], ["91,99","road"],
  ["92,99","road"], ["93,99","road"], ["94,99","road"], ["95,99","road"], ["96,99","road"], ["97,99","road"], ["98,99","road"], ["99,99","road"],
  ["100,99","road"], ["101,99","road"], ["102,99","road"], ["103,99","road"], ["104,99","road"], ["105,99","road"], ["106,99","road"], ["107,99","road"],
  ["108,99","road"], ["109,99","road"], ["110,99","road"], ["111,99","road"], ["112,99","road"], ["113,99","road"], ["114,99","road"], ["115,99","road"],
  ["116,99","road"], ["117,99","road"], ["49,100","road"], ["50,100","road"], ["51,100","road"], ["52,100","road"], ["53,100","road"], ["54,100","road"],
  ["55,100","road"], ["56,100","road"], ["57,100","road"], ["58,100","road"], ["59,100","road"], ["60,100","road"], ["61,100","road"], ["62,100","road"],
  ["63,100","road"], ["64,100","road"], ["65,100","road"], ["66,100","road"], ["67,100","road"], ["68,100","road"], ["69,100","road"], ["70,100","road"],
  ["71,100","road"], ["72,100","road"], ["73,100","road"], ["74,100","road"], ["75,100","road"], ["76,100","road"], ["77,100","road"], ["78,100","road"],
  ["79,100","road"], ["80,100","road"], ["81,100","road"], ["82,100","road"], ["83,100","road"], ["84,100","road"], ["85,100","road"], ["86,100","road"],
  ["87,100","road"], ["88,100","road"], ["89,100","road"], ["90,100","road"], ["91,100","road"], ["92,100","road"], ["93,100","road"], ["94,100","road"],
  ["95,100","road"], ["96,100","road"], ["97,100","road"], ["98,100","road"], ["99,100","road"], ["100,100","road"], ["101,100","road"], ["102,100","road"],
  ["103,100","road"], ["104,100","road"], ["105,100","road"], ["106,100","road"], ["107,100","road"], ["108,100","road"], ["109,100","road"], ["110,100","road"],
  ["111,100","road"], ["112,100","road"], ["113,100","road"], ["114,100","road"], ["115,100","road"], ["116,100","road"], ["117,100","road"], ["49,101","road"],
  ["50,101","road"], ["51,101","road"], ["52,101","road"], ["53,101","road"], ["54,101","road"], ["55,101","road"], ["56,101","road"], ["57,101","road"],
  ["58,101","road"], ["59,101","road"], ["60,101","road"], ["61,101","road"], ["62,101","road"], ["63,101","road"], ["64,101","road"], ["65,101","road"],
  ["66,101","road"], ["67,101","road"], ["68,101","road"], ["69,101","road"], ["70,101","road"], ["71,101","road"], ["72,101","road"], ["73,101","road"],
  ["74,101","road"], ["75,101","road"], ["76,101","road"], ["77,101","road"], ["78,101","road"], ["79,101","road"], ["80,101","road"], ["81,101","road"],
  ["82,101","road"], ["83,101","road"], ["84,101","road"], ["85,101","road"], ["86,101","road"], ["87,101","road"], ["88,101","road"], ["89,101","road"],
  ["90,101","road"], ["91,101","road"], ["92,101","road"], ["93,101","road"], ["94,101","road"], ["95,101","road"], ["96,101","road"], ["97,101","road"],
  ["98,101","road"], ["99,101","road"], ["100,101","road"], ["101,101","road"], ["102,101","road"], ["103,101","road"], ["104,101","road"], ["105,101","road"],
  ["106,101","road"], ["107,101","road"], ["108,101","road"], ["109,101","road"], ["110,101","road"], ["111,101","road"], ["112,101","road"], ["113,101","road"],
  ["114,101","road"], ["115,101","road"], ["116,101","road"], ["117,101","road"], ["49,102","road"], ["50,102","road"], ["51,102","road"], ["52,102","road"],
  ["53,102","road"], ["54,102","road"], ["55,102","road"], ["56,102","road"], ["57,102","road"], ["58,102","road"], ["59,102","road"], ["60,102","road"],
  ["61,102","road"], ["62,102","road"], ["63,102","road"], ["64,102","road"], ["65,102","road"], ["66,102","road"], ["67,102","road"], ["68,102","road"],
  ["69,102","road"], ["70,102","road"], ["71,102","road"], ["72,102","road"], ["73,102","road"], ["74,102","road"], ["75,102","road"], ["76,102","road"],
  ["77,102","road"], ["78,102","road"], ["79,102","road"], ["80,102","road"], ["81,102","road"], ["82,102","road"], ["83,102","road"], ["84,102","road"],
  ["85,102","road"], ["86,102","road"], ["87,102","road"], ["88,102","road"], ["89,102","road"], ["90,102","road"], ["91,102","road"], ["92,102","road"],
  ["93,102","road"], ["94,102","road"], ["95,102","road"], ["96,102","road"], ["97,102","road"], ["98,102","road"], ["99,102","road"], ["100,102","road"],
  ["101,102","road"], ["102,102","road"], ["103,102","road"], ["104,102","road"], ["105,102","road"], ["106,102","road"], ["107,102","road"], ["108,102","road"],
  ["109,102","road"], ["110,102","road"], ["111,102","road"], ["112,102","road"], ["113,102","road"], ["114,102","road"], ["115,102","road"], ["116,102","road"],
  ["117,102","road"], ["49,103","road"], ["50,103","road"], ["51,103","road"], ["52,103","road"], ["53,103","road"], ["54,103","road"], ["55,103","road"],
  ["56,103","road"], ["57,103","road"], ["58,103","road"], ["59,103","road"], ["60,103","road"], ["61,103","road"], ["62,103","road"], ["63,103","road"],
  ["64,103","road"], ["65,103","road"], ["66,103","road"], ["67,103","road"], ["68,103","road"], ["69,103","road"], ["70,103","road"], ["71,103","road"],
  ["72,103","road"], ["73,103","road"], ["74,103","road"], ["75,103","road"], ["76,103","road"], ["77,103","road"], ["78,103","road"], ["79,103","road"],
  ["80,103","road"], ["81,103","road"], ["82,103","road"], ["83,103","road"], ["84,103","road"], ["85,103","road"], ["86,103","road"], ["87,103","road"],
  ["88,103","road"], ["89,103","road"], ["90,103","road"], ["91,103","road"], ["92,103","road"], ["93,103","road"], ["94,103","road"], ["95,103","road"],
  ["96,103","road"], ["97,103","road"], ["98,103","road"], ["99,103","road"], ["100,103","road"], ["101,103","road"], ["102,103","road"], ["103,103","road"],
  ["104,103","road"], ["105,103","road"], ["106,103","road"], ["107,103","road"], ["108,103","road"], ["109,103","road"], ["110,103","road"], ["111,103","road"],
  ["112,103","road"], ["113,103","road"], ["114,103","road"], ["115,103","road"], ["116,103","road"], ["117,103","road"], ["34,22","road"], ["35,22","road"],
  ["36,22","road"], ["37,22","road"], ["38,22","road"], ["39,22","road"], ["40,22","road"], ["41,22","road"], ["42,22","road"], ["43,22","road"],
  ["44,22","road"], ["45,22","road"], ["46,22","road"], ["47,22","road"], ["48,22","road"], ["34,23","road"], ["35,23","road"], ["36,23","road"],
  ["37,23","road"], ["38,23","road"], ["39,23","road"], ["40,23","road"], ["41,23","road"], ["42,23","road"], ["43,23","road"], ["44,23","road"],
  ["45,23","road"], ["46,23","road"], ["47,23","road"], ["48,23","road"], ["34,24","road"], ["35,24","road"], ["36,24","road"], ["37,24","road"],
  ["38,24","road"], ["39,24","road"], ["40,24","road"], ["41,24","road"], ["42,24","road"], ["43,24","road"], ["44,24","road"], ["45,24","road"],
  ["46,24","road"], ["47,24","road"], ["48,24","road"], ["34,25","road"], ["35,25","road"], ["36,25","road"], ["37,25","road"], ["38,25","road"],
  ["39,25","road"], ["40,25","road"], ["41,25","road"], ["42,25","road"], ["43,25","road"], ["44,25","road"], ["45,25","road"], ["46,25","road"],
  ["47,25","road"], ["48,25","road"], ["34,26","road"], ["35,26","road"], ["36,26","road"], ["37,26","road"], ["38,26","road"], ["39,26","road"],
  ["40,26","road"], ["41,26","road"], ["42,26","road"], ["43,26","road"], ["44,26","road"], ["45,26","road"], ["46,26","road"], ["47,26","road"],
  ["48,26","road"], ["34,27","road"], ["35,27","road"], ["36,27","road"], ["37,27","road"], ["38,27","road"], ["39,27","road"], ["40,27","road"],
  ["41,27","road"], ["42,27","road"], ["43,27","road"], ["44,27","road"], ["45,27","road"], ["46,27","road"], ["47,27","road"], ["48,27","road"],
  ["34,28","road"], ["35,28","road"], ["36,28","road"], ["37,28","road"], ["38,28","road"], ["39,28","road"], ["40,28","road"], ["41,28","road"],
  ["42,28","road"], ["43,28","road"], ["44,28","road"], ["45,28","road"], ["46,28","road"], ["47,28","road"], ["48,28","road"], ["34,29","road"],
  ["35,29","road"], ["36,29","road"], ["37,29","road"], ["38,29","road"], ["39,29","road"], ["40,29","road"], ["41,29","road"], ["42,29","road"],
  ["43,29","road"], ["44,29","road"], ["45,29","road"], ["46,29","road"], ["47,29","road"], ["48,29","road"], ["34,30","road"], ["35,30","road"],
  ["36,30","road"], ["37,30","road"], ["38,30","road"], ["39,30","road"], ["40,30","road"], ["41,30","road"], ["42,30","road"], ["43,30","road"],
  ["44,30","road"], ["45,30","road"], ["46,30","road"], ["47,30","road"], ["48,30","road"], ["34,31","road"], ["35,31","road"], ["36,31","road"],
  ["37,31","road"], ["38,31","road"], ["39,31","road"], ["40,31","road"], ["41,31","road"], ["42,31","road"], ["43,31","road"], ["44,31","road"],
  ["45,31","road"], ["46,31","road"], ["47,31","road"], ["48,31","road"], ["34,32","road"], ["35,32","road"], ["36,32","road"], ["37,32","road"],
  ["38,32","road"], ["39,32","road"], ["40,32","road"], ["41,32","road"], ["42,32","road"], ["43,32","road"], ["44,32","road"], ["45,32","road"],
  ["46,32","road"], ["47,32","road"], ["48,32","road"], ["34,33","road"], ["35,33","road"], ["36,33","road"], ["37,33","road"], ["38,33","road"],
  ["39,33","road"], ["40,33","road"], ["41,33","road"], ["42,33","road"], ["43,33","road"], ["44,33","road"], ["45,33","road"], ["46,33","road"],
  ["47,33","road"], ["48,33","road"], ["34,34","road"], ["35,34","road"], ["36,34","road"], ["37,34","road"], ["38,34","road"], ["39,34","road"],
  ["40,34","road"], ["41,34","road"], ["42,34","road"], ["43,34","road"], ["44,34","road"], ["45,34","road"], ["46,34","road"], ["47,34","road"],
  ["48,34","road"], ["34,35","road"], ["35,35","road"], ["36,35","road"], ["37,35","road"], ["38,35","road"], ["39,35","road"], ["40,35","road"],
  ["41,35","road"], ["42,35","road"], ["43,35","road"], ["44,35","road"], ["45,35","road"], ["46,35","road"], ["47,35","road"], ["48,35","road"],
  ["34,36","road"], ["35,36","road"], ["36,36","road"], ["37,36","road"], ["38,36","road"], ["39,36","road"], ["40,36","road"], ["41,36","road"],
  ["42,36","road"], ["43,36","road"], ["44,36","road"], ["45,36","road"], ["46,36","road"], ["47,36","road"], ["48,36","road"], ["34,37","road"],
  ["35,37","road"], ["36,37","road"], ["37,37","road"], ["38,37","road"], ["39,37","road"], ["40,37","road"], ["41,37","road"], ["42,37","road"],
  ["43,37","road"], ["44,37","road"], ["45,37","road"], ["46,37","road"], ["47,37","road"], ["48,37","road"], ["34,38","road"], ["35,38","road"],
  ["36,38","road"], ["37,38","road"], ["38,38","road"], ["39,38","road"], ["40,38","road"], ["41,38","road"], ["42,38","road"], ["43,38","road"],
  ["44,38","road"], ["45,38","road"], ["46,38","road"], ["47,38","road"], ["48,38","road"], ["34,39","road"], ["35,39","road"], ["36,39","road"],
  ["37,39","road"], ["38,39","road"], ["39,39","road"], ["40,39","road"], ["41,39","road"], ["42,39","road"], ["43,39","road"], ["44,39","road"],
  ["45,39","road"], ["46,39","road"], ["47,39","road"], ["48,39","road"], ["34,40","road"], ["35,40","road"], ["36,40","road"], ["37,40","road"],
  ["38,40","road"], ["39,40","road"], ["40,40","road"], ["41,40","road"], ["42,40","road"], ["43,40","road"], ["44,40","road"], ["45,40","road"],
  ["46,40","road"], ["47,40","road"], ["48,40","road"], ["34,41","road"], ["35,41","road"], ["36,41","road"], ["37,41","road"], ["38,41","road"],
  ["39,41","road"], ["40,41","road"], ["41,41","road"], ["42,41","road"], ["43,41","road"], ["44,41","road"], ["45,41","road"], ["46,41","road"],
  ["47,41","road"], ["48,41","road"], ["34,42","road"], ["35,42","road"], ["36,42","road"], ["37,42","road"], ["38,42","road"], ["39,42","road"],
  ["40,42","road"], ["41,42","road"], ["42,42","road"], ["43,42","road"], ["44,42","road"], ["45,42","road"], ["46,42","road"], ["47,42","road"],
  ["48,42","road"], ["34,43","road"], ["35,43","road"], ["36,43","road"], ["37,43","road"], ["38,43","road"], ["39,43","road"], ["40,43","road"],
  ["41,43","road"], ["42,43","road"], ["43,43","road"], ["44,43","road"], ["45,43","road"], ["46,43","road"], ["47,43","road"], ["48,43","road"],
  ["34,44","road"], ["35,44","road"], ["36,44","road"], ["37,44","road"], ["38,44","road"], ["39,44","road"], ["40,44","road"], ["41,44","road"],
  ["42,44","road"], ["43,44","road"], ["44,44","road"], ["45,44","road"], ["46,44","road"], ["47,44","road"], ["48,44","road"], ["34,45","road"],
  ["35,45","road"], ["36,45","road"], ["37,45","road"], ["38,45","road"], ["39,45","road"], ["40,45","road"], ["41,45","road"], ["42,45","road"],
  ["43,45","road"], ["44,45","road"], ["45,45","road"], ["46,45","road"], ["47,45","road"], ["48,45","road"], ["34,46","road"], ["35,46","road"],
  ["36,46","road"], ["37,46","road"], ["38,46","road"], ["39,46","road"], ["40,46","road"], ["41,46","road"], ["42,46","road"], ["43,46","road"],
  ["44,46","road"], ["45,46","road"], ["46,46","road"], ["47,46","road"], ["48,46","road"], ["34,47","road"], ["35,47","road"], ["36,47","road"],
  ["37,47","road"], ["38,47","road"], ["39,47","road"], ["40,47","road"], ["41,47","road"], ["42,47","road"], ["43,47","road"], ["44,47","road"],
  ["45,47","road"], ["46,47","road"], ["47,47","road"], ["48,47","road"], ["34,48","road"], ["35,48","road"], ["36,48","road"], ["37,48","road"],
  ["38,48","road"], ["39,48","road"], ["40,48","road"], ["41,48","road"], ["42,48","road"], ["43,48","road"], ["44,48","road"], ["45,48","road"],
  ["46,48","road"], ["47,48","road"], ["48,48","road"], ["34,49","road"], ["35,49","road"], ["36,49","road"], ["37,49","road"], ["38,49","road"],
  ["39,49","road"], ["40,49","road"], ["41,49","road"], ["42,49","road"], ["43,49","road"], ["44,49","road"], ["45,49","road"], ["46,49","road"],
  ["47,49","road"], ["48,49","road"], ["34,50","road"], ["35,50","road"], ["36,50","road"], ["37,50","road"], ["38,50","road"], ["39,50","road"],
  ["40,50","road"], ["41,50","road"], ["42,50","road"], ["43,50","road"], ["44,50","road"], ["45,50","road"], ["46,50","road"], ["47,50","road"],
  ["48,50","road"], ["34,51","road"], ["35,51","road"], ["36,51","road"], ["37,51","road"], ["38,51","road"], ["39,51","road"], ["40,51","road"],
  ["41,51","road"], ["42,51","road"], ["43,51","road"], ["44,51","road"], ["45,51","road"], ["46,51","road"], ["47,51","road"], ["48,51","road"],
  ["34,52","road"], ["35,52","road"], ["36,52","road"], ["37,52","road"], ["38,52","road"], ["39,52","road"], ["40,52","road"], ["41,52","road"],
  ["42,52","road"], ["43,52","road"], ["44,52","road"], ["45,52","road"], ["46,52","road"], ["47,52","road"], ["48,52","road"], ["34,53","road"],
  ["35,53","road"], ["36,53","road"], ["37,53","road"], ["38,53","road"], ["39,53","road"], ["40,53","road"], ["41,53","road"], ["42,53","road"],
  ["43,53","road"], ["44,53","road"], ["45,53","road"], ["46,53","road"], ["47,53","road"], ["48,53","road"], ["34,54","road"], ["35,54","road"],
  ["36,54","road"], ["37,54","road"], ["38,54","road"], ["39,54","road"], ["40,54","road"], ["41,54","road"], ["42,54","road"], ["43,54","road"],
  ["44,54","road"], ["45,54","road"], ["46,54","road"], ["47,54","road"], ["48,54","road"], ["34,55","road"], ["35,55","road"], ["36,55","road"],
  ["37,55","road"], ["38,55","road"], ["39,55","road"], ["40,55","road"], ["41,55","road"], ["42,55","road"], ["43,55","road"], ["44,55","road"],
  ["45,55","road"], ["46,55","road"], ["47,55","road"], ["48,55","road"], ["34,56","road"], ["35,56","road"], ["36,56","road"], ["37,56","road"],
  ["38,56","road"], ["39,56","road"], ["40,56","road"], ["41,56","road"], ["42,56","road"], ["43,56","road"], ["44,56","road"], ["45,56","road"],
  ["46,56","road"], ["47,56","road"], ["48,56","road"], ["34,57","road"], ["35,57","road"], ["36,57","road"], ["37,57","road"], ["38,57","road"],
  ["39,57","road"], ["40,57","road"], ["41,57","road"], ["42,57","road"], ["43,57","road"], ["44,57","road"], ["45,57","road"], ["46,57","road"],
  ["47,57","road"], ["48,57","road"], ["34,58","road"], ["35,58","road"], ["36,58","road"], ["37,58","road"], ["38,58","road"], ["39,58","road"],
  ["40,58","road"], ["41,58","road"], ["42,58","road"], ["43,58","road"], ["44,58","road"], ["45,58","road"], ["46,58","road"], ["47,58","road"],
  ["48,58","road"], ["34,59","road"], ["35,59","road"], ["36,59","road"], ["37,59","road"], ["38,59","road"], ["39,59","road"], ["40,59","road"],
  ["41,59","road"], ["42,59","road"], ["43,59","road"], ["44,59","road"], ["45,59","road"], ["46,59","road"], ["47,59","road"], ["48,59","road"],
  ["34,60","road"], ["35,60","road"], ["36,60","road"], ["37,60","road"], ["38,60","road"], ["39,60","road"], ["40,60","road"], ["41,60","road"],
  ["42,60","road"], ["43,60","road"], ["44,60","road"], ["45,60","road"], ["46,60","road"], ["47,60","road"], ["48,60","road"], ["34,61","road"],
  ["35,61","road"], ["36,61","road"], ["37,61","road"], ["38,61","road"], ["39,61","road"], ["40,61","road"], ["41,61","road"], ["42,61","road"],
  ["43,61","road"], ["44,61","road"], ["45,61","road"], ["46,61","road"], ["47,61","road"], ["48,61","road"], ["34,62","road"], ["35,62","road"],
  ["36,62","road"], ["37,62","road"], ["38,62","road"], ["39,62","road"], ["40,62","road"], ["41,62","road"], ["42,62","road"], ["43,62","road"],
  ["44,62","road"], ["45,62","road"], ["46,62","road"], ["47,62","road"], ["48,62","road"], ["34,63","road"], ["35,63","road"], ["36,63","road"],
  ["37,63","road"], ["38,63","road"], ["39,63","road"], ["40,63","road"], ["41,63","road"], ["42,63","road"], ["43,63","road"], ["44,63","road"],
  ["45,63","road"], ["46,63","road"], ["47,63","road"], ["48,63","road"], ["34,64","road"], ["35,64","road"], ["36,64","road"], ["37,64","road"],
  ["38,64","road"], ["39,64","road"], ["40,64","road"], ["41,64","road"], ["42,64","road"], ["43,64","road"], ["44,64","road"], ["45,64","road"],
  ["46,64","road"], ["47,64","road"], ["48,64","road"], ["34,65","road"], ["35,65","road"], ["36,65","road"], ["37,65","road"], ["38,65","road"],
  ["39,65","road"], ["40,65","road"], ["41,65","road"], ["42,65","road"], ["43,65","road"], ["44,65","road"], ["45,65","road"], ["46,65","road"],
  ["47,65","road"], ["48,65","road"], ["34,66","road"], ["35,66","road"], ["36,66","road"], ["37,66","road"], ["38,66","road"], ["39,66","road"],
  ["40,66","road"], ["41,66","road"], ["42,66","road"], ["43,66","road"], ["44,66","road"], ["45,66","road"], ["46,66","road"], ["47,66","road"],
  ["48,66","road"], ["34,67","road"], ["35,67","road"], ["36,67","road"], ["37,67","road"], ["38,67","road"], ["39,67","road"], ["40,67","road"],
  ["41,67","road"], ["42,67","road"], ["43,67","road"], ["44,67","road"], ["45,67","road"], ["46,67","road"], ["47,67","road"], ["48,67","road"],
  ["34,68","road"], ["35,68","road"], ["36,68","road"], ["37,68","road"], ["38,68","road"], ["39,68","road"], ["40,68","road"], ["41,68","road"],
  ["42,68","road"], ["43,68","road"], ["44,68","road"], ["45,68","road"], ["46,68","road"], ["47,68","road"], ["48,68","road"], ["34,69","road"],
  ["35,69","road"], ["36,69","road"], ["37,69","road"], ["38,69","road"], ["39,69","road"], ["40,69","road"], ["41,69","road"], ["42,69","road"],
  ["43,69","road"], ["44,69","road"], ["45,69","road"], ["46,69","road"], ["47,69","road"], ["48,69","road"], ["34,70","road"], ["35,70","road"],
  ["36,70","road"], ["37,70","road"], ["38,70","road"], ["39,70","road"], ["40,70","road"], ["41,70","road"], ["42,70","road"], ["43,70","road"],
  ["44,70","road"], ["45,70","road"], ["46,70","road"], ["47,70","road"], ["48,70","road"], ["34,71","road"], ["35,71","road"], ["36,71","road"],
  ["37,71","road"], ["38,71","road"], ["39,71","road"], ["40,71","road"], ["41,71","road"], ["42,71","road"], ["43,71","road"], ["44,71","road"],
  ["45,71","road"], ["46,71","road"], ["47,71","road"], ["48,71","road"], ["34,72","road"], ["35,72","road"], ["36,72","road"], ["37,72","road"],
  ["38,72","road"], ["39,72","road"], ["40,72","road"], ["41,72","road"], ["42,72","road"], ["43,72","road"], ["44,72","road"], ["45,72","road"],
  ["46,72","road"], ["47,72","road"], ["48,72","road"], ["34,73","road"], ["35,73","road"], ["36,73","road"], ["37,73","road"], ["38,73","road"],
  ["39,73","road"], ["40,73","road"], ["41,73","road"], ["42,73","road"], ["43,73","road"], ["44,73","road"], ["45,73","road"], ["46,73","road"],
  ["47,73","road"], ["48,73","road"], ["34,74","road"], ["35,74","road"], ["36,74","road"], ["37,74","road"], ["38,74","road"], ["39,74","road"],
  ["40,74","road"], ["41,74","road"], ["42,74","road"], ["43,74","road"], ["44,74","road"], ["45,74","road"], ["46,74","road"], ["47,74","road"],
  ["48,74","road"], ["34,75","road"], ["35,75","road"], ["36,75","road"], ["37,75","road"], ["38,75","road"], ["39,75","road"], ["40,75","road"],
  ["41,75","road"], ["42,75","road"], ["43,75","road"], ["44,75","road"], ["45,75","road"], ["46,75","road"], ["47,75","road"], ["48,75","road"],
  ["34,76","road"], ["35,76","road"], ["36,76","road"], ["37,76","road"], ["38,76","road"], ["39,76","road"], ["40,76","road"], ["41,76","road"],
  ["42,76","road"], ["43,76","road"], ["44,76","road"], ["45,76","road"], ["46,76","road"], ["47,76","road"], ["48,76","road"], ["34,77","road"],
  ["35,77","road"], ["36,77","road"], ["37,77","road"], ["38,77","road"], ["39,77","road"], ["40,77","road"], ["41,77","road"], ["42,77","road"],
  ["43,77","road"], ["44,77","road"], ["45,77","road"], ["46,77","road"], ["47,77","road"], ["48,77","road"], ["34,78","road"], ["35,78","road"],
  ["36,78","road"], ["37,78","road"], ["38,78","road"], ["39,78","road"], ["40,78","road"], ["41,78","road"], ["42,78","road"], ["43,78","road"],
  ["44,78","road"], ["45,78","road"], ["46,78","road"], ["47,78","road"], ["48,78","road"], ["34,79","road"], ["35,79","road"], ["36,79","road"],
  ["37,79","road"], ["38,79","road"], ["39,79","road"], ["40,79","road"], ["41,79","road"], ["42,79","road"], ["43,79","road"], ["44,79","road"],
  ["45,79","road"], ["46,79","road"], ["47,79","road"], ["48,79","road"], ["34,80","road"], ["35,80","road"], ["36,80","road"], ["37,80","road"],
  ["38,80","road"], ["39,80","road"], ["40,80","road"], ["41,80","road"], ["42,80","road"], ["43,80","road"], ["44,80","road"], ["45,80","road"],
  ["46,80","road"], ["47,80","road"], ["48,80","road"], ["34,81","road"], ["35,81","road"], ["36,81","road"], ["37,81","road"], ["38,81","road"],
  ["39,81","road"], ["40,81","road"], ["41,81","road"], ["42,81","road"], ["43,81","road"], ["44,81","road"], ["45,81","road"], ["46,81","road"],
  ["47,81","road"], ["48,81","road"], ["34,82","road"], ["35,82","road"], ["36,82","road"], ["37,82","road"], ["38,82","road"], ["39,82","road"],
  ["40,82","road"], ["41,82","road"], ["42,82","road"], ["43,82","road"], ["44,82","road"], ["45,82","road"], ["46,82","road"], ["47,82","road"],
  ["48,82","road"], ["34,83","road"], ["35,83","road"], ["36,83","road"], ["37,83","road"], ["38,83","road"], ["39,83","road"], ["40,83","road"],
  ["41,83","road"], ["42,83","road"], ["43,83","road"], ["44,83","road"], ["45,83","road"], ["46,83","road"], ["47,83","road"], ["48,83","road"],
  ["34,84","road"], ["35,84","road"], ["36,84","road"], ["37,84","road"], ["38,84","road"], ["39,84","road"], ["40,84","road"], ["41,84","road"],
  ["42,84","road"], ["43,84","road"], ["44,84","road"], ["45,84","road"], ["46,84","road"], ["47,84","road"], ["48,84","road"], ["34,85","road"],
  ["35,85","road"], ["36,85","road"], ["37,85","road"], ["38,85","road"], ["39,85","road"], ["40,85","road"], ["41,85","road"], ["42,85","road"],
  ["43,85","road"], ["44,85","road"], ["45,85","road"], ["46,85","road"], ["47,85","road"], ["48,85","road"], ["34,86","road"], ["35,86","road"],
  ["36,86","road"], ["37,86","road"], ["38,86","road"], ["39,86","road"], ["40,86","road"], ["41,86","road"], ["42,86","road"], ["43,86","road"],
  ["44,86","road"], ["45,86","road"], ["46,86","road"], ["47,86","road"], ["48,86","road"], ["34,87","road"], ["35,87","road"], ["36,87","road"],
  ["37,87","road"], ["38,87","road"], ["39,87","road"], ["40,87","road"], ["41,87","road"], ["42,87","road"], ["43,87","road"], ["44,87","road"],
  ["45,87","road"], ["46,87","road"], ["47,87","road"], ["48,87","road"], ["34,88","road"], ["35,88","road"], ["36,88","road"], ["37,88","road"],
  ["38,88","road"], ["39,88","road"], ["40,88","road"], ["41,88","road"], ["42,88","road"], ["43,88","road"], ["44,88","road"], ["45,88","road"],
  ["46,88","road"], ["47,88","road"], ["48,88","road"], ["34,89","road"], ["35,89","road"], ["36,89","road"], ["37,89","road"], ["38,89","road"],
  ["39,89","road"], ["40,89","road"], ["41,89","road"], ["42,89","road"], ["43,89","road"], ["44,89","road"], ["45,89","road"], ["46,89","road"],
  ["47,89","road"], ["48,89","road"], ["34,90","road"], ["35,90","road"], ["36,90","road"], ["37,90","road"], ["38,90","road"], ["39,90","road"],
  ["40,90","road"], ["41,90","road"], ["42,90","road"], ["43,90","road"], ["44,90","road"], ["45,90","road"], ["46,90","road"], ["47,90","road"],
  ["48,90","road"], ["34,91","road"], ["35,91","road"], ["36,91","road"], ["37,91","road"], ["38,91","road"], ["39,91","road"], ["40,91","road"],
  ["41,91","road"], ["42,91","road"], ["43,91","road"], ["44,91","road"], ["45,91","road"], ["46,91","road"], ["47,91","road"], ["48,91","road"],
  ["34,92","road"], ["35,92","road"], ["36,92","road"], ["37,92","road"], ["38,92","road"], ["39,92","road"], ["40,92","road"], ["41,92","road"],
  ["42,92","road"], ["43,92","road"], ["44,92","road"], ["45,92","road"], ["46,92","road"], ["47,92","road"], ["48,92","road"], ["34,93","road"],
  ["35,93","road"], ["36,93","road"], ["37,93","road"], ["38,93","road"], ["39,93","road"], ["40,93","road"], ["41,93","road"], ["42,93","road"],
  ["43,93","road"], ["44,93","road"], ["45,93","road"], ["46,93","road"], ["47,93","road"], ["48,93","road"], ["34,94","road"], ["35,94","road"],
  ["36,94","road"], ["37,94","road"], ["38,94","road"], ["39,94","road"], ["40,94","road"], ["41,94","road"], ["42,94","road"], ["43,94","road"],
  ["44,94","road"], ["45,94","road"], ["46,94","road"], ["47,94","road"], ["48,94","road"], ["34,95","road"], ["35,95","road"], ["36,95","road"],
  ["37,95","road"], ["38,95","road"], ["39,95","road"], ["40,95","road"], ["41,95","road"], ["42,95","road"], ["43,95","road"], ["44,95","road"],
  ["45,95","road"], ["46,95","road"], ["47,95","road"], ["48,95","road"], ["34,96","road"], ["35,96","road"], ["36,96","road"], ["37,96","road"],
  ["38,96","road"], ["39,96","road"], ["40,96","road"], ["41,96","road"], ["42,96","road"], ["43,96","road"], ["44,96","road"], ["45,96","road"],
  ["46,96","road"], ["47,96","road"], ["48,96","road"], ["34,97","road"], ["35,97","road"], ["36,97","road"], ["37,97","road"], ["38,97","road"],
  ["39,97","road"], ["40,97","road"], ["41,97","road"], ["42,97","road"], ["43,97","road"], ["44,97","road"], ["45,97","road"], ["46,97","road"],
  ["47,97","road"], ["48,97","road"], ["34,98","road"], ["35,98","road"], ["36,98","road"], ["37,98","road"], ["38,98","road"], ["39,98","road"],
  ["40,98","road"], ["41,98","road"], ["42,98","road"], ["43,98","road"], ["44,98","road"], ["45,98","road"], ["46,98","road"], ["47,98","road"],
  ["48,98","road"], ["34,99","road"], ["35,99","road"], ["36,99","road"], ["37,99","road"], ["38,99","road"], ["39,99","road"], ["40,99","road"],
  ["41,99","road"], ["42,99","road"], ["43,99","road"], ["44,99","road"], ["45,99","road"], ["46,99","road"], ["47,99","road"], ["48,99","road"],
  ["34,100","road"], ["35,100","road"], ["36,100","road"], ["37,100","road"], ["38,100","road"], ["39,100","road"], ["40,100","road"], ["41,100","road"],
  ["42,100","road"], ["43,100","road"], ["44,100","road"], ["45,100","road"], ["46,100","road"], ["47,100","road"], ["48,100","road"], ["34,101","road"],
  ["35,101","road"], ["36,101","road"], ["37,101","road"], ["38,101","road"], ["39,101","road"], ["40,101","road"], ["41,101","road"], ["42,101","road"],
  ["43,101","road"], ["44,101","road"], ["45,101","road"], ["46,101","road"], ["47,101","road"], ["48,101","road"], ["34,102","road"], ["35,102","road"],
  ["36,102","road"], ["37,102","road"], ["38,102","road"], ["39,102","road"], ["40,102","road"], ["41,102","road"], ["42,102","road"], ["43,102","road"],
  ["44,102","road"], ["45,102","road"], ["46,102","road"], ["47,102","road"], ["48,102","road"], ["34,103","road"], ["35,103","road"], ["36,103","road"],
  ["37,103","road"], ["38,103","road"], ["39,103","road"], ["40,103","road"], ["41,103","road"], ["42,103","road"], ["43,103","road"], ["44,103","road"],
  ["45,103","road"], ["46,103","road"], ["47,103","road"], ["48,103","road"], ["175,126","road"], ["175,125","road"], ["176,125","road"], ["176,126","road"],
  ["176,124","road"], ["176,123","road"], ["177,123","road"], ["177,122","road"], ["177,125","road"], ["177,126","road"], ["177,124","road"], ["179,120","road"],
  ["180,121","road"], ["181,122","road"], ["182,123","road"], ["183,124","road"], ["184,125","road"], ["184,126","road"], ["183,125","road"], ["182,124","road"],
  ["181,124","road"], ["180,125","road"], ["179,125","road"], ["179,124","road"], ["178,125","road"], ["178,126","road"], ["178,123","road"], ["178,124","road"],
  ["178,122","road"], ["178,121","road"], ["178,120","road"], ["179,121","road"], ["179,122","road"], ["180,124","road"], ["180,123","road"], ["179,123","road"],
  ["180,122","road"], ["181,123","road"], ["179,126","road"]
];

// Hand-edited height deltas, exported the same way and already absolute.
const DEFAULT_HEIGHT_OVERRIDES = [
  ["169,133",-1], ["170,133",-1], ["169,134",-1], ["169,132",-1], ["168,131",-1], ["118,109",-1], ["117,110",-1], ["117,109",-1],
  ["64,133",-1], ["65,133",-1], ["64,134",-1], ["64,132",-1], ["63,131",-1], ["100,104",1], ["101,104",1], ["102,104",1],
  ["103,104",1], ["104,104",1], ["105,104",1], ["100,105",1], ["101,105",1], ["102,105",1], ["103,105",1], ["104,105",1],
  ["105,105",1], ["100,106",1], ["101,106",1], ["102,106",1], ["103,106",1], ["104,106",1], ["105,106",1], ["100,107",1],
  ["101,107",1], ["102,107",1], ["103,107",1], ["104,107",1], ["105,107",1], ["100,108",1], ["101,108",1], ["102,108",1],
  ["103,108",1], ["104,108",1], ["105,108",1], ["100,109",1], ["101,109",1], ["102,109",1], ["103,109",1], ["104,109",1],
  ["105,109",1], ["99,104",1], ["98,104",1], ["99,105",1], ["99,106",1], ["99,107",1], ["99,108",1], ["99,109",1],
  ["98,109",1], ["98,108",1], ["98,107",1], ["98,106",1], ["98,105",1], ["90,100",1], ["91,100",1], ["92,100",1],
  ["93,100",1], ["94,100",1], ["95,100",1], ["96,100",1], ["97,100",1], ["98,100",1], ["99,100",1], ["100,100",1],
  ["101,100",1], ["102,100",1], ["103,100",1], ["104,100",1], ["105,100",1], ["42,100",1], ["43,100",1], ["44,100",1],
  ["45,100",1], ["46,100",1], ["47,100",1], ["48,100",1], ["49,100",1], ["50,100",1], ["51,100",1], ["52,100",1],
  ["53,100",1], ["54,100",1], ["55,100",1], ["56,100",1], ["57,100",1], ["58,100",1], ["59,100",1], ["60,100",1],
  ["61,100",1], ["62,100",1], ["63,100",1], ["64,100",1], ["65,100",1], ["66,100",1], ["67,100",1], ["68,100",1],
  ["69,100",1], ["70,100",1], ["71,100",1], ["72,100",1], ["73,100",1], ["74,100",1], ["75,100",1], ["76,100",1],
  ["77,100",1], ["78,100",1], ["79,100",1], ["80,100",1], ["81,100",1], ["82,100",1], ["83,100",1], ["84,100",1],
  ["85,100",1], ["86,100",1], ["87,100",1], ["88,100",1], ["89,100",1], ["0,100",1], ["1,100",1], ["2,100",1],
  ["3,100",1], ["4,100",1], ["5,100",1], ["6,100",1], ["7,100",1], ["8,100",1], ["9,100",1], ["10,100",1],
  ["11,100",1], ["12,100",1], ["13,100",1], ["14,100",1], ["15,100",1], ["16,100",1], ["17,100",1], ["18,100",1],
  ["19,100",1], ["20,100",1], ["21,100",1], ["22,100",1], ["23,100",1], ["24,100",1], ["25,100",1], ["26,100",1],
  ["27,100",1], ["28,100",1], ["29,100",1], ["30,100",1], ["31,100",1], ["32,100",1], ["33,100",1], ["34,100",1],
  ["35,100",1], ["36,100",1], ["37,100",1], ["38,100",1], ["39,100",1], ["40,100",1], ["41,100",1], ["71,104",1],
  ["72,104",1], ["73,104",1], ["74,104",1], ["75,104",1], ["76,104",1], ["77,104",1], ["78,104",1], ["79,104",1],
  ["80,104",1], ["81,104",1], ["82,104",1], ["83,104",1], ["84,104",1], ["85,104",1], ["86,104",1], ["87,104",1],
  ["88,104",1], ["89,104",1], ["90,104",1], ["91,104",1], ["92,104",1], ["93,104",1], ["94,104",1], ["95,104",1],
  ["96,104",1], ["97,104",1], ["71,105",1], ["72,105",1], ["73,105",1], ["74,105",1], ["75,105",1], ["76,105",1],
  ["77,105",1], ["78,105",1], ["79,105",1], ["80,105",1], ["81,105",1], ["82,105",1], ["83,105",1], ["84,105",1],
  ["85,105",1], ["86,105",1], ["87,105",1], ["88,105",1], ["89,105",1], ["90,105",1], ["91,105",1], ["92,105",1],
  ["93,105",1], ["94,105",1], ["95,105",1], ["96,105",1], ["97,105",1], ["71,106",1], ["72,106",1], ["73,106",1],
  ["74,106",1], ["75,106",1], ["76,106",1], ["77,106",1], ["78,106",1], ["79,106",1], ["80,106",1], ["81,106",1],
  ["82,106",1], ["83,106",1], ["84,106",1], ["85,106",1], ["86,106",1], ["87,106",1], ["88,106",1], ["89,106",1],
  ["90,106",1], ["91,106",1], ["92,106",1], ["93,106",1], ["94,106",1], ["95,106",1], ["96,106",1], ["97,106",1],
  ["71,107",1], ["72,107",1], ["73,107",1], ["74,107",1], ["75,107",1], ["76,107",1], ["77,107",1], ["78,107",1],
  ["79,107",1], ["80,107",1], ["81,107",1], ["82,107",1], ["83,107",1], ["84,107",1], ["85,107",1], ["86,107",1],
  ["87,107",1], ["88,107",1], ["89,107",1], ["90,107",1], ["91,107",1], ["92,107",1], ["93,107",1], ["94,107",1],
  ["95,107",1], ["96,107",1], ["97,107",1], ["71,108",1], ["72,108",1], ["73,108",1], ["74,108",1], ["75,108",1],
  ["76,108",1], ["77,108",1], ["78,108",1], ["79,108",1], ["80,108",1], ["81,108",1], ["82,108",1], ["83,108",1],
  ["84,108",1], ["85,108",1], ["86,108",1], ["87,108",1], ["88,108",1], ["89,108",1], ["90,108",1], ["91,108",1],
  ["92,108",1], ["93,108",1], ["94,108",1], ["95,108",1], ["96,108",1], ["97,108",1], ["71,109",1], ["72,109",1],
  ["73,109",1], ["74,109",1], ["75,109",1], ["76,109",1], ["77,109",1], ["78,109",1], ["79,109",1], ["80,109",1],
  ["81,109",1], ["82,109",1], ["83,109",1], ["84,109",1], ["85,109",1], ["86,109",1], ["87,109",1], ["88,109",1],
  ["89,109",1], ["90,109",1], ["91,109",1], ["92,109",1], ["93,109",1], ["94,109",1], ["95,109",1], ["96,109",1],
  ["97,109",1], ["35,104",1], ["36,104",1], ["37,104",1], ["38,104",1], ["39,104",1], ["40,104",1], ["41,104",1],
  ["42,104",1], ["43,104",1], ["44,104",1], ["45,104",1], ["46,104",1], ["47,104",1], ["48,104",1], ["49,104",1],
  ["50,104",1], ["51,104",1], ["52,104",1], ["53,104",1], ["54,104",1], ["55,104",1], ["56,104",1], ["57,104",1],
  ["58,104",1], ["59,104",1], ["60,104",1], ["61,104",1], ["62,104",1], ["63,104",1], ["64,104",1], ["65,104",1],
  ["66,104",1], ["67,104",1], ["68,104",1], ["69,104",1], ["70,104",1], ["35,105",1], ["36,105",1], ["37,105",1],
  ["38,105",1], ["39,105",1], ["40,105",1], ["41,105",1], ["42,105",1], ["43,105",1], ["44,105",1], ["45,105",1],
  ["46,105",1], ["47,105",1], ["48,105",1], ["49,105",1], ["50,105",1], ["51,105",1], ["52,105",1], ["53,105",1],
  ["54,105",1], ["55,105",1], ["56,105",1], ["57,105",1], ["58,105",1], ["59,105",1], ["60,105",1], ["61,105",1],
  ["62,105",1], ["63,105",1], ["64,105",1], ["65,105",1], ["66,105",1], ["67,105",1], ["68,105",1], ["69,105",1],
  ["70,105",1], ["35,106",1], ["36,106",1], ["37,106",1], ["38,106",1], ["39,106",1], ["40,106",1], ["41,106",1],
  ["42,106",1], ["43,106",1], ["44,106",1], ["45,106",1], ["46,106",1], ["47,106",1], ["48,106",1], ["49,106",1],
  ["50,106",1], ["51,106",1], ["52,106",1], ["53,106",1], ["54,106",1], ["55,106",1], ["56,106",1], ["57,106",1],
  ["58,106",1], ["59,106",1], ["60,106",1], ["61,106",1], ["62,106",1], ["63,106",1], ["64,106",1], ["65,106",1],
  ["66,106",1], ["67,106",1], ["68,106",1], ["69,106",1], ["70,106",1], ["35,107",1], ["36,107",1], ["37,107",1],
  ["38,107",1], ["39,107",1], ["40,107",1], ["41,107",1], ["42,107",1], ["43,107",1], ["44,107",1], ["45,107",1],
  ["46,107",1], ["47,107",1], ["48,107",1], ["49,107",1], ["50,107",1], ["51,107",1], ["52,107",1], ["53,107",1],
  ["54,107",1], ["55,107",1], ["56,107",1], ["57,107",1], ["58,107",1], ["59,107",1], ["60,107",1], ["61,107",1],
  ["62,107",1], ["63,107",1], ["64,107",1], ["65,107",1], ["66,107",1], ["67,107",1], ["68,107",1], ["69,107",1],
  ["70,107",1], ["35,108",1], ["36,108",1], ["37,108",1], ["38,108",1], ["39,108",1], ["40,108",1], ["41,108",1],
  ["42,108",1], ["43,108",1], ["44,108",1], ["45,108",1], ["46,108",1], ["47,108",1], ["48,108",1], ["49,108",1],
  ["50,108",1], ["51,108",1], ["52,108",1], ["53,108",1], ["54,108",1], ["55,108",1], ["56,108",1], ["57,108",1],
  ["58,108",1], ["59,108",1], ["60,108",1], ["61,108",1], ["62,108",1], ["63,108",1], ["64,108",1], ["65,108",1],
  ["66,108",1], ["67,108",1], ["68,108",1], ["69,108",1], ["70,108",1], ["35,109",1], ["36,109",1], ["37,109",1],
  ["38,109",1], ["39,109",1], ["40,109",1], ["41,109",1], ["42,109",1], ["43,109",1], ["44,109",1], ["45,109",1],
  ["46,109",1], ["47,109",1], ["48,109",1], ["49,109",1], ["50,109",1], ["51,109",1], ["52,109",1], ["53,109",1],
  ["54,109",1], ["55,109",1], ["56,109",1], ["57,109",1], ["58,109",1], ["59,109",1], ["60,109",1], ["61,109",1],
  ["62,109",1], ["63,109",1], ["64,109",1], ["65,109",1], ["66,109",1], ["67,109",1], ["68,109",1], ["69,109",1],
  ["70,109",1], ["0,104",1], ["1,104",1], ["2,104",1], ["3,104",1], ["4,104",1], ["5,104",1], ["6,104",1],
  ["7,104",1], ["8,104",1], ["9,104",1], ["10,104",1], ["11,104",1], ["12,104",1], ["13,104",1], ["14,104",1],
  ["15,104",1], ["16,104",1], ["17,104",1], ["18,104",1], ["19,104",1], ["20,104",1], ["21,104",1], ["22,104",1],
  ["23,104",1], ["24,104",1], ["25,104",1], ["26,104",1], ["27,104",1], ["28,104",1], ["29,104",1], ["30,104",1],
  ["31,104",1], ["32,104",1], ["33,104",1], ["34,104",1], ["0,105",1], ["1,105",1], ["2,105",1], ["3,105",1],
  ["4,105",1], ["5,105",1], ["6,105",1], ["7,105",1], ["8,105",1], ["9,105",1], ["10,105",1], ["11,105",1],
  ["12,105",1], ["13,105",1], ["14,105",1], ["15,105",1], ["16,105",1], ["17,105",1], ["18,105",1], ["19,105",1],
  ["20,105",1], ["21,105",1], ["22,105",1], ["23,105",1], ["24,105",1], ["25,105",1], ["26,105",1], ["27,105",1],
  ["28,105",1], ["29,105",1], ["30,105",1], ["31,105",1], ["32,105",1], ["33,105",1], ["34,105",1], ["0,106",1],
  ["1,106",1], ["2,106",1], ["3,106",1], ["4,106",1], ["5,106",1], ["6,106",1], ["7,106",1], ["8,106",1],
  ["9,106",1], ["10,106",1], ["11,106",1], ["12,106",1], ["13,106",1], ["14,106",1], ["15,106",1], ["16,106",1],
  ["17,106",1], ["18,106",1], ["19,106",1], ["20,106",1], ["21,106",1], ["22,106",1], ["23,106",1], ["24,106",1],
  ["25,106",1], ["26,106",1], ["27,106",1], ["28,106",1], ["29,106",1], ["30,106",1], ["31,106",1], ["32,106",1],
  ["33,106",1], ["34,106",1], ["0,107",1], ["1,107",1], ["2,107",1], ["3,107",1], ["4,107",1], ["5,107",1],
  ["6,107",1], ["7,107",1], ["8,107",1], ["9,107",1], ["10,107",1], ["11,107",1], ["12,107",1], ["13,107",1],
  ["14,107",1], ["15,107",1], ["16,107",1], ["17,107",1], ["18,107",1], ["19,107",1], ["20,107",1], ["21,107",1],
  ["22,107",1], ["23,107",1], ["24,107",1], ["25,107",1], ["26,107",1], ["27,107",1], ["28,107",1], ["29,107",1],
  ["30,107",1], ["31,107",1], ["32,107",1], ["33,107",1], ["34,107",1], ["0,108",1], ["1,108",1], ["2,108",1],
  ["3,108",1], ["4,108",1], ["5,108",1], ["6,108",1], ["7,108",1], ["8,108",1], ["9,108",1], ["10,108",1],
  ["11,108",1], ["12,108",1], ["13,108",1], ["14,108",1], ["15,108",1], ["16,108",1], ["17,108",1], ["18,108",1],
  ["19,108",1], ["20,108",1], ["21,108",1], ["22,108",1], ["23,108",1], ["24,108",1], ["25,108",1], ["26,108",1],
  ["27,108",1], ["28,108",1], ["29,108",1], ["30,108",1], ["31,108",1], ["32,108",1], ["33,108",1], ["34,108",1],
  ["0,109",1], ["1,109",1], ["2,109",1], ["3,109",1], ["4,109",1], ["5,109",1], ["6,109",1], ["7,109",1],
  ["8,109",1], ["9,109",1], ["10,109",1], ["11,109",1], ["12,109",1], ["13,109",1], ["14,109",1], ["15,109",1],
  ["16,109",1], ["17,109",1], ["18,109",1], ["19,109",1], ["20,109",1], ["21,109",1], ["22,109",1], ["23,109",1],
  ["24,109",1], ["25,109",1], ["26,109",1], ["27,109",1], ["28,109",1], ["29,109",1], ["30,109",1], ["31,109",1],
  ["32,109",1], ["33,109",1], ["34,109",1], ["0,116",1], ["1,116",1], ["2,116",1], ["3,116",1], ["4,116",1],
  ["5,116",1], ["6,116",1], ["7,116",1], ["8,116",1], ["9,116",1], ["10,116",1], ["11,116",1], ["12,116",1],
  ["13,116",1], ["14,116",1], ["15,116",1], ["16,116",1], ["17,116",1], ["18,116",1], ["19,116",1], ["20,116",1],
  ["21,116",1], ["22,116",1], ["23,116",1], ["24,116",1], ["25,116",1], ["26,116",1], ["27,116",1], ["28,116",1],
  ["45,116",1], ["46,116",1], ["47,116",1], ["48,116",1], ["49,116",1], ["50,116",1], ["51,116",1], ["52,116",1],
  ["53,116",1], ["54,116",1], ["55,116",1], ["56,116",1], ["57,116",1], ["58,116",1], ["59,116",1], ["60,116",1],
  ["61,116",1], ["62,116",1], ["63,116",1], ["64,116",1], ["65,116",1], ["29,116",1], ["30,116",1], ["31,116",1],
  ["32,116",1], ["33,116",1], ["34,116",1], ["35,116",1], ["36,116",1], ["37,116",1], ["38,116",1], ["39,116",1],
  ["40,116",1], ["41,116",1], ["42,116",1], ["43,116",1], ["44,116",1], ["0,111",1], ["1,111",1], ["2,111",1],
  ["3,111",1], ["4,111",1], ["5,111",1], ["6,111",1], ["7,111",1], ["8,111",1], ["9,111",1], ["10,111",1],
  ["11,111",1], ["12,111",1], ["13,111",1], ["14,111",1], ["15,111",1], ["16,111",1], ["17,111",1], ["18,111",1],
  ["19,111",1], ["20,111",1], ["21,111",1], ["22,111",1], ["23,111",1], ["24,111",1], ["25,111",1], ["26,111",1],
  ["27,111",1], ["28,111",1], ["29,111",1], ["30,111",1], ["31,111",1], ["32,111",1], ["33,111",1], ["34,111",1],
  ["35,111",1], ["36,111",1], ["37,111",1], ["38,111",1], ["39,111",1], ["40,111",1], ["41,111",1], ["42,111",1],
  ["43,111",1], ["44,111",1], ["45,111",1], ["46,111",1], ["47,111",1], ["48,111",1], ["49,111",1], ["50,111",1],
  ["51,111",1], ["52,111",1], ["53,111",1], ["54,111",1], ["55,111",1], ["56,111",1], ["57,111",1], ["58,111",1],
  ["59,111",1], ["60,111",1], ["61,111",1], ["62,111",1], ["63,111",1], ["64,111",1], ["65,111",1], ["66,111",1],
  ["67,111",1], ["68,111",1], ["69,111",1], ["70,111",1], ["71,111",1], ["72,111",1], ["73,111",1], ["74,111",1],
  ["75,111",1], ["76,111",1], ["77,111",1], ["78,111",1], ["79,111",1], ["80,111",1], ["81,111",1], ["82,111",1],
  ["83,111",1], ["84,111",1], ["85,111",1], ["86,111",1], ["87,111",1], ["88,111",1], ["89,111",1], ["90,111",1],
  ["91,111",1], ["92,111",1], ["93,111",1], ["94,111",1], ["95,111",1], ["96,111",1], ["97,111",1], ["98,111",1],
  ["99,111",1], ["100,111",1], ["101,111",1], ["102,111",1], ["103,111",1], ["104,111",1], ["0,112",1], ["1,112",1],
  ["2,112",1], ["3,112",1], ["4,112",1], ["5,112",1], ["6,112",1], ["7,112",1], ["8,112",1], ["9,112",1],
  ["10,112",1], ["11,112",1], ["12,112",1], ["13,112",1], ["14,112",1], ["15,112",1], ["16,112",1], ["17,112",1],
  ["18,112",1], ["19,112",1], ["20,112",1], ["21,112",1], ["22,112",1], ["23,112",1], ["24,112",1], ["25,112",1],
  ["26,112",1], ["27,112",1], ["28,112",1], ["29,112",1], ["30,112",1], ["31,112",1], ["32,112",1], ["33,112",1],
  ["34,112",1], ["35,112",1], ["36,112",1], ["37,112",1], ["38,112",1], ["39,112",1], ["40,112",1], ["41,112",1],
  ["42,112",1], ["43,112",1], ["44,112",1], ["45,112",1], ["46,112",1], ["47,112",1], ["48,112",1], ["49,112",1],
  ["50,112",1], ["51,112",1], ["52,112",1], ["53,112",1], ["54,112",1], ["55,112",1], ["56,112",1], ["57,112",1],
  ["58,112",1], ["59,112",1], ["60,112",1], ["61,112",1], ["62,112",1], ["63,112",1], ["64,112",1], ["65,112",1],
  ["66,112",1], ["67,112",1], ["68,112",1], ["69,112",1], ["70,112",1], ["71,112",1], ["72,112",1], ["73,112",1],
  ["74,112",1], ["75,112",1], ["76,112",1], ["77,112",1], ["78,112",1], ["79,112",1], ["80,112",1], ["81,112",1],
  ["82,112",1], ["83,112",1], ["84,112",1], ["85,112",1], ["86,112",1], ["87,112",1], ["88,112",1], ["89,112",1],
  ["90,112",1], ["91,112",1], ["92,112",1], ["93,112",1], ["94,112",1], ["95,112",1], ["96,112",1], ["97,112",1],
  ["98,112",1], ["99,112",1], ["100,112",1], ["101,112",1], ["102,112",1], ["103,112",1], ["104,112",1], ["0,113",1],
  ["1,113",1], ["2,113",1], ["3,113",1], ["4,113",1], ["5,113",1], ["6,113",1], ["7,113",1], ["8,113",1],
  ["9,113",1], ["10,113",1], ["11,113",1], ["12,113",1], ["13,113",1], ["14,113",1], ["15,113",1], ["16,113",1],
  ["17,113",1], ["18,113",1], ["19,113",1], ["20,113",1], ["21,113",1], ["22,113",1], ["23,113",1], ["24,113",1],
  ["25,113",1], ["26,113",1], ["27,113",1], ["28,113",1], ["29,113",1], ["30,113",1], ["31,113",1], ["32,113",1],
  ["33,113",1], ["34,113",1], ["35,113",1], ["36,113",1], ["37,113",1], ["38,113",1], ["39,113",1], ["40,113",1],
  ["41,113",1], ["42,113",1], ["43,113",1], ["44,113",1], ["45,113",1], ["46,113",1], ["47,113",1], ["48,113",1],
  ["49,113",1], ["50,113",1], ["51,113",1], ["52,113",1], ["53,113",1], ["54,113",1], ["55,113",1], ["56,113",1],
  ["57,113",1], ["58,113",1], ["59,113",1], ["60,113",1], ["61,113",1], ["62,113",1], ["63,113",1], ["64,113",1],
  ["65,113",1], ["66,113",1], ["67,113",1], ["68,113",1], ["69,113",1], ["70,113",1], ["71,113",1], ["72,113",1],
  ["73,113",1], ["74,113",1], ["75,113",1], ["76,113",1], ["77,113",1], ["78,113",1], ["79,113",1], ["80,113",1],
  ["81,113",1], ["82,113",1], ["83,113",1], ["84,113",1], ["85,113",1], ["86,113",1], ["87,113",1], ["88,113",1],
  ["89,113",1], ["90,113",1], ["91,113",1], ["92,113",1], ["93,113",1], ["94,113",1], ["95,113",1], ["96,113",1],
  ["97,113",1], ["98,113",1], ["99,113",1], ["100,113",1], ["101,113",1], ["102,113",1], ["103,113",1], ["104,113",1],
  ["0,114",1], ["1,114",1], ["2,114",1], ["3,114",1], ["4,114",1], ["5,114",1], ["6,114",1], ["7,114",1],
  ["8,114",1], ["9,114",1], ["10,114",1], ["11,114",1], ["12,114",1], ["13,114",1], ["14,114",1], ["15,114",1],
  ["16,114",1], ["17,114",1], ["18,114",1], ["19,114",1], ["20,114",1], ["21,114",1], ["22,114",1], ["23,114",1],
  ["24,114",1], ["25,114",1], ["26,114",1], ["27,114",1], ["28,114",1], ["29,114",1], ["30,114",1], ["31,114",1],
  ["32,114",1], ["33,114",1], ["34,114",1], ["35,114",1], ["36,114",1], ["37,114",1], ["38,114",1], ["39,114",1],
  ["40,114",1], ["41,114",1], ["42,114",1], ["43,114",1], ["44,114",1], ["45,114",1], ["46,114",1], ["47,114",1],
  ["48,114",1], ["49,114",1], ["50,114",1], ["51,114",1], ["52,114",1], ["53,114",1], ["54,114",1], ["55,114",1],
  ["56,114",1], ["57,114",1], ["58,114",1], ["59,114",1], ["60,114",1], ["61,114",1], ["62,114",1], ["63,114",1],
  ["64,114",1], ["65,114",1], ["66,114",1], ["67,114",1], ["68,114",1], ["69,114",1], ["70,114",1], ["71,114",1],
  ["72,114",1], ["73,114",1], ["74,114",1], ["75,114",1], ["76,114",1], ["77,114",1], ["78,114",1], ["79,114",1],
  ["80,114",1], ["81,114",1], ["82,114",1], ["83,114",1], ["84,114",1], ["85,114",1], ["86,114",1], ["87,114",1],
  ["88,114",1], ["89,114",1], ["90,114",1], ["91,114",1], ["92,114",1], ["93,114",1], ["94,114",1], ["95,114",1],
  ["96,114",1], ["97,114",1], ["98,114",1], ["99,114",1], ["100,114",1], ["101,114",1], ["102,114",1], ["103,114",1],
  ["104,114",1], ["67,116",1], ["68,116",1], ["69,116",1], ["70,116",1], ["71,116",1], ["72,116",1], ["73,116",1],
  ["74,116",1], ["75,116",1], ["76,116",1], ["77,116",1], ["78,116",1], ["79,116",1], ["80,116",1], ["81,116",1],
  ["82,116",1], ["83,116",1], ["84,116",1], ["85,116",1], ["86,116",1], ["87,116",1], ["88,116",1], ["89,116",1],
  ["90,116",1], ["91,116",1], ["92,116",1], ["93,116",1], ["94,116",1], ["95,116",1], ["96,116",1], ["97,116",1],
  ["98,116",1], ["99,116",1], ["100,116",1], ["101,116",1], ["102,116",1], ["103,116",1], ["104,116",1], ["66,116",1],
  ["106,101",1], ["107,101",1], ["110,101",1], ["109,102",1], ["108,102",1], ["106,103",1], ["111,103",1], ["110,103",1],
  ["108,104",1], ["110,105",1], ["109,105",1], ["109,106",1], ["109,118",1], ["108,118",1], ["107,117",1], ["106,117",1],
  ["105,116",1], ["111,119",1], ["110,119",1], ["109,119",1], ["108,115",1], ["108,106",1], ["108,107",1], ["108,108",1],
  ["108,109",1], ["107,109",1], ["107,108",1], ["107,107",1], ["107,106",1], ["107,105",1], ["106,105",1], ["106,106",1],
  ["106,107",1], ["106,108",1], ["106,109",1], ["106,110",1], ["106,111",1], ["105,111",1], ["105,112",1], ["106,112",1],
  ["105,113",1], ["105,114",1], ["106,114",1], ["107,114",1], ["107,113",1], ["107,112",1], ["107,110",1], ["108,110",1],
  ["108,111",1], ["108,112",1], ["108,113",1], ["109,107",1], ["110,107",1], ["111,107",1], ["111,106",1], ["112,108",1],
  ["111,108",1], ["110,108",1], ["109,108",1], ["112,104",1], ["114,105",1], ["113,105",1], ["113,107",1], ["115,106",1],
  ["116,106",1], ["115,108",1], ["114,108",1], ["118,107",1], ["117,107",1], ["118,108",1], ["116,110",1], ["115,111",1],
  ["114,112",1], ["113,113",1], ["107,115",1], ["116,109",1], ["115,110",1], ["111,115",1], ["110,116",1], ["109,116",1],
  ["108,116",1], ["111,114",1], ["110,114",1], ["109,109",1], ["110,109",1], ["111,109",1], ["112,109",1], ["113,109",1],
  ["114,109",1], ["109,110",1], ["110,110",1], ["111,110",1], ["112,110",1], ["113,110",1], ["114,110",1], ["109,111",1],
  ["110,111",1], ["111,111",1], ["112,111",1], ["113,111",1], ["114,111",1], ["109,112",1], ["110,112",1], ["111,112",1],
  ["112,112",1], ["113,112",1], ["109,113",1], ["110,113",1], ["111,113",1], ["112,113",1], ["109,114",1], ["110,117",1],
  ["111,117",1], ["111,120",1], ["114,115",-1], ["113,117",-1], ["112,119",-1]
];

const PAINT_STORAGE_KEY = 'suiboTilePaintOverrides';
const tilePaintOverrides = new Map(DEFAULT_TILE_OVERRIDES);
try {
  const saved = JSON.parse(localStorage.getItem(PAINT_STORAGE_KEY) || '[]');
  for (const [key, value] of saved) tilePaintOverrides.set(key, value);
} catch (error) {
  console.warn('Could not load paint overrides:', error);
}

const HEIGHT_STORAGE_KEY = 'suiboHeightPaintOverrides';
for (const [key, value] of DEFAULT_HEIGHT_OVERRIDES) heightPaintOverrides.set(key, value);
try {
  const savedHeights = JSON.parse(localStorage.getItem(HEIGHT_STORAGE_KEY) || '[]');
  for (const [key, value] of savedHeights) heightPaintOverrides.set(key, value);
} catch (error) {
  console.warn('Could not load height overrides:', error);
}

// Range-select "floating" placements: rectangular slabs of blocks that sit in
// mid-air, detached from the ground. These can't live in heightPaintOverrides
// (that map is one solid column per x/z, always rooted at the ground), so
// each floating slab is stored as its own record: { minX, maxX, minZ, maxZ,
// bottom, top, material }, keyed by an incrementing id.
const FLOATING_STORAGE_KEY = 'suiboFloatingRangeBlocks';
const floatingBlocks = new Map();
let floatingBlockSeq = 0;
try {
  const savedFloating = JSON.parse(localStorage.getItem(FLOATING_STORAGE_KEY) || '[]');
  for (const [key, value] of savedFloating) {
    floatingBlocks.set(key, value);
    floatingBlockSeq = Math.max(floatingBlockSeq, parseInt(key, 10) + 1 || 0);
  }
} catch (error) {
  console.warn('Could not load floating range blocks:', error);
}

function baseTileType(x, z) {
  if (isRiverBlock(x, z)) return 'river';
  if (isRoadBlock(x, z)) return 'road';
  // The block ramp generates its own asphalt top. Do not place a ground tile
  // there too, otherwise the two coplanar surfaces flicker. Checked before
  // the plateau path so the deep overlap between the ramp and the straight
  // path doesn't get double-covered.
  if (isRampActive(x, z)) return 'stair';
  if (isPlateauPathBlock(x, z)) return 'road';
  return 'grass';
}

function tileTypeAt(x, z) {
  const base = baseTileType(x, z);
  // River is the only base type that can never be painted over (it isn't
  // a ground tile at all). Stair steps can be repainted: when they are,
  // createBlockRamp skips drawing its own asphalt for that cell so the
  // flat road/grass tile system takes over instead.
  if (base === 'river') return base;
  return tilePaintOverrides.get(x + ',' + z) || base;
}

function computeTileCells() {
  const grass = [];
  const road = [];
  const river = [];
  for (let z = 0; z < tilesDeep; z++) {
    for (let x = 0; x < tilesWide; x++) {
      const type = tileTypeAt(x, z);
      if (type === 'river') river.push([x, z]);
      else if (type === 'road') road.push([x, z]);
      else if (type === 'grass') grass.push([x, z]);
    }
  }
  return { grass, road, river };
}

function createGroundTiles(name, cells, material, getY, setColor) {
  const mesh = new THREE.InstancedMesh(tileGeometry, material, cells.length);
  mesh.name = name;
  cells.forEach(([x, z], index) => {
    tileMatrix.makeTranslation(
      -halfFieldWidth + tileSize / 2 + x * tileSize,
      getY(x, z),
      -halfFieldDepth + tileSize / 2 + z * tileSize
    );
    mesh.setMatrixAt(index, tileMatrix);
    setColor(x, z, tileColor);
    mesh.setColorAt(index, tileColor);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  field.add(mesh);
  return mesh;
}

function terrainTileY(blockX, blockZ, baseY) {
  const height = getTerrainHeightBlocks(blockX, blockZ);
  if (height <= 0) return baseY;

  return height * tileSize + rampSurfaceThickness - tileSurfaceThickness / 2;
}

const grassTileMaterial = new THREE.MeshLambertMaterial({ map: grassTexture, color: 0xffffff });
const roadTileMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
const riverTileMaterial = new THREE.MeshStandardMaterial({
  color: 0x2aa5b8,
  roughness: 0.08,
  metalness: 0.18,
  emissive: 0x1a5568,
  emissiveIntensity: 0.22,
  transparent: true,
  opacity: 0.94
});

let grassTiles = null;
let roadTiles = null;

// Grass and road tiles are rebuilt whenever the paint overrides change.
// The shared tileGeometry/materials are reused, so only the InstancedMesh
// itself is thrown away.
function buildPaintableTiles() {
  const cells = computeTileCells();
  if (grassTiles) field.remove(grassTiles);
  if (roadTiles) field.remove(roadTiles);

  grassTiles = createGroundTiles(
    'GrassGroundBlocks',
    cells.grass,
    grassTileMaterial,
    (x, z) => terrainTileY(x, z, 0.005 + ((x * 17 + z * 31) % 7) * 0.001),
    (x, z, color) => {
      const shade = 0.96 + Math.sin(x * 12.47 + z * 7.31) * 0.025 + Math.cos(z * 2.9) * 0.012;
      color.setRGB(shade, shade, shade * 0.97);
    }
  );

  roadTiles = createGroundTiles(
    'RoadGroundBlocks',
    cells.road,
    roadTileMaterial,
    (x, z) => terrainTileY(x, z, 0.026 + ((x * 23 + z * 31) % 5) * 0.003),
    (x, z, color) => {
      const roadBase = 0.58 + ((x * 11 + z * 13) % 9) * 0.018;
      const warm = ((x + z) % 4) * 0.015;
      color.setRGB(roadBase + warm, roadBase * 0.96 + warm, roadBase * 0.90);
    }
  );
}

buildPaintableTiles();

const riverGroundTiles = createGroundTiles(
  'RiverGroundBlocks',
  computeTileCells().river,
  riverTileMaterial,
  (x, z) => 0.028 + ((x * 13 + z * 29) % 5) * 0.002,
  (x, z, color) => {
    const shade = 0.82 + ((x * 7 + z * 5) % 9) * 0.014;
    const depth = 0.94 + Math.sin(z * 0.23 + x * 0.07) * 0.055;
    color.setRGB(0.025 * shade * depth, 0.25 * shade * depth, 0.46 * shade * depth);
  }
);

function createTerrainFillBlocks() {
  const cells = [];
  // Cache column heights: each column is looked up as a neighbor up to 4 extra
  // times, and getTerrainHeightBlocks itself isn't cheap (river/ramp math).
  const heightCache = new Map();
  function heightAt(x, z) {
    const key = x * 100000 + z;
    let h = heightCache.get(key);
    if (h === undefined) {
      h = getTerrainHeightBlocks(x, z);
      heightCache.set(key, h);
    }
    return h;
  }

  for (let z = 0; z < tilesDeep; z++) {
    for (let x = 0; x < tilesWide; x++) {
      if (isRiverBlock(x, z)) continue;
      if (isRampActive(x, z)) continue;

      const heightBlocks = heightAt(x, z);
      if (heightBlocks <= 0) continue;
      // A cube fully boxed in by same-or-taller neighbors on all 4 sides (and
      // covered above by the next cube up) is never visible - skip it. Only
      // the top cap and cubes with an exposed side toward a shorter neighbor
      // actually need to be drawn.
      const minNeighbor = Math.min(
        heightAt(x, z - 1),
        heightAt(x, z + 1),
        heightAt(x + 1, z),
        heightAt(x - 1, z)
      );
      for (let y = 0; y < heightBlocks; y++) {
        if (y < heightBlocks - 1 && y < minNeighbor) continue;
        cells.push({ x, y, z, heightBlocks });
      }
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(tileSize - 0.004, tileSize - 0.004, tileSize - 0.004),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 }),
    cells.length
  );
  mesh.name = 'TerrainHeightFillBlocks';
  const color = new THREE.Color();

  cells.forEach(({ x, y, z, heightBlocks }, index) => {
    tileMatrix.makeTranslation(
      -halfFieldWidth + tileSize / 2 + x * tileSize,
      tileSize / 2 + y * tileSize,
      -halfFieldDepth + tileSize / 2 + z * tileSize
    );
    mesh.setMatrixAt(index, tileMatrix);

    const shade = 0.68 + ((x * 11 + y * 17 + z * 5) % 9) * 0.018;
    if (y === heightBlocks - 1) {
      color.setRGB(0.42 * shade, 0.61 * shade, 0.29 * shade);
    } else if ((x + y + z) % 6 === 0) {
      color.setRGB(0.38 * shade, 0.38 * shade, 0.36 * shade);
    } else {
      color.setRGB(0.46 * shade, 0.31 * shade, 0.20 * shade);
    }
    mesh.setColorAt(index, color);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  field.add(mesh);
  return mesh;
}

let terrainFillBlocks = null;
function buildTerrainFillBlocks() {
  if (terrainFillBlocks) field.remove(terrainFillBlocks);
  terrainFillBlocks = createTerrainFillBlocks();
}
buildTerrainFillBlocks();

scene.add(field);

// Fine grass clusters give the surface parallax without changing its walkable height.
const tuftGeometry = new THREE.BoxGeometry(0.16, 0.055, 0.16);
const tuftMaterial = new THREE.MeshLambertMaterial({ color: 0x4f9639 });
const tufts = new THREE.InstancedMesh(tuftGeometry, tuftMaterial, 900);

function updateTufts() {
  for (let i = 0; i < 900; i++) {
    const x = ((i * 47) % 997) / 997 * (fieldWidth - 1) - (halfFieldWidth - 0.5);
    const z = ((i * 83 + 19) % 991) / 991 * (fieldDepth - 1) - (halfFieldDepth - 0.5);
    const blockX = Math.floor(blockXFromWorld(x));
    const blockZ = Math.floor(blockZFromWorld(z));
    if (tileTypeAt(blockX, blockZ) !== 'grass') {
      tileMatrix.makeScale(0, 0, 0);
    } else {
      tileMatrix.makeTranslation(x, getTerrainHeightBlocks(blockX, blockZ) * tileSize + 0.13, z);
    }
    tufts.setMatrixAt(i, tileMatrix);
  }
  tufts.instanceMatrix.needsUpdate = true;
}

updateTufts();
tufts.receiveShadow = true;
field.add(tufts);

function createStoneRoad() {
  const road = getRoadFromHouseBounds();
  const accentCells = [];
  const startX = Math.floor(road.left);
  const endX = Math.ceil(road.right) - 1;
  const startZ = Math.floor(road.top);
  const endZ = Math.ceil(road.bottom) - 1;

  for (let z = startZ; z <= endZ; z++) {
    for (let x = startX; x <= endX; x++) {
      if ((x * 7 + z * 17) % 6 === 0) accentCells.push([x, z]);
    }
  }

  const accentGeometry = new THREE.BoxGeometry(tileSize * 0.72, 0.012, tileSize * 0.18);
  const accentMaterial = new THREE.MeshBasicMaterial({ color: 0xd9d2c7, transparent: true, opacity: 0.28 });
  const accents = new THREE.InstancedMesh(accentGeometry, accentMaterial, accentCells.length);
  accents.name = 'StoneRoadHighlights';
  accentCells.forEach(([x, z], index) => {
    tileMatrix.makeRotationY(((x + z) % 3 - 1) * 0.35);
    tileMatrix.setPosition(
      -halfFieldWidth + tileSize / 2 + x * tileSize,
      0.074,
      -halfFieldDepth + tileSize / 2 + z * tileSize
    );
    accents.setMatrixAt(index, tileMatrix);
  });
  accents.instanceMatrix.needsUpdate = true;
  scene.add(accents);

  return { accents };
}

createStoneRoad();

function setRiverFlowMatrix(mesh, index, blockZ, lane, bob = 0) {
  const current = riverPointAt(blockZ, lane);
  const next = riverPointAt(blockZ + 4, lane);
  const dx = next.worldX - current.worldX;
  const dz = next.worldZ - current.worldZ;
  const angle = Math.atan2(-dz, dx);
  const y = 0.145 + Math.sin(bob) * 0.006;

  tileMatrix.makeRotationY(angle);
  tileMatrix.setPosition(current.worldX, y, current.worldZ);
  mesh.setMatrixAt(index, tileMatrix);
}

function createRiverSurfaceGeometry(y = 0.151) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const step = 3;

  for (let z = 0; z <= tilesDeep - 1; z += step) {
    const { left, right } = riverEdgesAtBlockZ(z);
    const row = vertices.length / 3;
    vertices.push(
      worldXFromBlock(left), y, worldZFromBlock(z),
      worldXFromBlock(right), y, worldZFromBlock(z)
    );
    uvs.push(0, z / tilesDeep, 1, z / tilesDeep);

    if (row >= 2) {
      const previous = row - 2;
      indices.push(previous, previous + 1, row, previous + 1, row + 1, row);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRiver() {
  const shimmerCells = [];
  const bankCells = [];

  for (let z = 0; z < tilesDeep; z++) {
    const { left, right } = riverEdgesAtBlockZ(z);
    const start = Math.max(0, Math.floor(left));
    const end = Math.min(tilesWide - 1, Math.ceil(right) - 1);

    for (let x = start; x <= end; x++) {
      if ((x * 19 + z * 11) % 23 === 0 || (x + z * 3) % 37 === 0) {
        shimmerCells.push([x, z]);
      }
    }

    const leftBank = Math.max(0, start - 1);
    const rightBank = Math.min(tilesWide - 1, end + 1);
    bankCells.push([leftBank, z]);
    if (rightBank !== leftBank) bankCells.push([rightBank, z]);
  }

  const water = riverGroundTiles;

  const surfaceMaterial = new THREE.MeshBasicMaterial({
    map: riverSurfaceTexture,
    color: 0x3fb8cf,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
  });
  const surface = new THREE.Mesh(createRiverSurfaceGeometry(0.166), surfaceMaterial);
  surface.name = 'RiverSurfaceTexture';
  surface.renderOrder = 2;
  scene.add(surface);

  const reflectionMaterial = new THREE.MeshBasicMaterial({
    map: riverReflectionTexture,
    color: 0xf3feff,
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });
  const reflection = new THREE.Mesh(createRiverSurfaceGeometry(0.174), reflectionMaterial);
  reflection.name = 'RiverReflectionTexture';
  reflection.renderOrder = 3;
  scene.add(reflection);

  const shimmerGeometry = new THREE.BoxGeometry(tileSize * 0.62, 0.012, tileSize * 0.18);
  const shimmerMaterial = new THREE.MeshBasicMaterial({
    color: 0xd6f5ff,
    transparent: true,
    opacity: 0.58
  });
  const shimmer = new THREE.InstancedMesh(shimmerGeometry, shimmerMaterial, shimmerCells.length);
  shimmer.name = 'RiverHighlights';
  shimmerCells.forEach(([x, z], index) => {
    tileMatrix.makeRotationY(((x + z) % 4) * 0.45);
    tileMatrix.setPosition(
      -halfFieldWidth + tileSize / 2 + x * tileSize,
      0.125,
      -halfFieldDepth + tileSize / 2 + z * tileSize
    );
    shimmer.setMatrixAt(index, tileMatrix);
  });
  shimmer.instanceMatrix.needsUpdate = true;
  scene.add(shimmer);

  const flowCount = 36;
  const flowGeometry = new THREE.BoxGeometry(tileSize * 1.25, 0.018, tileSize * 0.16);
  const flowMaterial = new THREE.MeshBasicMaterial({
    color: 0xf0fdff,
    transparent: true,
    opacity: 0.74
  });
  const flowHighlights = new THREE.InstancedMesh(flowGeometry, flowMaterial, flowCount);
  flowHighlights.name = 'RiverFlowHighlights';
  const flowData = Array.from({ length: flowCount }, (_, index) => ({
    z: (index / flowCount) * tilesDeep,
    lane: 0.18 + (((index * 37) % 100) / 100) * 0.64,
    speed: 8.5 + ((index * 19) % 11) * 0.32,
    bob: (index * 1.73) % Math.PI
  }));
  flowData.forEach((particle, index) => {
    setRiverFlowMatrix(flowHighlights, index, particle.z, particle.lane, particle.bob);
  });
  flowHighlights.instanceMatrix.needsUpdate = true;
  scene.add(flowHighlights);

  const bankGeometry = new THREE.BoxGeometry(tileSize - 0.003, 0.11, tileSize - 0.003);
  const bankMaterial = new THREE.MeshLambertMaterial({ color: 0xc9b383 });
  const banks = new THREE.InstancedMesh(bankGeometry, bankMaterial, bankCells.length);
  banks.name = 'RiverBanks';
  bankCells.forEach(([x, z], index) => {
    const edgeStep = ((x * 5 + z * 3) % 3) * 0.006;
    tileMatrix.makeTranslation(
      -halfFieldWidth + tileSize / 2 + x * tileSize,
      0.115 + edgeStep,
      -halfFieldDepth + tileSize / 2 + z * tileSize
    );
    banks.setMatrixAt(index, tileMatrix);
  });
  banks.instanceMatrix.needsUpdate = true;
  banks.castShadow = true;
  banks.receiveShadow = true;
  scene.add(banks);

  return { water, surface, reflection, shimmer, banks, flowHighlights, flowData };
}

const riverMeshes = createRiver();

function createRiverFences() {
  const fence = mapConfig.areas.riverFence;
  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'RiverFences';
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x2f241c, roughness: 0.86, metalness: 0.02 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2b20, roughness: 0.86, metalness: 0.02 });
  const capMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3325, roughness: 0.8, metalness: 0.02 });
  const postGeometry = new THREE.BoxGeometry(tileSize * 0.72, tileSize * 3.3, tileSize * 0.72);
  const capGeometry = new THREE.BoxGeometry(tileSize * 0.86, tileSize * 0.42, tileSize * 0.86);
  const railGeometry = new THREE.BoxGeometry(tileSize * 0.42, tileSize * 0.46, 1);
  const postPositions = [];
  const capPositions = [];
  const railSegments = [];

  for (const side of [-1, 1]) {
    let previous = null;
    for (let z = 2; z <= tilesDeep - 2; z += fence.postSpacingBlocks) {
      const { left, right } = riverEdgesAtBlockZ(z);
      const edge = side < 0 ? left : right;
      const blockX = THREE.MathUtils.clamp(edge + side * fence.offsetBlocks, 1, tilesWide - 1);
      const point = {
        blockX,
        blockZ: z,
        worldX: worldXFromBlock(blockX),
        worldZ: worldZFromBlock(z)
      };
      postPositions.push(point);
      capPositions.push(point);

      if (previous) {
        railSegments.push({ a: previous, b: point, y: tileSize * 1.45 });
        railSegments.push({ a: previous, b: point, y: tileSize * 2.45 });
      }

      previous = point;
    }
  }

  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, postPositions.length);
  posts.name = 'RiverFencePosts';
  postPositions.forEach((point, index) => {
    tileMatrix.makeTranslation(point.worldX, tileSize * 1.65, point.worldZ);
    posts.setMatrixAt(index, tileMatrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  posts.receiveShadow = true;
  fenceGroup.add(posts);

  const caps = new THREE.InstancedMesh(capGeometry, capMaterial, capPositions.length);
  caps.name = 'RiverFenceCaps';
  capPositions.forEach((point, index) => {
    tileMatrix.makeTranslation(point.worldX, tileSize * 3.5, point.worldZ);
    caps.setMatrixAt(index, tileMatrix);
  });
  caps.instanceMatrix.needsUpdate = true;
  caps.castShadow = true;
  caps.receiveShadow = true;
  fenceGroup.add(caps);

  const rails = new THREE.InstancedMesh(railGeometry, railMaterial, railSegments.length);
  rails.name = 'RiverFenceRails';
  railSegments.forEach(({ a, b, y }, index) => {
    const dx = b.worldX - a.worldX;
    const dz = b.worldZ - a.worldZ;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    tileMatrix.makeRotationY(angle);
    tileMatrix.scale(new THREE.Vector3(1, 1, length));
    tileMatrix.setPosition((a.worldX + b.worldX) / 2, y, (a.worldZ + b.worldZ) / 2);
    rails.setMatrixAt(index, tileMatrix);
  });
  rails.instanceMatrix.needsUpdate = true;
  rails.castShadow = true;
  rails.receiveShadow = true;
  fenceGroup.add(rails);

  scene.add(fenceGroup);
  return fenceGroup;
}

createRiverFences();

// Map grid: north is -Z, the river is on the east (+X), and one cell is 15 blocks.
// The player starts in the south-east cell; this house occupies the cell directly left of it.
const houseBlockGeometry = new THREE.BoxGeometry(tileSize - 0.003, tileSize - 0.003, tileSize - 0.003);
const startX = worldXFromBlock(mapConfig.playerStartBlock.x);
const startZ = worldZFromBlock(mapConfig.playerStartBlock.z);
const houseOrigin = new THREE.Vector3(
  worldXFromBlock(mapConfig.structures.startHouse.centerBlock.x),
  0.05 + tileSize / 2,
  worldZFromBlock(mapConfig.structures.startHouse.centerBlock.z)
);

// Buildings are registered here so edit mode can select and move them. Each
// entry's meshes live under its own Group whose position starts at the origin,
// so moving a whole building is just a translation on that Group - the
// per-instance matrices (baked in world space at build time) stay untouched.
const movableStructures = [];

function registerMovableStructure(entry) {
  // Keep pristine copies of the collision boxes: moves are applied as an
  // absolute offset from these, so undo/redo can restore an exact position
  // instead of accumulating rounding drift from repeated deltas.
  movableStructures.push({
    offsetX: 0,
    offsetZ: 0,
    collider: null,
    stepZone: null,
    ...entry,
    baseCollider: entry.collider ? { ...entry.collider } : null,
    baseStepZone: entry.stepZone ? { ...entry.stepZone } : null
  });
  return movableStructures[movableStructures.length - 1];
}

const startHouseGroup = new THREE.Group();
startHouseGroup.name = 'StartHouse';
scene.add(startHouseGroup);

function createHouseLayer(name, cells, color) {
  const mesh = new THREE.InstancedMesh(
    houseBlockGeometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 }),
    cells.length
  );
  mesh.name = name;
  const matrix = new THREE.Matrix4();
  cells.forEach(([x, y, z], index) => {
    matrix.makeTranslation(
      houseOrigin.x + x * tileSize,
      houseOrigin.y + y * tileSize,
      houseOrigin.z + z * tileSize
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  startHouseGroup.add(mesh);
  return mesh;
}

const foundationBlocks = [];
const wallBlocks = [];
const trimBlocks = [];
const glassBlocks = [];
const doorBlocks = [];
const roofBlocks = [];
const roofHighlightBlocks = [];
const halfHouse = mapConfig.structures.startHouse.halfBlocks;

// Full stone foundation: exactly 15 x 15 blocks.
for (let x = -halfHouse; x <= halfHouse; x++) {
  for (let z = -halfHouse; z <= halfHouse; z++) foundationBlocks.push([x, 0, z]);
}

// Nine-block-high wall shell with block-cut openings.
for (let y = 1; y <= 9; y++) {
  for (let x = -halfHouse; x <= halfHouse; x++) {
    for (let z = -halfHouse; z <= halfHouse; z++) {
      const perimeter = Math.abs(x) === halfHouse || Math.abs(z) === halfHouse;
      if (!perimeter) continue;
      const front = z === halfHouse;
      const side = Math.abs(x) === halfHouse;
      const back = z === -halfHouse;
      const doorway = x === halfHouse && Math.abs(z) <= 1 && y <= 6;
      const frontWindow = front && y >= 4 && y <= 7 && ((x >= -6 && x <= -4) || (x >= 4 && x <= 6));
      const sideWindow = side && y >= 4 && y <= 7 && ((z >= -6 && z <= -4) || (z >= 4 && z <= 6));
      const backWindow = back && y >= 4 && y <= 7 && ((x >= -5 && x <= -3) || (x >= 3 && x <= 5));

      if (doorway) doorBlocks.push([x, y, z]);
      else if (frontWindow || sideWindow || backWindow) glassBlocks.push([x, y, z]);
      else if (y === 1 || y === 9 || ((Math.abs(x) === halfHouse) && (Math.abs(z) === halfHouse))) trimBlocks.push([x, y, z]);
      else wallBlocks.push([x, y, z]);
    }
  }
}

// Five stepped roof layers complete the total height of about 15 blocks.
const roofHalfSizes = [7, 7, 6, 5, 4];
roofHalfSizes.forEach((roofHalf, level) => {
  for (let x = -roofHalf; x <= roofHalf; x++) {
    for (let z = -roofHalf; z <= roofHalf; z++) {
      const target = (level % 2 === 0 && (Math.abs(x) === roofHalf || Math.abs(z) === roofHalf))
        ? roofHighlightBlocks
        : roofBlocks;
      target.push([x, 10 + level, z]);
    }
  }
});

// Entrance steps and a small block canopy face the road on the east side.
for (let z = -2; z <= 2; z++) {
  for (let x = 8; x <= 9; x++) foundationBlocks.push([x, 0, z]);
  for (let x = 7; x <= 9; x++) roofHighlightBlocks.push([x, 8, z]);
}

createHouseLayer('HouseFoundation', foundationBlocks, 0x747a77);
createHouseLayer('HouseWalls', wallBlocks, 0xc7ad82);
createHouseLayer('HouseTimberTrim', trimBlocks, 0x70513b);
createHouseLayer('HouseWindows', glassBlocks, 0x4d879b);
createHouseLayer('HouseDoor', doorBlocks, 0x65412f);
createHouseLayer('HouseRoof', roofBlocks, 0x344d61);
createHouseLayer('HouseRoofHighlights', roofHighlightBlocks, 0x496c83);

const walkableStepZones = [];
const houseColliders = [{
  minX: houseOrigin.x - (halfHouse + 0.65) * tileSize,
  maxX: houseOrigin.x + (halfHouse + 0.65) * tileSize,
  minZ: houseOrigin.z - (halfHouse + 0.65) * tileSize,
  maxZ: houseOrigin.z + (halfHouse + 0.65) * tileSize
}];

walkableStepZones.push({
  minX: houseOrigin.x + (halfHouse + 0.5) * tileSize,
  maxX: houseOrigin.x + (halfHouse + 2.5) * tileSize,
  minZ: houseOrigin.z - 2.5 * tileSize,
  maxZ: houseOrigin.z + 2.5 * tileSize,
  height: tileSize
});

registerMovableStructure({
  label: '開始地点の家',
  group: startHouseGroup,
  centerBlock: { ...mapConfig.structures.startHouse.centerBlock },
  collider: houseColliders[0],
  stepZone: walkableStepZones[walkableStepZones.length - 1],
  baseGroundBlocks: getTerrainHeightBlocks(
    Math.round(mapConfig.structures.startHouse.centerBlock.x),
    Math.round(mapConfig.structures.startHouse.centerBlock.z)
  )
});

function createBuildingLayer(name, origin, cells, color, parent) {
  if (!cells.length) return null;
  const mesh = new THREE.InstancedMesh(
    houseBlockGeometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 }),
    cells.length
  );
  mesh.name = name;
  const matrix = new THREE.Matrix4();
  cells.forEach(([x, y, z], index) => {
    matrix.makeTranslation(
      origin.x + x * tileSize,
      origin.y + y * tileSize,
      origin.z + z * tileSize
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  (parent || scene).add(mesh);
  return mesh;
}

function createConfiguredBuilding(config) {
  const origin = new THREE.Vector3(
    worldXFromBlock(config.centerBlock.x),
    0.05 + tileSize / 2,
    worldZFromBlock(config.centerBlock.z)
  );
  const half = config.halfBlocks;
  const wallHeight = config.wallHeightBlocks;
  const roofHeight = config.roofHeightBlocks;
  const foundation = [];
  const walls = [];
  const trim = [];
  const glass = [];
  const door = [];
  const roof = [];
  const roofHighlight = [];

  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) foundation.push([x, 0, z]);
  }

  for (let y = 1; y <= wallHeight; y++) {
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const perimeter = Math.abs(x) === half || Math.abs(z) === half;
        if (!perimeter) continue;
        const front = z === half;
        const side = Math.abs(x) === half;
        const back = z === -half;
        const doorway = x === half && Math.abs(z) <= 1 && y <= 6;
        const apartmentWindow = config.apartment && y >= 4 && y <= wallHeight - 2 && y % 4 <= 1 && Math.abs(x) <= half - 2 && Math.abs(x) % 4 <= 1;
        const houseFrontWindow = front && y >= 4 && y <= Math.min(8, wallHeight - 2) && ((x >= -half + 1 && x <= -half + 3) || (x >= half - 3 && x <= half - 1));
        const sideWindow = side && y >= 4 && y <= wallHeight - 2 && Math.abs(z) > 2 && z % 5 >= -1 && z % 5 <= 1;
        const backWindow = back && y >= 5 && y <= wallHeight - 2 && Math.abs(x) <= half - 3 && Math.abs(x) % 5 <= 1;

        if (doorway) door.push([x, y, z]);
        else if (apartmentWindow || houseFrontWindow || sideWindow || backWindow) glass.push([x, y, z]);
        else if (y === 1 || y === wallHeight || Math.abs(x) === half && Math.abs(z) === half || (config.apartment && y % 5 === 0)) trim.push([x, y, z]);
        else walls.push([x, y, z]);
      }
    }
  }

  if (config.apartment) {
    for (let y = wallHeight + 1; y <= wallHeight + roofHeight; y++) {
      for (let x = -half; x <= half; x++) {
        for (let z = -half; z <= half; z++) {
          const edge = Math.abs(x) === half || Math.abs(z) === half || y === wallHeight + roofHeight;
          (edge ? roofHighlight : roof).push([x, y, z]);
        }
      }
    }
  } else {
    for (let level = 0; level < roofHeight; level++) {
      const roofHalf = Math.max(2, half - Math.floor(level * 0.7));
      for (let x = -roofHalf; x <= roofHalf; x++) {
        for (let z = -roofHalf; z <= roofHalf; z++) {
          const edge = Math.abs(x) === roofHalf || Math.abs(z) === roofHalf;
          (edge ? roofHighlight : roof).push([x, wallHeight + 1 + level, z]);
        }
      }
    }
  }

  for (let z = -2; z <= 2; z++) {
    for (let x = half + 1; x <= half + 2; x++) foundation.push([x, 0, z]);
    for (let x = half; x <= half + 2; x++) roofHighlight.push([x, Math.min(8, wallHeight), z]);
  }

  const group = new THREE.Group();
  group.name = config.name;
  scene.add(group);

  createBuildingLayer(`${config.name}Foundation`, origin, foundation, config.colors.foundation, group);
  createBuildingLayer(`${config.name}Walls`, origin, walls, config.colors.wall, group);
  createBuildingLayer(`${config.name}Trim`, origin, trim, config.colors.trim, group);
  createBuildingLayer(`${config.name}Glass`, origin, glass, config.colors.glass, group);
  createBuildingLayer(`${config.name}Door`, origin, door, config.colors.door, group);
  createBuildingLayer(`${config.name}Roof`, origin, roof, config.colors.roof, group);
  createBuildingLayer(`${config.name}RoofHighlights`, origin, roofHighlight, config.colors.trim, group);

  const collider = {
    minX: origin.x - (half + 0.65) * tileSize,
    maxX: origin.x + (half + 0.65) * tileSize,
    minZ: origin.z - (half + 0.65) * tileSize,
    maxZ: origin.z + (half + 0.65) * tileSize
  };
  const stepZone = {
    minX: origin.x + (half + 0.5) * tileSize,
    maxX: origin.x + (half + 2.5) * tileSize,
    minZ: origin.z - 2.5 * tileSize,
    maxZ: origin.z + 2.5 * tileSize,
    height: tileSize
  };
  houseColliders.push(collider);
  walkableStepZones.push(stepZone);

  registerMovableStructure({
    label: config.label || config.name,
    group,
    centerBlock: { ...config.centerBlock },
    collider,
    stepZone,
    baseGroundBlocks: getTerrainHeightBlocks(
      Math.round(config.centerBlock.x),
      Math.round(config.centerBlock.z)
    )
  });
}

mapConfig.structures.additionalHouses.forEach(createConfiguredBuilding);

// --- Evacuation shelter ------------------------------------------------
// Deliberately standalone: not in mapConfig.structures.additionalHouses, so
// it doesn't touch the minimap or houseConfigs()/terrain-height-limiting.
// Its ground origin is read from the real terrain height at this spot
// (getTerrainHeightBlocks), not assumed to be 0 - this location sits on the
// flattened northwest plateau, 13 blocks up, unlike the other houses which
// all sit at sea level. A hardcoded sea-level origin is what buried the
// building inside the raised ground last time.
function createSignTexture(draw, width, height) {
  const signCanvas = document.createElement('canvas');
  signCanvas.width = width;
  signCanvas.height = height;
  draw(signCanvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(signCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEvacuationSign(config, origin, parent) {
  const half = config.halfBlocks;
  const wallHeight = config.wallHeightBlocks;
  const signWidthBlocks = half * 1.7;
  const signHeightBlocks = 2.3;
  const signGreen = 0x1f7a45;

  const texture = createSignTexture((ctx, w, h) => {
    ctx.fillStyle = '#1f7a45';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = w * 0.012;
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);

    // Pictogram: a running figure heading toward an exit, in the style of
    // the standard green evacuation-route signs.
    ctx.save();
    ctx.translate(w * 0.17, h * 0.52);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = h * 0.05;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = h * 0.34;
    ctx.beginPath();
    ctx.arc(-s * 0.15, -s * 1.15, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.85);
    ctx.lineTo(s * 0.05, -s * 0.15);
    ctx.lineTo(s * 0.5, -s * 0.35);
    ctx.moveTo(s * 0.05, -s * 0.15);
    ctx.lineTo(-s * 0.35, s * 0.55);
    ctx.moveTo(-s * 0.15, -s * 0.85);
    ctx.lineTo(-s * 0.55, -s * 0.45);
    ctx.moveTo(-s * 0.15, -s * 0.85);
    ctx.lineTo(-s * 0.1, s * 0.05);
    ctx.lineTo(s * 0.35, s * 0.65);
    ctx.moveTo(-s * 0.1, s * 0.05);
    ctx.lineTo(-s * 0.55, s * 0.65);
    ctx.stroke();
    ctx.strokeRect(s * 0.8, -s * 1.05, s * 0.5, s * 1.9);
    ctx.beginPath();
    ctx.moveTo(s * 0.8, -s * 0.1);
    ctx.lineTo(s * 1.6, -s * 0.1);
    ctx.lineTo(s * 1.35, -s * 0.35);
    ctx.moveTo(s * 1.6, -s * 0.1);
    ctx.lineTo(s * 1.35, s * 0.15);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${h * 0.48}px "Yu Gothic UI", "Meiryo", sans-serif`;
    ctx.fillText('避難所', w * 0.47, h * 0.53);
  }, 1024, 320);

  const frontMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: signGreen, roughness: 0.6 });
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(signWidthBlocks * tileSize, signHeightBlocks * tileSize, tileSize * 0.35),
    [sideMaterial, sideMaterial, sideMaterial, sideMaterial, frontMaterial, sideMaterial]
  );
  sign.position.set(
    origin.x,
    origin.y + (wallHeight + 0.55) * tileSize,
    origin.z + (half + 0.35) * tileSize
  );
  sign.castShadow = true;
  sign.receiveShadow = true;
  (parent || scene).add(sign);

  // Two timber posts holding the sign above the entrance.
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.85 });
  const postHeight = (wallHeight + 0.55) * tileSize;
  const postGeometry = new THREE.BoxGeometry(tileSize * 0.5, postHeight, tileSize * 0.5);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(
      origin.x + side * (signWidthBlocks / 2 - 0.3) * tileSize,
      origin.y + postHeight / 2,
      origin.z + (half + 0.35) * tileSize
    );
    post.castShadow = true;
    post.receiveShadow = true;
    (parent || scene).add(post);
  }
}

// A simple wooden perimeter fence with a gap left open in front of the door.
// worldX/worldZ/groundY are the actual ground surface under the shelter -
// NOT the block-center building origin (which sits tileSize/2 higher).
function createShelterFence(config, worldX, worldZ, groundY, parent) {
  const half = config.halfBlocks;
  const margin = half + 1.4;
  const spacing = 2;
  const gateHalf = 3; // wide enough for the front door

  const segments = [];
  for (let x = -margin; x < margin - 1e-6; x += spacing) {
    const nx = Math.min(x + spacing, margin);
    if (nx <= -gateHalf || x >= gateHalf) segments.push([x, margin, nx, margin]);
  }
  for (let x = -margin; x < margin - 1e-6; x += spacing) {
    segments.push([x, -margin, Math.min(x + spacing, margin), -margin]);
  }
  for (let z = -margin; z < margin - 1e-6; z += spacing) {
    const nz = Math.min(z + spacing, margin);
    segments.push([-margin, z, -margin, nz]);
    segments.push([margin, z, margin, nz]);
  }

  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x2f241c, roughness: 0.86 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2b20, roughness: 0.86 });
  const postGeometry = new THREE.BoxGeometry(tileSize * 0.46, tileSize * 2, tileSize * 0.46);
  const railGeometry = new THREE.BoxGeometry(tileSize * 0.3, tileSize * 0.38, 1);
  const matrix = new THREE.Matrix4();

  const postKeys = new Map();
  for (const [ax, az, bx, bz] of segments) {
    for (const [px, pz] of [[ax, az], [bx, bz]]) {
      postKeys.set(`${px.toFixed(3)},${pz.toFixed(3)}`, [px, pz]);
    }
  }
  const postPositions = [...postKeys.values()];
  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, postPositions.length);
  posts.name = 'ShelterFencePosts';
  postPositions.forEach(([x, z], index) => {
    matrix.makeTranslation(worldX + x * tileSize, groundY + tileSize, worldZ + z * tileSize);
    posts.setMatrixAt(index, matrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  posts.receiveShadow = true;
  (parent || scene).add(posts);

  const rails = new THREE.InstancedMesh(railGeometry, railMaterial, segments.length * 2);
  rails.name = 'ShelterFenceRails';
  let railIndex = 0;
  for (const [ax, az, bx, bz] of segments) {
    const dx = (bx - ax) * tileSize;
    const dz = (bz - az) * tileSize;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const cx = worldX + ((ax + bx) / 2) * tileSize;
    const cz = worldZ + ((az + bz) / 2) * tileSize;
    for (const y of [groundY + tileSize * 0.7, groundY + tileSize * 1.3]) {
      matrix.makeRotationY(angle);
      matrix.scale(new THREE.Vector3(1, 1, length));
      matrix.setPosition(cx, y, cz);
      rails.setMatrixAt(railIndex, matrix);
      railIndex++;
    }
  }
  rails.instanceMatrix.needsUpdate = true;
  rails.castShadow = true;
  rails.receiveShadow = true;
  (parent || scene).add(rails);
}

function buildEvacuationShelter() {
  const config = {
    name: 'EvacuationShelter',
    // Grid-cell convention (cellBlocks = 15, same as targetCellFromNorth):
    // cell N's center is at (N - 0.5) * cellBlocks. "左から2マス目、上から5マス目"
    // relative to the map as it was before the 7-cell west expansion, so
    // +WEST_EXPANSION_BLOCKS keeps it physically in the same spot.
    centerBlock: { x: 1.5 * mapConfig.cellBlocks + WEST_EXPANSION_BLOCKS, z: 4.5 * mapConfig.cellBlocks },
    // Width x3 (11 -> 33 blocks across, half 5 -> 16), height x1.5 (7 -> 11).
    halfBlocks: 16,
    wallHeightBlocks: 11,
    roofHeightBlocks: 2,
    colors: { foundation: 0x8b8880, wall: 0xdcc79a, trim: 0x6b4a30, glass: 0x6f97a8, door: 0x5b3a2d, roof: 0x2f7d4f }
  };

  const centerBlockX = Math.round(config.centerBlock.x);
  const centerBlockZ = Math.round(config.centerBlock.z);
  const groundHeightBlocks = getTerrainHeightBlocks(centerBlockX, centerBlockZ);
  const groundY = groundHeightBlocks * tileSize + 0.05;
  const origin = new THREE.Vector3(
    worldXFromBlock(config.centerBlock.x),
    groundY + tileSize / 2,
    worldZFromBlock(config.centerBlock.z)
  );

  const half = config.halfBlocks;
  const wallHeight = config.wallHeightBlocks;
  const roofHeight = config.roofHeightBlocks;
  const foundation = [];
  const walls = [];
  const trim = [];
  const glass = [];
  const door = [];
  const roof = [];
  const roofHighlight = [];

  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) foundation.push([x, 0, z]);
  }

  for (let y = 1; y <= wallHeight; y++) {
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const perimeter = Math.abs(x) === half || Math.abs(z) === half;
        if (!perimeter) continue;
        const front = z === half;
        const side = Math.abs(x) === half;
        const back = z === -half;
        // Door is centered on the front face, under the sign - not the side
        // wall (that was the bug: the original template puts its door on
        // whichever wall faces the road, which isn't "front" here).
        const doorway = front && Math.abs(x) <= 2 && y <= 7;
        const houseFrontWindow = front && y >= 4 && y <= Math.min(8, wallHeight - 2) && ((x >= -half + 1 && x <= -half + 3) || (x >= half - 3 && x <= half - 1));
        const sideWindow = side && y >= 4 && y <= wallHeight - 2 && Math.abs(z) > 2 && z % 5 >= -1 && z % 5 <= 1;
        const backWindow = back && y >= 5 && y <= wallHeight - 2 && Math.abs(x) <= half - 3 && Math.abs(x) % 5 <= 1;

        if (doorway) door.push([x, y, z]);
        else if (houseFrontWindow || sideWindow || backWindow) glass.push([x, y, z]);
        else if (y === 1 || y === wallHeight || (Math.abs(x) === half && Math.abs(z) === half)) trim.push([x, y, z]);
        else walls.push([x, y, z]);
      }
    }
  }

  for (let level = 0; level < roofHeight; level++) {
    const roofHalf = Math.max(2, half - Math.floor(level * 0.7));
    for (let x = -roofHalf; x <= roofHalf; x++) {
      for (let z = -roofHalf; z <= roofHalf; z++) {
        const edge = Math.abs(x) === roofHalf || Math.abs(z) === roofHalf;
        (edge ? roofHighlight : roof).push([x, wallHeight + 1 + level, z]);
      }
    }
  }

  const group = new THREE.Group();
  group.name = config.name;
  scene.add(group);

  createBuildingLayer(`${config.name}Foundation`, origin, foundation, config.colors.foundation, group);
  createBuildingLayer(`${config.name}Walls`, origin, walls, config.colors.wall, group);
  createBuildingLayer(`${config.name}Trim`, origin, trim, config.colors.trim, group);
  createBuildingLayer(`${config.name}Glass`, origin, glass, config.colors.glass, group);
  createBuildingLayer(`${config.name}Door`, origin, door, config.colors.door, group);
  createBuildingLayer(`${config.name}Roof`, origin, roof, config.colors.roof, group);
  createBuildingLayer(`${config.name}RoofHighlights`, origin, roofHighlight, config.colors.trim, group);

  const collider = {
    minX: origin.x - (half + 0.65) * tileSize,
    maxX: origin.x + (half + 0.65) * tileSize,
    minZ: origin.z - (half + 0.65) * tileSize,
    maxZ: origin.z + (half + 0.65) * tileSize
  };
  // Small step-up zone in front of the door (not to the side - the door
  // faces +Z now, matching the sign and the fence gate).
  const stepZone = {
    minX: origin.x - 2.5 * tileSize,
    maxX: origin.x + 2.5 * tileSize,
    minZ: origin.z + (half + 0.5) * tileSize,
    maxZ: origin.z + (half + 2.5) * tileSize,
    height: tileSize
  };
  houseColliders.push(collider);
  walkableStepZones.push(stepZone);

  createEvacuationSign(config, origin, group);
  createShelterFence(config, origin.x, origin.z, groundY, group);

  registerMovableStructure({
    label: '避難所',
    group,
    centerBlock: { ...config.centerBlock },
    collider,
    stepZone,
    baseGroundBlocks: groundHeightBlocks
  });
}

buildEvacuationShelter();
// -------------------------------------------------------------------------

function createBlockRamp() {
  const topCells = [];
  const fillCells = [];

  // Cache column heights: each column is looked up as a neighbor several
  // extra times and getTerrainHeightBlocks isn't cheap.
  const heightCache = new Map();
  function heightAt(x, z) {
    const key = x * 100000 + z;
    let h = heightCache.get(key);
    if (h === undefined) {
      h = getTerrainHeightBlocks(x, z);
      heightCache.set(key, h);
    }
    return h;
  }

  // Walk the grid directly (instead of sampling along the stairs' diagonal
  // axis) so every grid cell in the stair band gets exactly one top block.
  // Diagonal sampling missed cells and doubled others, leaving dirt holes
  // and jagged doubled edges where the stairs met the flat road tiles.
  for (let z = 0; z < tilesDeep; z++) {
    for (let x = 0; x < tilesWide; x++) {
      if (!isRampActive(x, z)) continue;
      if (isRoadBlock(x, z)) continue;
      const level = heightAt(x, z);
      // A step repainted via the in-game edit tools is drawn by the flat
      // road/grass ground tile system instead (buildPaintableTiles), at the
      // same height - skip the asphalt top here so the two don't overlap.
      if (tileTypeAt(x, z) === 'stair') topCells.push({ x, z, level });

      // Same interior-cube culling as the main terrain fill: a cube boxed in
      // by same-or-taller neighbors on all 4 sides is never visible.
      const minNeighbor = Math.min(
        heightAt(x, z - 1),
        heightAt(x, z + 1),
        heightAt(x + 1, z),
        heightAt(x - 1, z)
      );
      for (let y = 0; y < level; y++) {
        if (y < level - 1 && y < minNeighbor) continue;
        fillCells.push({ x, z, y });
      }
    }
  }

  // Same material and per-block colouring as the flat road tiles, so the
  // stairs read as the same road surface instead of a separate grey asphalt.
  const asphaltGeometry = new THREE.BoxGeometry(tileSize - 0.004, rampSurfaceThickness, tileSize - 0.004);
  const asphaltMesh = new THREE.InstancedMesh(asphaltGeometry, roadTileMaterial, topCells.length);
  asphaltMesh.name = 'BlockRampAsphaltTops';

  const fillMesh = new THREE.InstancedMesh(
    houseBlockGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 }),
    fillCells.length
  );
  fillMesh.name = 'BlockRampFilledBase';

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  topCells.forEach(({ x, z, level }, index) => {
    matrix.makeTranslation(
      worldXFromBlock(x + 0.5),
      level * tileSize + rampSurfaceThickness / 2,
      worldZFromBlock(z + 0.5)
    );
    asphaltMesh.setMatrixAt(index, matrix);

    const roadBase = 0.58 + ((x * 11 + z * 13) % 9) * 0.018;
    const warm = ((x + z) % 4) * 0.015;
    color.setRGB(roadBase + warm, roadBase * 0.96 + warm, roadBase * 0.90);
    asphaltMesh.setColorAt(index, color);
  });

  fillCells.forEach(({ x, z, y }, index) => {
    matrix.makeTranslation(
      worldXFromBlock(x + 0.5),
      tileSize / 2 + y * tileSize,
      worldZFromBlock(z + 0.5)
    );
    fillMesh.setMatrixAt(index, matrix);

    const dirtNoise = (((x * 11 + z * 5 + y * 19) % 9) - 4) * 0.016;
    const shade = THREE.MathUtils.clamp(0.72 + dirtNoise, 0.48, 0.80);
    if ((x + z + y) % 5 === 0) {
      color.setRGB(0.40 * shade, 0.40 * shade, 0.38 * shade);
    } else {
      color.setRGB(0.46 * shade, 0.32 * shade, 0.21 * shade);
    }
    fillMesh.setColorAt(index, color);
  });

  [asphaltMesh, fillMesh].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  return { asphaltMesh, fillMesh };
}

let blockRamp = null;
function buildBlockRamp() {
  if (blockRamp) {
    scene.remove(blockRamp.asphaltMesh);
    scene.remove(blockRamp.fillMesh);
  }
  blockRamp = createBlockRamp();
}
buildBlockRamp();

const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
const cube = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 10; i++) {
  const cloud = new THREE.Group();
  const pieces = 3 + (i % 3);
  for (let j = 0; j < pieces; j++) {
    const part = new THREE.Mesh(cube, cloudMaterial);
    part.scale.set(3.8 + (j % 2) * 2, 1.25, 2.2);
    part.position.set(j * 3.2 - pieces * 1.5, (j % 2) * 0.55, (j % 3) - 1);
    cloud.add(part);
  }
  cloud.position.set(-62 + i * 15, 20 + (i % 3) * 4, -55 + (i % 4) * 34);
  scene.add(cloud);
}

const materialCache = new Map();
function material(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 }));
  }
  return materialCache.get(color);
}

function boxPart(parent, name, size, position, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function voxelTile(parent, name, x, y, z, color, scale = 1) {
  return boxPart(parent, name, [0.036 * scale, 0.036 * scale, 0.026 * scale], [x, y, z], color);
}

// Fills a box region with small eye-sized cubes (one InstancedMesh per call,
// so block count goes way up without adding extra draw calls per cube).
function voxelBox(parent, name, size, position, color, voxelSize = 0.045) {
  const [sx, sy, sz] = size;
  const nx = Math.max(1, Math.round(sx / voxelSize));
  const ny = Math.max(1, Math.round(sy / voxelSize));
  const nz = Math.max(1, Math.round(sz / voxelSize));
  const cellX = sx / nx;
  const cellY = sy / ny;
  const cellZ = sz / nz;
  const geometry = new THREE.BoxGeometry(cellX * 0.94, cellY * 0.94, cellZ * 0.94);
  const mesh = new THREE.InstancedMesh(geometry, material(color), nx * ny * nz);
  mesh.name = name;
  mesh.position.set(...position);
  const startX = -sx / 2 + cellX / 2;
  const startY = -sy / 2 + cellY / 2;
  const startZ = -sz / 2 + cellZ / 2;
  let index = 0;
  for (let xi = 0; xi < nx; xi++) {
    for (let yi = 0; yi < ny; yi++) {
      for (let zi = 0; zi < nz; zi++) {
        voxelMatrix.makeTranslation(startX + xi * cellX, startY + yi * cellY, startZ + zi * cellZ);
        mesh.setMatrixAt(index++, voxelMatrix);
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const voxelMatrix = new THREE.Matrix4();

function makePlayer(type = 'rain') {
  const root = new THREE.Group();
  root.name = 'Player';
  const visual = new THREE.Group();
  root.add(visual);
  const isRescue = type === 'rescue';

  // Shared proportions (both characters use the same skeleton), palette swaps
  // per type. 'rain': yellow hooded raincoat. 'rescue': orange jumpsuit,
  // white hard-hat style helmet, black gloves/boots, reflective stripes.
  const primary = isRescue ? 0xe8641f : 0xe7ad08;
  const primaryLight = isRescue ? 0xff8a3d : 0xffca19;
  const primarySoft = isRescue ? 0xff9c52 : 0xf4bc10;
  const primaryDark = isRescue ? 0xb84c14 : 0xb77b05;
  const primaryShadow = isRescue ? 0x9c3f10 : 0x9f6904;
  const legPrimary = isRescue ? primary : 0x24405a;
  const legPrimaryLight = isRescue ? primaryLight : 0x30506e;
  const legPrimaryDark = isRescue ? primaryDark : 0x172a3d;
  const legPrimaryDarkest = isRescue ? 0x7a3a10 : 0x2b4c60;
  const skin = 0xf0b780;
  const skinShadow = 0xd99567;
  const hair = 0x4e3426;
  const hairLight = 0x6a4730;
  const bagDark = isRescue ? 0x2e3236 : 0x232b31;
  const bagMid = isRescue ? 0x454b50 : 0x3c4850;
  const bagDarker = isRescue ? 0x1a1d20 : 0x14191d;
  const bootColor = isRescue ? 0x1c1e22 : 0x262b30;
  const bootAccent = isRescue ? 0x2e3236 : 0x3f4b51;
  const zipperColor = isRescue ? 0x4a4d50 : 0xffdf55;
  const zipperPullColor = isRescue ? 0x33363a : 0x6f571c;
  const handColor = isRescue ? 0x1c1e22 : skin;
  const handShadow = isRescue ? 0x0f1113 : skinShadow;
  const stripeColor = 0xd9d6c8;
  const beltColor = 0x1c1e22;
  const metalColor = 0x9da6a8;
  const helmetColor = 0xf4f2ea;
  const helmetShadow = 0xd9d4c4;
  const helmetDark = 0xb8b2a0;
  const badgeColor = 0xe8641f;

  // Legs trimmed a bit further; hip/shoulder/head dropped by the same 0.075
  // so the shorter legs still meet the ground.
  const hipY = 0.55;
  const shoulderY = 0.90;
  const headY = 1.11;

  // Coat/jumpsuit: chest/back mass, wide shoulder yoke, hem, zipper and
  // pockets, plus raised panels/folds layered on top for depth.
  voxelBox(visual, 'coatMain', [0.42, 0.36, 0.28], [0, 0.75, 0.01], primary);
  voxelBox(visual, 'coatBack', [0.36, 0.30, 0.10], [0, 0.72, 0.15], primaryDark);
  voxelBox(visual, 'shoulderYoke', [0.50, 0.09, 0.30], [0, 0.905, 0.01], primaryLight);
  voxelBox(visual, 'shoulderBackLip', [0.42, 0.05, 0.08], [0, 0.925, 0.19], primaryDark);
  // Neck: bridges the gap between the head and shoulders so the head doesn't float.
  voxelBox(visual, 'neck', [0.16, 0.10, 0.18], [0, 0.955, -0.01], skin);
  voxelBox(visual, 'neckShadow', [0.18, 0.03, 0.20], [0, 0.90, -0.01], skinShadow);
  voxelBox(visual, 'collarFront', [0.16, 0.06, 0.05], [0, 0.91, -0.13], primaryDark);
  voxelBox(visual, 'collarDepth', [0.12, 0.05, 0.06], [0, 0.895, -0.165], primaryShadow);
  voxelBox(visual, 'zipper', [0.025, 0.34, 0.02], [0, 0.75, -0.145], zipperColor);
  voxelBox(visual, 'zipperPull', [0.03, 0.04, 0.018], [0.006, 0.60, -0.158], zipperPullColor);
  voxelBox(visual, 'coatChestPanel', [0.30, 0.20, 0.05], [0, 0.80, -0.155], primarySoft);
  voxelBox(visual, 'chestRaisedL', [0.09, 0.07, 0.04], [-0.08, 0.83, -0.175], primaryLight);
  voxelBox(visual, 'chestRaisedR', [0.09, 0.07, 0.04], [0.08, 0.83, -0.175], primary);
  voxelBox(visual, 'hem', [0.46, 0.07, 0.30], [0, 0.555, 0.02], primaryDark);
  voxelBox(visual, 'hemShadow', [0.48, 0.02, 0.31], [0, 0.518, 0.02], primaryShadow);
  voxelBox(visual, 'pocketL', [0.10, 0.07, 0.02], [-0.14, 0.65, -0.135], primaryDark);
  voxelBox(visual, 'pocketR', [0.10, 0.07, 0.02], [0.14, 0.65, -0.135], primaryDark);
  voxelBox(visual, 'pocketFlapL', [0.11, 0.02, 0.025], [-0.14, 0.685, -0.14], primarySoft);
  voxelBox(visual, 'pocketFlapR', [0.11, 0.02, 0.025], [0.14, 0.685, -0.14], primarySoft);
  voxelBox(visual, 'waistFoldL', [0.06, 0.16, 0.02], [-0.17, 0.62, -0.135], primaryShadow);
  voxelBox(visual, 'waistFoldR', [0.06, 0.16, 0.02], [0.17, 0.62, -0.135], primaryLight);
  voxelBox(visual, 'sideSeamL', [0.03, 0.28, 0.24], [-0.205, 0.71, 0.01], primaryShadow);
  voxelBox(visual, 'sideSeamR', [0.03, 0.28, 0.24], [0.205, 0.71, 0.01], primaryLight);
  voxelBox(visual, 'backCenterSeam', [0.03, 0.30, 0.02], [0, 0.72, 0.205], primaryShadow);

  if (isRescue) {
    // Reflective safety stripes and a utility belt over the jumpsuit.
    voxelBox(visual, 'stripeChestLower', [0.34, 0.045, 0.02], [0, 0.685, -0.155], stripeColor);
    voxelBox(visual, 'stripeChestUpper', [0.34, 0.045, 0.02], [0, 0.83, -0.155], stripeColor);
    voxelBox(visual, 'stripeBack', [0.30, 0.045, 0.02], [0, 0.76, 0.20], stripeColor);
    voxelBox(visual, 'belt', [0.44, 0.045, 0.29], [0, 0.615, 0.015], beltColor);
    voxelBox(visual, 'beltBuckle', [0.06, 0.05, 0.02], [0, 0.615, -0.145], metalColor);
  }

  // Gear pack, own group so straps/flap move as a unit with the torso.
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.75, 0.20);
  voxelBox(backpack, 'packMain', [0.32, 0.34, 0.16], [0, 0, 0.02], bagDark);
  voxelBox(backpack, 'packFlap', [0.26, 0.06, 0.17], [0, 0.155, 0.015], bagMid);
  voxelBox(backpack, 'packTopStep', [0.22, 0.035, 0.15], [0, 0.185, 0.005], bagMid);
  voxelBox(backpack, 'packPocket', [0.22, 0.12, 0.06], [0, -0.10, 0.06], bagDarker);
  voxelBox(backpack, 'packPocketFlap', [0.20, 0.03, 0.07], [0, -0.03, 0.075], bagMid);
  voxelBox(backpack, 'packBuckle', [0.035, 0.04, 0.025], [0, -0.06, 0.135], metalColor);
  voxelBox(backpack, 'packSideL', [0.05, 0.28, 0.15], [-0.17, -0.01, 0.02], bagDarker);
  voxelBox(backpack, 'packSideR', [0.05, 0.28, 0.15], [0.17, -0.01, 0.02], bagDarker);
  voxelBox(backpack, 'packBottom', [0.30, 0.04, 0.15], [0, -0.17, 0.02], bagDarker);
  voxelBox(backpack, 'packCenterRidge', [0.035, 0.30, 0.03], [0, 0, 0.105], bagMid);
  voxelBox(backpack, 'strapL', [0.05, 0.34, 0.035], [-0.135, 0.02, -0.16], bagDark);
  voxelBox(backpack, 'strapR', [0.05, 0.34, 0.035], [0.135, 0.02, -0.16], bagDark);
  voxelBox(backpack, 'strapHighlightL', [0.014, 0.28, 0.014], [-0.12, 0.03, -0.145], 0x455058);
  voxelBox(backpack, 'strapHighlightR', [0.014, 0.28, 0.014], [0.12, 0.03, -0.145], 0x455058);
  visual.add(backpack);

  // Head: hood (rain) or helmet (rescue), both with a forward brim, plus a
  // shared layered face, kept at true size (not stretched with the body).
  const head = voxelBox(visual, 'head', [0.30, 0.27, 0.31], [0, headY, -0.005], skin);
  if (isRescue) {
    voxelBox(head, 'helmetDome', [0.30, 0.09, 0.32], [0, 0.115, 0.02], helmetColor);
    voxelBox(head, 'helmetDomeTop', [0.20, 0.03, 0.22], [0, 0.175, 0.02], helmetShadow);
    voxelBox(head, 'helmetBack', [0.28, 0.16, 0.08], [0, 0.03, 0.16], helmetColor);
    voxelBox(head, 'helmetSideL', [0.05, 0.14, 0.28], [-0.155, 0.02, 0], helmetColor);
    voxelBox(head, 'helmetSideR', [0.05, 0.14, 0.28], [0.155, 0.02, 0], helmetColor);
    voxelBox(head, 'helmetBrim', [0.28, 0.03, 0.10], [0, 0.065, -0.195], helmetShadow);
    voxelBox(head, 'helmetBrimEdge', [0.30, 0.015, 0.03], [0, 0.05, -0.235], helmetDark);
    voxelBox(head, 'helmetBadge', [0.05, 0.05, 0.02], [0, 0.10, -0.185], badgeColor);
    voxelBox(head, 'helmetStrapL', [0.02, 0.10, 0.02], [-0.145, -0.06, -0.08], 0x2a2a2a);
    voxelBox(head, 'helmetStrapR', [0.02, 0.10, 0.02], [0.145, -0.06, -0.08], 0x2a2a2a);
  } else {
    voxelBox(head, 'hoodTop', [0.30, 0.10, 0.32], [0, 0.11, 0.02], primaryLight);
    voxelBox(head, 'hoodTopRidge', [0.06, 0.03, 0.30], [0, 0.165, 0.02], primarySoft);
    voxelBox(head, 'hoodBack', [0.30, 0.22, 0.10], [0, 0.02, 0.15], primaryDark);
    voxelBox(head, 'hoodBackBulge', [0.22, 0.12, 0.06], [0, -0.02, 0.21], primaryShadow);
    voxelBox(head, 'hoodSideL', [0.06, 0.22, 0.30], [-0.155, -0.01, 0], primary);
    voxelBox(head, 'hoodSideR', [0.06, 0.22, 0.30], [0.155, -0.01, 0], primary);
    voxelBox(head, 'hoodTempleL', [0.045, 0.06, 0.045], [-0.135, -0.05, -0.145], primaryDark);
    voxelBox(head, 'hoodTempleR', [0.045, 0.06, 0.045], [0.135, -0.05, -0.145], primaryDark);
    voxelBox(head, 'hoodCheekL', [0.035, 0.09, 0.035], [-0.145, -0.03, -0.13], primaryShadow);
    voxelBox(head, 'hoodCheekR', [0.035, 0.09, 0.035], [0.145, -0.03, -0.13], primary);
    voxelBox(head, 'hoodFrontRim', [0.26, 0.05, 0.05], [0, 0.11, -0.14], primaryDark);
    voxelBox(head, 'hoodBrim', [0.24, 0.035, 0.09], [0, 0.075, -0.185], primaryDark);
  }
  voxelBox(head, 'faceBase', [0.24, 0.22, 0.06], [0, -0.03, -0.15], skin);
  voxelBox(head, 'hairFringe', [0.20, 0.06, 0.05], [0, 0.05, -0.15], hair);
  voxelBox(head, 'fringeSideL', [0.045, 0.045, 0.04], [-0.085, 0.035, -0.165], hairLight);
  voxelBox(head, 'fringeSideR', [0.045, 0.045, 0.04], [0.085, 0.045, -0.165], hair);
  voxelBox(head, 'browL', [0.06, 0.02, 0.03], [-0.06, 0.02, -0.17], hair);
  voxelBox(head, 'browR', [0.06, 0.02, 0.03], [0.06, 0.02, -0.17], hair);
  voxelBox(head, 'browShadowL', [0.06, 0.012, 0.02], [-0.06, 0.005, -0.175], skinShadow);
  voxelBox(head, 'browShadowR', [0.06, 0.012, 0.02], [0.06, 0.005, -0.175], skinShadow);
  voxelBox(head, 'eyeL', [0.045, 0.045, 0.02], [-0.06, -0.02, -0.18], 0x253342);
  voxelBox(head, 'eyeR', [0.045, 0.045, 0.02], [0.06, -0.02, -0.18], 0x253342);
  voxelBox(head, 'eyeGlintL', [0.012, 0.012, 0.01], [-0.068, -0.012, -0.19], 0xffffff);
  voxelBox(head, 'eyeGlintR', [0.012, 0.012, 0.01], [0.052, -0.012, -0.19], 0xffffff);
  voxelBox(head, 'nose', [0.03, 0.04, 0.03], [0, -0.05, -0.19], 0xe2a272);
  voxelBox(head, 'noseHighlight', [0.012, 0.014, 0.01], [-0.006, -0.045, -0.205], 0xf6c090);
  voxelBox(head, 'mouth', [0.06, 0.02, 0.02], [0, -0.09, -0.18], 0x7d3530);
  voxelBox(head, 'chin', [0.10, 0.03, 0.04], [0, -0.12, -0.16], skinShadow);
  voxelBox(head, 'jawShadeL', [0.05, 0.03, 0.03], [-0.10, -0.13, -0.15], skinShadow);
  voxelBox(head, 'jawShadeR', [0.05, 0.03, 0.03], [0.10, -0.13, -0.15], skinShadow);

  // Articulated arms and legs, each a Group pivoting from the shoulder/hip joint.
  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.245, shoulderY, 0);
    voxelBox(arm, 'shoulderCap', [0.16, 0.06, 0.19], [0, 0.005, 0], primaryDark);
    voxelBox(arm, 'shoulderHighlight', [0.08, 0.03, 0.15], [side * 0.015, 0.03, -0.01], primarySoft);
    voxelBox(arm, 'upperSleeve', [0.15, 0.20, 0.17], [0, -0.10, 0], primaryLight);
    if (isRescue) voxelBox(arm, 'stripeArm', [0.09, 0.03, 0.01], [0, -0.02, -0.09], stripeColor);
    voxelBox(arm, 'elbowTile', [0.10, 0.035, 0.03], [0, -0.195, 0.075], primaryDark);
    voxelBox(arm, 'lowerSleeve', [0.13, 0.18, 0.15], [0, -0.29, 0], primary);
    voxelBox(arm, 'cuffShadow', [0.11, 0.015, 0.13], [0, -0.375, 0], primaryShadow);
    voxelBox(arm, 'cuff', [0.135, 0.05, 0.155], [0, -0.40, 0], primaryDark);
    voxelBox(arm, 'hand', [0.11, 0.10, 0.13], [0, -0.46, -0.01], handColor);
    voxelBox(arm, 'fingerA', [0.02, 0.035, 0.02], [-0.025, -0.50, -0.03], handShadow);
    voxelBox(arm, 'fingerB', [0.02, 0.038, 0.02], [0, -0.505, -0.032], handColor);
    voxelBox(arm, 'fingerC', [0.02, 0.033, 0.02], [0.025, -0.50, -0.03], handShadow);
    visual.add(arm);
    return arm;
  }

  function makeLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.10, hipY, 0);
    leg.scale.y = 0.764;
    voxelBox(leg, 'thigh', [0.20, 0.26, 0.20], [0, -0.13, 0], legPrimary);
    voxelBox(leg, 'sideTrouserFold', [0.03, 0.14, 0.17], [side * 0.075, -0.15, 0], legPrimaryLight);
    voxelBox(leg, 'knee', [0.11, 0.05, 0.02], [0, -0.155, -0.10], legPrimaryDarkest);
    voxelBox(leg, 'shin', [0.16, 0.28, 0.17], [0, -0.40, 0.01], legPrimaryDark);
    voxelBox(leg, 'legFrontFacet', [0.09, 0.09, 0.03], [0, -0.21, -0.11], legPrimaryLight);
    voxelBox(leg, 'ankleBlock', [0.13, 0.035, 0.18], [0, -0.285, 0.02], legPrimaryDark);
    voxelBox(leg, 'boot', [0.20, 0.16, 0.26], [0, -0.62, -0.02], bootColor);
    voxelBox(leg, 'bootToe', [0.15, 0.045, 0.05], [0, -0.315, -0.135], bootAccent);
    voxelBox(leg, 'bootBand', [0.165, 0.02, 0.23], [0, -0.335, -0.025], metalColor);
    voxelBox(leg, 'bootSideDark', [0.04, 0.06, 0.19], [side * 0.075, -0.32, -0.02], 0x11181d);
    voxelBox(leg, 'bootSole', [0.20, 0.03, 0.26], [0, -0.705, -0.02], bagDarker);
    visual.add(leg);
    return leg;
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  root.userData = { visual, leftArm, rightArm, leftLeg, rightLeg };
  root.rotation.y = 0;
  return root;
}

let currentCharacterType = 'rain';
let player = makePlayer(currentCharacterType);
player.position.set(startX, 0, startZ);
scene.add(player);
let characterChosen = false;

function disposeObject(object) {
  object.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
  });
}

function selectCharacter(type) {
  if (type !== currentCharacterType) {
    const prevPosition = player.position.clone();
    const prevRotationY = player.rotation.y;
    scene.remove(player);
    disposeObject(player);
    player = makePlayer(type);
    player.position.copy(prevPosition);
    player.rotation.y = prevRotationY;
    scene.add(player);
    currentCharacterType = type;
  }
  characterChosen = true;
  characterSelect.classList.add('is-hidden');
}

characterCards.forEach((card) => {
  card.addEventListener('click', () => selectCharacter(card.dataset.character));
});

const keys = new Set();
// keydown re-fires on the browser's key-repeat timer for as long as a key is
// genuinely held down. Tracking when each key was last (re-)pressed lets us
// self-heal a "stuck" key whose keyup got missed - e.g. a synchronous
// confirm() dialog, or focus moving to a button/checkbox mid-press, can
// swallow it - instead of the character walking forever with no way to stop.
const keyLastSeen = new Map();
// OS keyboard-repeat delay/rate settings vary a lot (Windows alone allows the
// initial delay to be set close to 1s, before repeats even start), so 800ms
// was too tight and occasionally pruned a key that was still genuinely held,
// stopping the character mid-walk. This only needs to be well above the
// slowest realistic repeat interval - being slow to self-heal a truly stuck
// key is a much smaller problem than cutting off a real key-hold.
const STUCK_KEY_TIMEOUT_MS = 2500;
function pruneStaleKeys(now) {
  for (const code of keys) {
    const lastSeen = keyLastSeen.get(code);
    if (lastSeen === undefined || now - lastSeen > STUCK_KEY_TIMEOUT_MS) {
      keys.delete(code);
      keyLastSeen.delete(code);
    }
  }
}
let cameraYaw = 0;
let cameraPitch = 0.32;
const cameraPitchMin = -0.38;
const cameraPitchMax = 1.48;
let cameraDistance = 3.6;
let dragging = false;
let walkTime = 0;
let lastTime = performance.now();
let verticalVelocity = 0;
const gravity = 9.8;
const jumpVelocity = Math.sqrt(2 * gravity * tileSize * 2.35);
const moveDirection = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();

addEventListener('keydown', (event) => {
  // Esc backs out one level at a time: first an in-progress range selection,
  // then a selected building, and finally edit mode itself. Checked ahead of
  // the characterChosen guard so it still works if edit mode was opened from
  // the character-select screen.
  if (editMode && event.code === 'Escape') {
    event.preventDefault();
    if (rangeStage !== 0) resetRangeSelection();
    else if (selectedStructure) deselectStructure();
    else setEditMode(false);
    return;
  }

  if (!characterChosen) return;

  // While a building is selected in edit mode, WASD nudges the building
  // instead of walking the player. Ctrl+Z/Y are deliberately left to fall
  // through to the shared undo/redo handler.
  if (editMode && selectedStructure && !event.ctrlKey && !event.metaKey) {
    // [forward, side], resolved against the camera by moveSelectedStructure.
    const nudge = {
      KeyW: [1, 0], ArrowUp: [1, 0],
      KeyS: [-1, 0], ArrowDown: [-1, 0],
      KeyA: [0, -1], ArrowLeft: [0, -1],
      KeyD: [0, 1], ArrowRight: [0, 1]
    }[event.code];
    if (nudge) {
      event.preventDefault();
      moveSelectedStructure(nudge[0], nudge[1]);
      return;
    }
  }

  keys.add(event.code);
  keyLastSeen.set(event.code, performance.now());
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
    guide.classList.add('is-hidden');
  }
  if (event.code === 'Space') {
    event.preventDefault();
    guide.classList.add('is-hidden');
    const groundHeight = getWalkableHeight(player.position.x, player.position.z);
    const grounded = Math.abs(player.position.y - groundHeight) < 0.035 && verticalVelocity <= 0;
    if (grounded) verticalVelocity = jumpVelocity;
  }
});
addEventListener('keyup', (event) => {
  keys.delete(event.code);
  keyLastSeen.delete(event.code);
});

// If the window/tab loses focus while a movement key is held down (alt-tab,
// clicking a browser dialog, switching tabs, dragging outside the canvas...)
// the corresponding keyup never fires, so the key would stay stuck "held"
// forever and the character keeps walking on its own. Clear all held keys
// whenever we can no longer be sure we'll see the matching keyup.
function releaseAllKeys() {
  keys.clear();
  keyLastSeen.clear();
}
addEventListener('blur', releaseAllKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllKeys();
});

// --- Tile paint edit mode -------------------------------------------------
// Toggled from the "編集モード" button. While active: left click / drag paints
// road or grass onto the field; right-button drag rotates the camera.
let editMode = false;
let painting = false;
let paintDirty = false;
const paintRaycaster = new THREE.Raycaster();
const paintPointer = new THREE.Vector2();

function savePaintOverrides() {
  try {
    localStorage.setItem(PAINT_STORAGE_KEY, JSON.stringify([...tilePaintOverrides]));
    localStorage.setItem(HEIGHT_STORAGE_KEY, JSON.stringify([...heightPaintOverrides]));
    localStorage.setItem(FLOATING_STORAGE_KEY, JSON.stringify([...floatingBlocks]));
  } catch (error) {
    console.warn('Could not save paint overrides:', error);
  }
}

let heightDirty = false;
let floatingDirty = false;

// Undo/redo history. Each entry in the stack is a "batch" (everything one
// click/drag stroke or one クリア changed): a list of
// { map: 'tile' | 'height' | 'floating', key, before, after }, where
// before/after of `undefined` means the key was absent (i.e. undo/redo
// deletes it).
// Building moves also live here, as { map: 'structure', key: <index into
// movableStructures>, before/after: { x, z } block offsets } - those are
// absolute offsets rather than map entries, so applyBatch routes them to
// applyStructureChange instead of an override Map.
const undoStack = [];
const redoStack = [];
const overrideMaps = { tile: tilePaintOverrides, height: heightPaintOverrides, floating: floatingBlocks };

function recordChange(batch, mapName, key, before, after) {
  if (before === after) return;
  batch.push({ map: mapName, key, before, after });
}

function pushHistory(batch) {
  if (!batch.length) return;
  undoStack.push(batch);
  redoStack.length = 0;
}

function applyBatch(batch, useAfter) {
  let touchedOverrides = false;
  for (const change of batch) {
    const value = useAfter ? change.after : change.before;
    if (change.map === 'structure') {
      applyStructureChange(change.key, value);
      continue;
    }
    touchedOverrides = true;
    const map = overrideMaps[change.map];
    if (value === undefined) map.delete(change.key);
    else map.set(change.key, value);
  }
  // Structure moves don't touch the terrain/tile data, so skip the (fairly
  // expensive) full terrain rebuild when a batch only moved buildings.
  if (!touchedOverrides) return;
  heightDirty = true;
  paintDirty = true;
  floatingDirty = true;
}

function undo() {
  const batch = undoStack.pop();
  if (!batch) return;
  applyBatch(batch, false);
  redoStack.push(batch);
}

function redo() {
  const batch = redoStack.pop();
  if (!batch) return;
  applyBatch(batch, true);
  undoStack.push(batch);
}

// Two independent axes: what the click targets (the ground tile's material,
// or the block/height column beneath it) and, within "block", whether to
// build or remove. The material group is shared by both targets so future
// materials only need to be added in one place.
function stampMaterial(x, z, material, batch) {
  const base = baseTileType(x, z);
  if (base === 'river') return false;
  const key = x + ',' + z;
  const before = tilePaintOverrides.get(key);
  const after = material === base ? undefined : material;
  if (after === undefined) tilePaintOverrides.delete(key);
  else tilePaintOverrides.set(key, after);
  recordChange(batch, 'tile', key, before, after);
  return before !== after;
}

function paintAt(clientX, clientY) {
  paintPointer.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  paintRaycaster.setFromCamera(paintPointer, camera);
  const hits = paintRaycaster.intersectObject(field, true);
  if (!hits.length) return;
  const point = hits[0].point;
  const centerX = Math.floor(blockXFromWorld(point.x));
  const centerZ = Math.floor(blockZFromWorld(point.z));
  const target = document.querySelector('input[name="editTarget"]:checked').value;
  const action = document.querySelector('input[name="paintAction"]:checked').value;
  const material = document.querySelector('input[name="paintMaterial"]:checked').value;
  const half = Math.floor(parseInt(brushSizeSelect.value, 10) / 2);
  const batch = [];
  let changed = false;

  if (target === 'block') {
    const step = action === 'build' ? 1 : -1;
    for (let dz = -half; dz <= half; dz++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = centerX + dx;
        const z = centerZ + dz;
        if (x < 0 || x >= tilesWide || z < 0 || z >= tilesDeep) continue;
        if (isRiverBlock(x, z) || isRampActive(x, z)) continue;
        const key = x + ',' + z;
        const before = heightPaintOverrides.get(key) || 0;
        const base = getBaseTerrainHeightBlocks(x, z);
        const afterValue = THREE.MathUtils.clamp(before + step, -base, 40 - base);
        const after = afterValue === 0 ? undefined : afterValue;
        if (after === undefined) heightPaintOverrides.delete(key);
        else heightPaintOverrides.set(key, after);
        const beforeRecorded = before === 0 ? undefined : before;
        recordChange(batch, 'height', key, beforeRecorded, after);
        if (beforeRecorded !== after) changed = true;
        if (action === 'build' && stampMaterial(x, z, material, batch)) changed = true;
      }
    }
    if (changed) { heightDirty = true; paintDirty = true; }
    pushHistory(batch);
    return;
  }

  for (let dz = -half; dz <= half; dz++) {
    for (let dx = -half; dx <= half; dx++) {
      const x = centerX + dx;
      const z = centerZ + dz;
      if (x < 0 || x >= tilesWide || z < 0 || z >= tilesDeep) continue;
      if (stampMaterial(x, z, material, batch)) changed = true;
    }
  }
  if (changed) paintDirty = true;
  pushHistory(batch);
}

function applyPaintIfDirty() {
  if (!paintDirty && !heightDirty && !floatingDirty) return;
  paintDirty = false;
  heightDirty = false;
  if (floatingDirty) {
    floatingDirty = false;
    buildFloatingBlocks();
  }
  buildTerrainFillBlocks();
  buildPaintableTiles();
  buildBlockRamp();
  updateTufts();
  savePaintOverrides();
}

// --- Range select + place -------------------------------------------------
// A second way to build, alongside single-tile/brush painting above. Two
// steps: (1) drag a rectangle on the ground to pick the X/Z footprint, block
// by block, (2) drag up/down to pick how tall the fill should be. Once both
// are set, every click stamps that whole box with the current material at
// that exact height. Right-drag still orbits the camera throughout, since
// that's handled by the generic pointerdown/move fallback below.
function currentEditTarget() {
  return document.querySelector('input[name="editTarget"]:checked').value;
}

function currentRangeAction() {
  return document.querySelector('input[name="rangeAction"]:checked').value;
}

// Floating slabs (detached from the ground) render as simple solid boxes
// outside the `field` group, so they never interfere with the ground-only
// raycasting used to pick the X/Z footprint.
const floatingBlocksMeshGroup = new THREE.Group();
floatingBlocksMeshGroup.name = 'FloatingRangeBlocks';
scene.add(floatingBlocksMeshGroup);
const FLOATING_MATERIAL_COLORS = { road: 0x9a958c, grass: 0x5fae4a };

function buildFloatingBlocks() {
  while (floatingBlocksMeshGroup.children.length) {
    const mesh = floatingBlocksMeshGroup.children.pop();
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  for (const [, entry] of floatingBlocks) {
    const width = (entry.maxX - entry.minX + 1) * tileSize;
    const depth = (entry.maxZ - entry.minZ + 1) * tileSize;
    const height = (entry.top - entry.bottom) * tileSize;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: FLOATING_MATERIAL_COLORS[entry.material] || 0xffffff,
        roughness: 0.85
      })
    );
    mesh.position.set(
      worldXFromBlock(entry.minX) + width / 2,
      entry.bottom * tileSize + height / 2,
      worldZFromBlock(entry.minZ) + depth / 2
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    floatingBlocksMeshGroup.add(mesh);
  }
}
buildFloatingBlocks();

let rangeStage = 0; // 0 = pick X/Z footprint, 1 = pick height, 2 = ready to place
let rangeDragging = false;
let rangeAnchorX = 0;
let rangeAnchorZ = 0;
let rangeMinX = 0;
let rangeMaxX = 0;
let rangeMinZ = 0;
let rangeMaxZ = 0;
let rangeHeight = 1;
let rangeYAnchorScreenY = 0;
let rangeYAnchorHeight = 1;
// 'block': the existing 2-stage build flow (footprint, then height).
// 'tile': footprint only - repaints the ground material (road/grass) over
// the selected area, exactly like the single-tile brush but for a whole
// rectangle at once, with no height stage. Latched from the radio when the
// footprint is confirmed, so switching modes mid-drag can't change what's
// about to be applied.
let rangeMode = 'block';
// Floating mode: the drag moves the whole fixed-thickness slab through the
// air instead of extruding up from the ground. rangeIsFloating is latched
// from the checkbox when the footprint is confirmed, so toggling the
// checkbox mid-drag can't change what's about to be placed.
let rangeIsFloating = false;
let rangeFloatBottom = 0;
const RANGE_FLOAT_THICKNESS = 1;
const RANGE_MAX_HEIGHT = 40;
const RANGE_DRAG_PIXELS_PER_BLOCK = 18;

// depthTest is disabled and renderOrder is high so the highlight always draws
// on top of terrain/blocks instead of getting buried inside them - the box's
// footprint can sit level with or below the surrounding ground, so relying on
// normal depth testing would hide most of it.
const rangeBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
const rangeBoxHelper = new THREE.Group();
const rangeBoxFill = new THREE.Mesh(
  rangeBoxGeometry,
  new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.28,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide
  })
);
const rangeBoxWire = new THREE.LineSegments(
  new THREE.EdgesGeometry(rangeBoxGeometry),
  new THREE.LineBasicMaterial({ color: 0xfff3c4, depthTest: false, linewidth: 2 })
);
rangeBoxFill.renderOrder = 999;
rangeBoxWire.renderOrder = 1000;
rangeBoxHelper.add(rangeBoxFill, rangeBoxWire);
rangeBoxHelper.visible = false;
scene.add(rangeBoxHelper);

function rangeBlockFromClient(clientX, clientY) {
  paintPointer.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  paintRaycaster.setFromCamera(paintPointer, camera);
  const hits = paintRaycaster.intersectObject(field, true);
  if (!hits.length) return null;
  const point = hits[0].point;
  return {
    x: THREE.MathUtils.clamp(Math.floor(blockXFromWorld(point.x)), 0, tilesWide - 1),
    z: THREE.MathUtils.clamp(Math.floor(blockZFromWorld(point.z)), 0, tilesDeep - 1)
  };
}

// The ground is rarely flat (ramps, the spawn plateau, riverbanks...), so the
// highlight has to sit on the actual terrain surface under the selection -
// not at a fixed y=0 - or it visibly drifts away from the cursor on sloped
// ground. Sampling the corners + center is cheap and close enough even for
// a selection spanning much of the map.
function sampledGroundHeightBlocks(minX, maxX, minZ, maxZ) {
  const xs = [minX, maxX, Math.round((minX + maxX) / 2)];
  const zs = [minZ, maxZ, Math.round((minZ + maxZ) / 2)];
  let maxHeight = 0;
  for (const x of xs) {
    for (const z of zs) {
      const bx = THREE.MathUtils.clamp(x, 0, tilesWide - 1);
      const bz = THREE.MathUtils.clamp(z, 0, tilesDeep - 1);
      maxHeight = Math.max(maxHeight, getTerrainHeightBlocks(bx, bz));
    }
  }
  return maxHeight;
}

function applyRangeBoxTransform(bottomBlocks, topBlocks) {
  const width = (rangeMaxX - rangeMinX + 1) * tileSize;
  const depth = (rangeMaxZ - rangeMinZ + 1) * tileSize;
  const bottom = bottomBlocks * tileSize;
  const height = (topBlocks - bottomBlocks) * tileSize;
  rangeBoxHelper.scale.set(width, height, depth);
  rangeBoxHelper.position.set(
    worldXFromBlock(rangeMinX) + width / 2,
    bottom + height / 2,
    worldZFromBlock(rangeMinZ) + depth / 2
  );
  rangeBoxHelper.visible = true;
}

// Stage 0 (still picking the footprint): a thin marker hugging the ground.
function updateRangeFootprintPreview() {
  const groundBlocks = sampledGroundHeightBlocks(rangeMinX, rangeMaxX, rangeMinZ, rangeMaxZ);
  applyRangeBoxTransform(groundBlocks, groundBlocks + 0.06);
}

// Stage 1+ (picking/confirmed height): extrude from the ground up to the
// chosen absolute height (or down, if the target is below the surface).
function updateRangeHeightPreview(topBlocks) {
  const groundBlocks = sampledGroundHeightBlocks(rangeMinX, rangeMaxX, rangeMinZ, rangeMaxZ);
  const bottomBlocks = Math.min(groundBlocks, topBlocks);
  const clampedTop = Math.max(topBlocks, bottomBlocks + 0.06);
  applyRangeBoxTransform(bottomBlocks, clampedTop);
}

// Floating mode: the box never touches the ground, so its bottom/top are
// exactly what was dragged - no clamping against terrain height.
function updateRangeFloatingPreview(bottomBlocks, topBlocks) {
  applyRangeBoxTransform(bottomBlocks, topBlocks);
}

function setRangeStatus(text) {
  if (rangeStatus) rangeStatus.textContent = text;
}

function resetRangeSelection() {
  rangeStage = 0;
  rangeDragging = false;
  rangeBoxHelper.visible = false;
  setRangeStatus('左クリックしたまま範囲の対角までドラッグしてください');
}

function placeRangeBlocks() {
  const material = document.querySelector('input[name="paintMaterial"]:checked').value;

  if (rangeIsFloating) {
    const key = String(floatingBlockSeq++);
    const descriptor = {
      minX: rangeMinX, maxX: rangeMaxX, minZ: rangeMinZ, maxZ: rangeMaxZ,
      bottom: rangeFloatBottom, top: rangeHeight, material
    };
    floatingBlocks.set(key, descriptor);
    floatingDirty = true;
    pushHistory([{ map: 'floating', key, before: undefined, after: descriptor }]);
    setRangeStatus(`高さ ${rangeFloatBottom}〜${rangeHeight} ブロックの空中に配置しました。続けて配置するか「選択をやり直す」で範囲を選び直せます`);
    return;
  }

  const batch = [];
  let changed = false;
  for (let z = rangeMinZ; z <= rangeMaxZ; z++) {
    for (let x = rangeMinX; x <= rangeMaxX; x++) {
      if (isRiverBlock(x, z) || isRampActive(x, z)) continue;
      const key = x + ',' + z;
      const before = heightPaintOverrides.get(key) || 0;
      const base = getBaseTerrainHeightBlocks(x, z);
      const afterValue = THREE.MathUtils.clamp(rangeHeight - base, -base, 40 - base);
      const after = afterValue === 0 ? undefined : afterValue;
      if (after === undefined) heightPaintOverrides.delete(key);
      else heightPaintOverrides.set(key, after);
      const beforeRecorded = before === 0 ? undefined : before;
      recordChange(batch, 'height', key, beforeRecorded, after);
      if (beforeRecorded !== after) changed = true;
      if (stampMaterial(x, z, material, batch)) changed = true;
    }
  }
  if (changed) { heightDirty = true; paintDirty = true; }
  pushHistory(batch);
  setRangeStatus(`高さ ${rangeHeight} ブロックで配置しました。続けて配置するか「選択をやり直す」で範囲を選び直せます`);
}

// Repaints the ground material only (road/grass), leaving height untouched -
// the range-select equivalent of the single-tile brush.
function placeRangeTiles() {
  const material = document.querySelector('input[name="paintMaterial"]:checked').value;
  const batch = [];
  let changed = false;
  for (let z = rangeMinZ; z <= rangeMaxZ; z++) {
    for (let x = rangeMinX; x <= rangeMaxX; x++) {
      if (stampMaterial(x, z, material, batch)) changed = true;
    }
  }
  if (changed) paintDirty = true;
  pushHistory(batch);
  setRangeStatus('タイルを変更しました。続けて変更するか「選択をやり直す」で範囲を選び直せます');
}

function handleRangePointerDown(event) {
  if (rangeStage === 0) {
    const block = rangeBlockFromClient(event.clientX, event.clientY);
    if (!block) return;
    rangeDragging = true;
    rangeAnchorX = block.x;
    rangeAnchorZ = block.z;
    rangeMinX = rangeMaxX = block.x;
    rangeMinZ = rangeMaxZ = block.z;
    updateRangeFootprintPreview();
    setRangeStatus(currentRangeAction() === 'tile'
      ? 'ドラッグして範囲を決め、指を離すと確定します'
      : 'ドラッグして範囲を決め、指を離すと高さ選択に進みます');
    return;
  }
  if (rangeStage === 1) {
    rangeDragging = true;
    rangeYAnchorScreenY = event.clientY;
    rangeYAnchorHeight = rangeIsFloating ? rangeFloatBottom : rangeHeight;
    setRangeStatus(rangeIsFloating
      ? `高さ: ${rangeFloatBottom}〜${rangeHeight} ブロック（上下ドラッグで空間ごと移動、離すと確定）`
      : `高さ: ${rangeHeight} ブロック（上下ドラッグで調整、離すと確定）`);
    return;
  }
  if (rangeStage === 2) {
    if (rangeMode === 'tile') placeRangeTiles();
    else placeRangeBlocks();
  }
}

function handleRangePointerMove(event) {
  if (!rangeDragging) return;
  if (rangeStage === 0) {
    const block = rangeBlockFromClient(event.clientX, event.clientY);
    if (!block) return;
    rangeMinX = Math.min(rangeAnchorX, block.x);
    rangeMaxX = Math.max(rangeAnchorX, block.x);
    rangeMinZ = Math.min(rangeAnchorZ, block.z);
    rangeMaxZ = Math.max(rangeAnchorZ, block.z);
    updateRangeFootprintPreview();
    return;
  }
  if (rangeStage === 1) {
    const deltaBlocks = Math.round((rangeYAnchorScreenY - event.clientY) / RANGE_DRAG_PIXELS_PER_BLOCK);
    if (rangeIsFloating) {
      rangeFloatBottom = THREE.MathUtils.clamp(rangeYAnchorHeight + deltaBlocks, 0, RANGE_MAX_HEIGHT - RANGE_FLOAT_THICKNESS);
      rangeHeight = rangeFloatBottom + RANGE_FLOAT_THICKNESS;
      updateRangeFloatingPreview(rangeFloatBottom, rangeHeight);
      setRangeStatus(`高さ: ${rangeFloatBottom}〜${rangeHeight} ブロック（上下ドラッグで空間ごと移動、離すと確定）`);
    } else {
      rangeHeight = THREE.MathUtils.clamp(rangeYAnchorHeight + deltaBlocks, 1, RANGE_MAX_HEIGHT);
      updateRangeHeightPreview(rangeHeight);
      setRangeStatus(`高さ: ${rangeHeight} ブロック（上下ドラッグで調整、離すと確定）`);
    }
  }
}

function handleRangePointerUp() {
  if (!rangeDragging) return;
  rangeDragging = false;
  if (rangeStage === 0) {
    rangeMode = currentRangeAction();
    if (rangeMode === 'tile') {
      // Tile mode has no height stage - the footprint IS the final selection.
      rangeStage = 2;
      updateRangeFootprintPreview();
      setRangeStatus('クリックでこの範囲のタイルを変更します');
      return;
    }
    rangeStage = 1;
    const groundBlocks = sampledGroundHeightBlocks(rangeMinX, rangeMaxX, rangeMinZ, rangeMaxZ);
    rangeIsFloating = !!rangeFloatToggle && rangeFloatToggle.checked;
    if (rangeIsFloating) {
      rangeFloatBottom = THREE.MathUtils.clamp(groundBlocks + 3, 0, RANGE_MAX_HEIGHT - RANGE_FLOAT_THICKNESS);
      rangeHeight = rangeFloatBottom + RANGE_FLOAT_THICKNESS;
      updateRangeFloatingPreview(rangeFloatBottom, rangeHeight);
      setRangeStatus('クリックしたまま上下にドラッグして、空中に浮かせる高さを決めてください');
    } else {
      rangeHeight = THREE.MathUtils.clamp(groundBlocks + 1, 1, RANGE_MAX_HEIGHT);
      updateRangeHeightPreview(rangeHeight);
      setRangeStatus('クリックしたまま上下にドラッグして高さを決めてください');
    }
  } else if (rangeStage === 1) {
    rangeStage = 2;
    setRangeStatus(rangeIsFloating
      ? `高さ ${rangeFloatBottom}〜${rangeHeight} ブロックで確定。クリックでこの空間にブロックを配置します`
      : `高さ ${rangeHeight} ブロックで確定。クリックでこの空間にブロックを配置します`);
  }
}

rangeResetButton.addEventListener('click', resetRangeSelection);
// --------------------------------------------------------------------------

// --- Brush hover highlight -------------------------------------------------
// Shows which tile(s)/block column(s) a click would affect for the "タイル"
// and "ブロック" edit targets (range-select already has its own highlight).
// Same depthTest:false trick as the range box so it never gets buried under
// terrain on sloped ground.
const BRUSH_HIGHLIGHT_COLOR = 0xffd23f;
const BRUSH_HIGHLIGHT_WIRE_COLOR = 0xfff3c4;
const BRUSH_HIGHLIGHT_REMOVE_COLOR = 0xff5c4d;
const BRUSH_HIGHLIGHT_REMOVE_WIRE_COLOR = 0xffd6ce;
const brushHighlightGeometry = new THREE.BoxGeometry(1, 1, 1);
const brushHighlightGroup = new THREE.Group();
const brushHighlightFill = new THREE.Mesh(
  brushHighlightGeometry,
  new THREE.MeshBasicMaterial({
    color: BRUSH_HIGHLIGHT_COLOR, transparent: true, opacity: 0.32,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide
  })
);
const brushHighlightWire = new THREE.LineSegments(
  new THREE.EdgesGeometry(brushHighlightGeometry),
  new THREE.LineBasicMaterial({ color: BRUSH_HIGHLIGHT_WIRE_COLOR, depthTest: false })
);
brushHighlightFill.renderOrder = 999;
brushHighlightWire.renderOrder = 1000;
brushHighlightGroup.add(brushHighlightFill, brushHighlightWire);
brushHighlightGroup.visible = false;
scene.add(brushHighlightGroup);

function hideBrushHighlight() {
  brushHighlightGroup.visible = false;
}

function updateBrushHighlight(clientX, clientY) {
  if (!editMode) return hideBrushHighlight();
  const target = currentEditTarget();
  if (target !== 'tile' && target !== 'block') return hideBrushHighlight();

  paintPointer.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  paintRaycaster.setFromCamera(paintPointer, camera);
  const hits = paintRaycaster.intersectObject(field, true);
  if (!hits.length) return hideBrushHighlight();

  const point = hits[0].point;
  const centerX = Math.floor(blockXFromWorld(point.x));
  const centerZ = Math.floor(blockZFromWorld(point.z));
  const half = Math.floor(parseInt(brushSizeSelect.value, 10) / 2);
  const minX = THREE.MathUtils.clamp(centerX - half, 0, tilesWide - 1);
  const maxX = THREE.MathUtils.clamp(centerX + half, 0, tilesWide - 1);
  const minZ = THREE.MathUtils.clamp(centerZ - half, 0, tilesDeep - 1);
  const maxZ = THREE.MathUtils.clamp(centerZ + half, 0, tilesDeep - 1);

  const groundBlocks = sampledGroundHeightBlocks(minX, maxX, minZ, maxZ);
  const width = (maxX - minX + 1) * tileSize;
  const depth = (maxZ - minZ + 1) * tileSize;
  const height = 0.06 * tileSize;
  brushHighlightGroup.scale.set(width, height, depth);
  brushHighlightGroup.position.set(
    worldXFromBlock(minX) + width / 2,
    groundBlocks * tileSize + height / 2,
    worldZFromBlock(minZ) + depth / 2
  );

  const isRemove = target === 'block'
    && document.querySelector('input[name="paintAction"]:checked').value === 'remove';
  brushHighlightFill.material.color.setHex(isRemove ? BRUSH_HIGHLIGHT_REMOVE_COLOR : BRUSH_HIGHLIGHT_COLOR);
  brushHighlightWire.material.color.setHex(isRemove ? BRUSH_HIGHLIGHT_REMOVE_WIRE_COLOR : BRUSH_HIGHLIGHT_WIRE_COLOR);
  brushHighlightGroup.visible = true;
}
// --------------------------------------------------------------------------

// --- Structure select + move ----------------------------------------------
// In edit mode, clicking a building selects it; WASD then nudges it one block
// at a time along the map axes (W = north / -Z, matching the minimap). Each
// building's meshes sit under its own Group, so a move is one translation on
// that Group plus a matching shift of its collider and step zone.
let selectedStructure = null;

const structureHighlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0x4dd2ff, depthTest: false })
);
structureHighlight.renderOrder = 1001;
structureHighlight.visible = false;
scene.add(structureHighlight);

const structureBox = new THREE.Box3();
const structureBoxSize = new THREE.Vector3();
const structureBoxCenter = new THREE.Vector3();

function updateStructureHighlight() {
  if (!selectedStructure) {
    structureHighlight.visible = false;
    return;
  }
  structureBox.setFromObject(selectedStructure.group);
  if (structureBox.isEmpty()) {
    structureHighlight.visible = false;
    return;
  }
  structureBox.getSize(structureBoxSize);
  structureBox.getCenter(structureBoxCenter);
  structureHighlight.scale.copy(structureBoxSize);
  structureHighlight.position.copy(structureBoxCenter);
  structureHighlight.visible = true;
}

function setStructureStatus(text) {
  if (structureStatus) structureStatus.textContent = text;
}

function describeSelectedStructure() {
  const entry = selectedStructure;
  if (!entry) return '';
  const x = Math.round(entry.centerBlock.x + entry.offsetX);
  const z = Math.round(entry.centerBlock.z + entry.offsetZ);
  return `${entry.label}を選択中（中心 x:${x} z:${z}）WASDで移動 / Ctrl+Zで戻す / Escで解除`;
}

function selectStructure(entry) {
  selectedStructure = entry;
  updateStructureHighlight();
  structureRow.classList.toggle('is-hidden', !entry);
  setStructureStatus(entry ? describeSelectedStructure() : '');
}

function deselectStructure() {
  if (!selectedStructure) return;
  selectStructure(null);
}

function structureAtPointer(clientX, clientY) {
  paintPointer.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  paintRaycaster.setFromCamera(paintPointer, camera);
  let best = null;
  for (const entry of movableStructures) {
    const hits = paintRaycaster.intersectObject(entry.group, true);
    if (hits.length && (!best || hits[0].distance < best.distance)) {
      best = { entry, distance: hits[0].distance };
    }
  }
  return best ? best.entry : null;
}

// Places a structure at an absolute block offset from where it was built.
function setStructureOffset(entry, offsetX, offsetZ) {
  entry.offsetX = offsetX;
  entry.offsetZ = offsetZ;

  // Sit the building on whatever ground is under its new centre, so moving
  // onto the raised plateau doesn't bury it (or leave it floating coming back
  // down). Heights are quantised to blocks, same as the terrain itself.
  const groundBlocks = getTerrainHeightBlocks(
    THREE.MathUtils.clamp(Math.round(entry.centerBlock.x + offsetX), 0, tilesWide - 1),
    THREE.MathUtils.clamp(Math.round(entry.centerBlock.z + offsetZ), 0, tilesDeep - 1)
  );
  const worldDX = offsetX * tileSize;
  const worldDZ = offsetZ * tileSize;
  entry.group.position.set(
    worldDX,
    (groundBlocks - entry.baseGroundBlocks) * tileSize,
    worldDZ
  );

  for (const [box, base] of [[entry.collider, entry.baseCollider], [entry.stepZone, entry.baseStepZone]]) {
    if (!box || !base) continue;
    box.minX = base.minX + worldDX;
    box.maxX = base.maxX + worldDX;
    box.minZ = base.minZ + worldDZ;
    box.maxZ = base.maxZ + worldDZ;
  }
}

// Called by undo/redo for { map: 'structure' } history entries.
function applyStructureChange(index, offset) {
  const entry = movableStructures[index];
  if (!entry || !offset) return;
  setStructureOffset(entry, offset.x, offset.z);
  if (selectedStructure === entry) {
    updateStructureHighlight();
    setStructureStatus(describeSelectedStructure());
  }
}

// WASD is camera-relative, like walking: W pushes the building away from the
// camera. The result is snapped to whichever cardinal axis the camera is
// closest to facing, so moves stay on the one-block grid.
function cameraRelativeBlockStep(forward, side) {
  const dxRaw = -Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * side;
  const dzRaw = -Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * side;
  if (Math.abs(dxRaw) >= Math.abs(dzRaw)) {
    const step = Math.sign(dxRaw);
    if (step !== 0) return [step, 0];
    return [0, Math.sign(dzRaw)];
  }
  const step = Math.sign(dzRaw);
  if (step !== 0) return [0, step];
  return [Math.sign(dxRaw), 0];
}

function moveSelectedStructure(forward, side) {
  const entry = selectedStructure;
  if (!entry) return;

  const [dxBlocks, dzBlocks] = cameraRelativeBlockStep(forward, side);
  if (!dxBlocks && !dzBlocks) return;

  const nextX = entry.centerBlock.x + entry.offsetX + dxBlocks;
  const nextZ = entry.centerBlock.z + entry.offsetZ + dzBlocks;
  if (nextX < 0 || nextX > tilesWide - 1 || nextZ < 0 || nextZ > tilesDeep - 1) return;

  const before = { x: entry.offsetX, z: entry.offsetZ };
  const after = { x: entry.offsetX + dxBlocks, z: entry.offsetZ + dzBlocks };
  setStructureOffset(entry, after.x, after.z);
  pushHistory([{ map: 'structure', key: movableStructures.indexOf(entry), before, after }]);

  updateStructureHighlight();
  setStructureStatus(describeSelectedStructure());
}
// --------------------------------------------------------------------------

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

// Holding the mouse button down keeps applying the current tool (paint tile,
// build, or remove) at a fixed rate - not just once per click, and not only
// while the pointer is actively moving.
const PAINT_REPEAT_MS = 150;
let paintIntervalId = null;
let lastPaintX = 0;
let lastPaintY = 0;

function startPaintLoop(clientX, clientY) {
  lastPaintX = clientX;
  lastPaintY = clientY;
  paintAt(clientX, clientY);
  if (paintIntervalId) clearInterval(paintIntervalId);
  paintIntervalId = setInterval(() => paintAt(lastPaintX, lastPaintY), PAINT_REPEAT_MS);
}
function stopPaintLoop() {
  if (paintIntervalId) {
    clearInterval(paintIntervalId);
    paintIntervalId = null;
  }
}

canvas.addEventListener('pointerdown', (event) => {
  guide.classList.add('is-hidden');
  // Clicking a building selects it for moving; this is checked before paint
  // and range-select so a click that lands on a building never also paints
  // the ground behind it.
  if (editMode && event.button === 0) {
    const structure = structureAtPointer(event.clientX, event.clientY);
    if (structure) {
      selectStructure(structure);
      hideBrushHighlight();
      return;
    }
  }
  if (editMode && event.button === 0 && currentEditTarget() === 'range') {
    canvas.setPointerCapture(event.pointerId);
    handleRangePointerDown(event);
    return;
  }
  if (editMode && event.button === 0) {
    painting = true;
    canvas.setPointerCapture(event.pointerId);
    startPaintLoop(event.clientX, event.clientY);
    return;
  }
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  painting = false;
  stopPaintLoop();
  handleRangePointerUp();
  canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (rangeDragging) {
    handleRangePointerMove(event);
    return;
  }
  if (painting) {
    lastPaintX = event.clientX;
    lastPaintY = event.clientY;
    updateBrushHighlight(event.clientX, event.clientY);
    return;
  }
  if (dragging) {
    cameraYaw -= event.movementX * 0.006;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch + event.movementY * 0.004, cameraPitchMin, cameraPitchMax);
    return;
  }
  updateBrushHighlight(event.clientX, event.clientY);
});
canvas.addEventListener('pointerleave', hideBrushHighlight);
canvas.addEventListener('wheel', (event) => {
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.003, 2.7, 8);
}, { passive: true });

function setEditMode(enabled) {
  editMode = enabled;
  editTools.classList.toggle('is-hidden', !editMode);
  editToggle.classList.toggle('is-active', editMode);
  if (!editMode) {
    resetRangeSelection();
    hideBrushHighlight();
    deselectStructure();
  }
}

editToggle.addEventListener('click', () => setEditMode(!editMode));

structureDeselectButton.addEventListener('click', deselectStructure);

function updateEditToolsVisibility() {
  const target = currentEditTarget();
  const action = document.querySelector('input[name="paintAction"]:checked').value;
  blockActionRow.classList.toggle('is-hidden', target !== 'block');
  materialRow.classList.toggle('is-hidden', (target === 'block' && action === 'remove'));
  rangeRow.classList.toggle('is-hidden', target !== 'range');
  brushSizeRow.classList.toggle('is-hidden', target === 'range');
  // Floating placement only makes sense when building a block volume, not
  // when just repainting the ground material.
  rangeFloatToggleRow.classList.toggle('is-hidden', currentRangeAction() !== 'block');
  if (target !== 'range') resetRangeSelection();
  if (target === 'range') hideBrushHighlight();
}

document.querySelectorAll('input[name="editTarget"], input[name="paintAction"], input[name="rangeAction"]').forEach((input) => {
  input.addEventListener('change', () => {
    updateEditToolsVisibility();
    resetRangeSelection();
  });
});
updateEditToolsVisibility();

exportPaintButton.addEventListener('click', () => {
  const blob = new Blob(
    [JSON.stringify({
      version: 2,
      overrides: [...tilePaintOverrides],
      heightOverrides: [...heightPaintOverrides],
      floatingRangeBlocks: [...floatingBlocks]
    }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tile-paint-overrides.json';
  link.click();
  URL.revokeObjectURL(url);
});

clearPaintButton.addEventListener('click', () => {
  if (tilePaintOverrides.size === 0 && heightPaintOverrides.size === 0 && floatingBlocks.size === 0) return;
  // confirm() blocks the JS thread; a movement key held down when it opens
  // can miss its keyup entirely, so release everything before showing it
  // rather than relying only on the stale-key watchdog to catch it later.
  releaseAllKeys();
  if (!confirm('編集した内容をすべて削除します。よろしいですか？')) return;
  const batch = [];
  for (const [key, before] of tilePaintOverrides) recordChange(batch, 'tile', key, before, undefined);
  for (const [key, before] of heightPaintOverrides) recordChange(batch, 'height', key, before, undefined);
  for (const [key, before] of floatingBlocks) recordChange(batch, 'floating', key, before, undefined);
  tilePaintOverrides.clear();
  heightPaintOverrides.clear();
  floatingBlocks.clear();
  paintDirty = true;
  heightDirty = true;
  floatingDirty = true;
  pushHistory(batch);
});

addEventListener('keydown', (event) => {
  if (!editMode) return;
  if (!event.ctrlKey && !event.metaKey) return;
  if (event.code === 'KeyZ') {
    event.preventDefault();
    undo();
  } else if (event.code === 'KeyY') {
    event.preventDefault();
    redo();
  }
});
// --------------------------------------------------------------------------

function isInsideHouse(x, z) {
  return houseColliders.some((collider) => (
    x > collider.minX && x < collider.maxX && z > collider.minZ && z < collider.maxZ
  ));
}

function isInsideRiverBarrier(x, z) {
  const blockX = blockXFromWorld(x);
  const blockZ = blockZFromWorld(z);
  if (blockZ < 0 || blockZ > tilesDeep - 1) return false;

  const { left, right } = riverEdgesAtBlockZ(blockZ);
  const margin = mapConfig.areas.riverFence.blockMargin;
  return blockX > left - margin && blockX < right + margin;
}

function isInsideRiverFence(x, z) {
  const blockX = blockXFromWorld(x);
  const blockZ = blockZFromWorld(z);
  if (blockZ < 0 || blockZ > tilesDeep - 1) return false;

  const { left, right } = riverEdgesAtBlockZ(blockZ);
  const fence = mapConfig.areas.riverFence;
  const leftFenceX = left - fence.offsetBlocks;
  const rightFenceX = right + fence.offsetBlocks;
  const halfWidth = fence.collisionHalfWidthBlocks;

  return Math.abs(blockX - leftFenceX) < halfWidth || Math.abs(blockX - rightFenceX) < halfWidth;
}

function isBlockedPosition(x, z) {
  return isInsideHouse(x, z) || isInsideRiverBarrier(x, z) || isInsideRiverFence(x, z);
}

function getRampHeightAt(x, z) {
  const blockX = blockXFromWorld(x);
  const blockZ = blockZFromWorld(z);
  const { along, across, stair } = stairLocalPosition(blockX, blockZ);
  if (along < 0 || along >= stair.length || Math.abs(across) > stair.width / 2) {
    return 0;
  }

  return getTerrainHeightBlocks(Math.floor(blockX), Math.floor(blockZ)) * tileSize;
}

function getWalkableHeight(x, z) {
  let height = Math.max(getTerrainHeightAt(x, z), getRampHeightAt(x, z));
  for (const zone of walkableStepZones) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
      height = Math.max(height, zone.height);
    }
  }
  return height;
}

function canMoveToPosition(x, z) {
  if (isBlockedPosition(x, z)) return false;
  const nextHeight = getWalkableHeight(x, z);
  const currentSupportHeight = getWalkableHeight(player.position.x, player.position.z);
  const currentEffectiveHeight = Math.max(player.position.y, currentSupportHeight);
  return nextHeight - currentEffectiveHeight <= tileSize * 1.18;
}

function initMinimap() {
  minimapMap.setAttribute('viewBox', `0 0 ${tilesWide} ${tilesDeep}`);
  minimapMap.setAttribute('aria-label', `${tilesWide}×${tilesDeep}ブロックのフィールドと現在地`);
  minimapFrame.setAttribute('width', tilesWide - 2);
  minimapFrame.setAttribute('height', tilesDeep - 2);
  minimapGround.setAttribute('width', tilesWide - 4);
  minimapGround.setAttribute('height', tilesDeep - 4);
  const gridLines = [];
  for (let x = mapConfig.cellBlocks; x < tilesWide; x += mapConfig.cellBlocks) {
    gridLines.push(`<line x1="${x}" y1="2" x2="${x}" y2="${tilesDeep - 2}" stroke="#385f4e" stroke-width=".45"/>`);
  }
  for (let y = mapConfig.cellBlocks; y < tilesDeep; y += mapConfig.cellBlocks) {
    gridLines.push(`<line x1="2" y1="${y}" x2="${tilesWide - 2}" y2="${y}" stroke="#385f4e" stroke-width=".45"/>`);
  }
  minimapGrid.innerHTML = gridLines.join('');
  const road = getRoadFromHouseBounds();
  const stair = getStairProfile();
  const stairHalf = stair.width / 2;
  const connectorZ = road.top + 1.15;
  const stairStartX = stair.startX;
  const stairStartZ = stair.startZ;
  const stairEndX = stair.startX + stair.forward.x * stair.length;
  const stairEndZ = stair.startZ + stair.forward.z * stair.length;
  const connectorPoints = [
    [road.left, connectorZ],
    [road.right, connectorZ],
    [stairStartX + stair.across.x * stairHalf, stairStartZ + stair.across.z * stairHalf],
    [stairStartX - stair.across.x * stairHalf, stairStartZ - stair.across.z * stairHalf]
  ].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const stairPoints = [
    [stairStartX - stair.across.x * stairHalf, stairStartZ - stair.across.z * stairHalf],
    [stairStartX + stair.across.x * stairHalf, stairStartZ + stair.across.z * stairHalf],
    [stairEndX + stair.across.x * stairHalf, stairEndZ + stair.across.z * stairHalf],
    [stairEndX - stair.across.x * stairHalf, stairEndZ - stair.across.z * stairHalf]
  ].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const plateauPath = getPlateauPathBounds();
  minimapRoads.innerHTML = `
    <rect x="${road.left.toFixed(2)}" y="${road.top.toFixed(2)}" width="${(road.right - road.left).toFixed(2)}" height="${(road.bottom - road.top).toFixed(2)}" fill="#b8afa4" opacity=".9"/>
    <polygon points="${connectorPoints}" fill="#b8afa4" opacity=".94"/>
    <polygon points="${stairPoints}" fill="#b8afa4" opacity=".92"/>
    <rect x="${plateauPath.minBlockX}" y="0" width="${plateauPath.maxBlockX - plateauPath.minBlockX}" height="${plateauPath.endBlockZ}" fill="#b8afa4" opacity=".94"/>
  `;
  const leftEdgePoints = [];
  const rightEdgePoints = [];
  for (let z = 0; z <= tilesDeep - 1; z += 6) {
    const { left, right } = riverEdgesAtBlockZ(z);
    leftEdgePoints.push(`${left.toFixed(2)},${z.toFixed(2)}`);
    rightEdgePoints.unshift(`${right.toFixed(2)},${z.toFixed(2)}`);
  }
  const { left: bottomLeft, right: bottomRight } = riverEdgesAtBlockZ(tilesDeep - 1);
  leftEdgePoints.push(`${bottomLeft.toFixed(2)},${(tilesDeep - 1).toFixed(2)}`);
  rightEdgePoints.unshift(`${bottomRight.toFixed(2)},${(tilesDeep - 1).toFixed(2)}`);
  minimapRiver.setAttribute('d', `M ${leftEdgePoints.join(' L ')} L ${rightEdgePoints.join(' L ')} Z`);
  minimapHouse.setAttribute(
    'transform',
    `translate(${mapConfig.structures.startHouse.centerBlock.x} ${mapConfig.structures.startHouse.centerBlock.z})`
  );
  const startHouseSize = mapConfig.structures.startHouse.halfBlocks * 2 + 1;
  minimapHouse.innerHTML = `
    <rect x="${(-startHouseSize / 2).toFixed(2)}" y="${(-startHouseSize / 2).toFixed(2)}" width="${startHouseSize}" height="${startHouseSize}" rx=".45" fill="#c7ad82"/>
    <rect x="${(-startHouseSize / 2).toFixed(2)}" y="${(-startHouseSize / 2).toFixed(2)}" width="${startHouseSize}" height="${Math.max(2, startHouseSize * 0.28).toFixed(2)}" fill="#344d61" opacity=".85"/>
  `;
  minimapAdditionalHouses.innerHTML = mapConfig.structures.additionalHouses.map((house) => {
    const size = house.halfBlocks * 2 + 1;
    const wallColor = `#${house.colors.wall.toString(16).padStart(6, '0')}`;
    const roofColor = `#${house.colors.roof.toString(16).padStart(6, '0')}`;
    return `<g transform="translate(${house.centerBlock.x} ${house.centerBlock.z})">
      <rect x="${(-size / 2).toFixed(2)}" y="${(-size / 2).toFixed(2)}" width="${size}" height="${size}" rx=".45" fill="${wallColor}"/>
      <rect x="${(-size / 2).toFixed(2)}" y="${(-size / 2).toFixed(2)}" width="${size}" height="${Math.max(2, size * 0.28).toFixed(2)}" fill="${roofColor}" opacity=".85"/>
    </g>`;
  }).join('');
  minimapSizeLabel.textContent = `${tilesWide} × ${tilesDeep} blocks`;
}

function updatePlayer(dt) {
  if (!characterChosen) return;
  pruneStaleKeys(performance.now());
  let side = 0;
  let forward = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;

  moveDirection.set(0, 0, 0);
  if (side || forward) {
    const cameraForward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const cameraRight = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    moveDirection.addScaledVector(cameraForward, forward).addScaledVector(cameraRight, side).normalize();
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 5.3 : 3.25;
    const moveAmount = speed * dt;
    const nextX = player.position.x + moveDirection.x * moveAmount;
    const nextZ = player.position.z + moveDirection.z * moveAmount;
    if (canMoveToPosition(nextX, player.position.z)) player.position.x = nextX;
    if (canMoveToPosition(player.position.x, nextZ)) player.position.z = nextZ;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -halfFieldWidth + 0.45, halfFieldWidth - 0.45);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -halfFieldDepth + 0.45, halfFieldDepth - 0.45);
    // The model's face points toward local -Z, so invert the usual +Z heading.
    // Normalize the angular difference to prevent a long spin around ±PI.
    const targetAngle = Math.atan2(-moveDirection.x, -moveDirection.z);
    const angleDelta = Math.atan2(
      Math.sin(targetAngle - player.rotation.y),
      Math.cos(targetAngle - player.rotation.y)
    );
    player.rotation.y += angleDelta * (1 - Math.exp(-14 * dt));
    walkTime += dt * (speed > 4 ? 13 : 9);
  }

  const groundHeight = getWalkableHeight(player.position.x, player.position.z);
  if (player.position.y <= groundHeight + 0.04 && verticalVelocity <= 0) {
    player.position.y = THREE.MathUtils.lerp(player.position.y, groundHeight, 1 - Math.exp(-18 * dt));
    verticalVelocity = 0;
  } else {
    verticalVelocity -= gravity * dt;
    player.position.y += verticalVelocity * dt;
    if (player.position.y < groundHeight) {
      player.position.y = groundHeight;
      verticalVelocity = 0;
    }
  }

  const moving = moveDirection.lengthSq() > 0;
  const swing = moving ? Math.sin(walkTime) * 0.72 : 0;
  const parts = player.userData;
  parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, swing, 12 * dt);
  parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -swing, 12 * dt);
  parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, -swing, 12 * dt);
  parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, swing, 12 * dt);
  parts.visual.position.y = moving ? Math.abs(Math.sin(walkTime * 2)) * 0.025 : 0;
}

function updateCamera(dt) {
  cameraTarget.set(player.position.x, player.position.y + 0.92, player.position.z);
  const lookUpAmount = Math.max(0, -cameraPitch);
  cameraLookTarget.set(
    cameraTarget.x,
    cameraTarget.y + lookUpAmount * 2.15,
    cameraTarget.z
  );
  const horizontal = Math.cos(cameraPitch) * cameraDistance;
  desiredCamera.set(
    cameraTarget.x + Math.sin(cameraYaw) * horizontal,
    cameraTarget.y + Math.sin(cameraPitch) * cameraDistance + 0.47,
    cameraTarget.z + Math.cos(cameraYaw) * horizontal
  );
  desiredCamera.y = Math.max(desiredCamera.y, player.position.y + 0.25);
  camera.position.lerp(desiredCamera, 1 - Math.exp(-10 * dt));
  camera.lookAt(cameraLookTarget);
}

function updateMinimap() {
  const mapX = THREE.MathUtils.clamp(blockXFromWorld(player.position.x), 2, tilesWide - 2);
  const mapY = THREE.MathUtils.clamp(blockZFromWorld(player.position.z), 2, tilesDeep - 2);
  const centerX = tilesWide / 2;
  const centerY = tilesDeep / 2;
  const cameraRotation = THREE.MathUtils.radToDeg(cameraYaw);
  // The map itself rotates with the camera, so the player arrow needs the same
  // camera rotation added to its world-facing angle. Subtracting it makes the
  // arrow drift in the opposite direction while rotating the camera.
  const playerRotation = -THREE.MathUtils.radToDeg(player.rotation.y) + cameraRotation;

  minimapContent.setAttribute(
    'transform',
    `translate(${(centerX - mapX).toFixed(2)} ${(centerY - mapY).toFixed(2)}) rotate(${cameraRotation.toFixed(1)} ${mapX.toFixed(2)} ${mapY.toFixed(2)})`
  );
  minimapPlayer.setAttribute(
    'transform',
    `translate(${centerX.toFixed(2)} ${centerY.toFixed(2)}) rotate(${playerRotation.toFixed(1)})`
  );
}

function updateRiver(now) {
  const wave = Math.sin(now * 0.0018) * 0.5 + 0.5;
  riverMeshes.water.material.opacity = 0.86 + wave * 0.06;
  riverMeshes.surface.material.opacity = 0.50 + wave * 0.13;
  riverMeshes.reflection.material.opacity = 0.38 + wave * 0.18;
  riverMeshes.shimmer.material.opacity = 0.22 + wave * 0.13;
  riverMeshes.flowHighlights.material.opacity = 0.28 + wave * 0.15;

  riverSurfaceTexture.offset.y = -(now * 0.000055) % 1;
  riverSurfaceTexture.offset.x = Math.sin(now * 0.00022) * 0.024;
  riverReflectionTexture.offset.y = -(now * 0.000095) % 1;
  riverReflectionTexture.offset.x = Math.sin(now * 0.00034 + 1.4) * 0.038;

  const seconds = now / 1000;
  riverMeshes.flowData.forEach((particle, index) => {
    const z = particle.z + seconds * particle.speed;
    const laneDrift = Math.sin(seconds * 0.9 + particle.bob) * 0.035;
    setRiverFlowMatrix(
      riverMeshes.flowHighlights,
      index,
      z,
      THREE.MathUtils.clamp(particle.lane + laneDrift, 0.12, 0.88),
      seconds * 4.2 + particle.bob
    );
  });
  riverMeshes.flowHighlights.instanceMatrix.needsUpdate = true;
}

let fpsFrames = 0;
let fpsElapsed = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;
  applyPaintIfDirty();
  updatePlayer(dt);
  updateCamera(dt);
  updateMinimap();
  updateRiver(now);
  renderer.render(scene, camera);

  fpsFrames += 1;
  fpsElapsed += dt;
  if (fpsElapsed >= 0.5) {
    fpsCounter.textContent = `${Math.round(fpsFrames / fpsElapsed)} FPS`;
    fpsFrames = 0;
    fpsElapsed = 0;
  }
}

initMinimap();
updateCamera(1);
requestAnimationFrame(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
