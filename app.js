import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#game');
const guide = document.querySelector('#startGuide');
const fpsCounter = document.querySelector('#fpsCounter');
const characterSelect = document.querySelector('#characterSelect');
const editToggle = document.querySelector('#editToggle');
const editTools = document.querySelector('#editTools');
const brushSizeSelect = document.querySelector('#brushSize');
const exportPaintButton = document.querySelector('#exportPaint');
const clearPaintButton = document.querySelector('#clearPaint');
const materialRow = document.querySelector('#materialRow');
const blockActionRow = document.querySelector('#blockActionRow');
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
  blocks: {
    width: 105,
    depth: 195
  },
  cellBlocks: 15,
  playerStartBlock: {
    x: 75,
    z: 187.5
  },
  structures: {
    startHouse: {
      centerBlock: {
        x: 52.5,
        z: 182.5
      },
      halfBlocks: 7
    },
    additionalHouses: [
      {
        name: 'SmallBlueHouse',
        centerBlock: { x: 52.5, z: 162.5 },
        halfBlocks: 6,
        wallHeightBlocks: 10,
        roofHeightBlocks: 4,
        colors: { foundation: 0x858782, wall: 0xb8c6d7, trim: 0x4f6170, glass: 0x5fa9c7, door: 0x5b3a2d, roof: 0x2f5572 }
      },
      {
        name: 'BlockApartment',
        centerBlock: { x: 52.5, z: 142.5 },
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
const flattenPlateauMaxBlockX = 3 * mapConfig.cellBlocks;
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
  if (blockX < flattenPlateauMaxBlockX && blockZ < flattenPlateauMaxBlockZ) return flattenPlateauHeight;

  const { along, across, stair } = stairLocalPosition(blockX + 0.5, blockZ + 0.5);
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
  const distanceToRiver = riverLeft - (blockX + 0.5);
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
    : blockX;
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
// "x,z", value is 'road' or 'grass'. Baked in below as the shipped defaults
// (from an exported tile-paint-overrides.json), then localStorage edits from
// this browser are layered on top so further in-game tweaks still persist.
const DEFAULT_TILE_OVERRIDES = [
  ["75,126", "road"], ["76,126", "road"], ["76,125", "road"], ["77,126", "road"],
  ["78,126", "road"], ["77,125", "road"], ["25,91", "road"], ["25,90", "road"],
  ["27,90", "road"], ["27,85", "road"], ["27,86", "road"], ["27,88", "road"],
  ["27,87", "road"], ["26,87", "road"], ["26,88", "road"], ["26,89", "road"],
  ["25,89", "road"], ["26,90", "road"], ["27,89", "road"], ["26,91", "road"],
  ["27,91", "road"], ["27,92", "road"], ["13,109", "grass"], ["13,108", "grass"],
  ["13,107", "grass"], ["14,107", "grass"], ["14,106", "grass"], ["13,106", "grass"],
  ["13,105", "grass"], ["16,103", "grass"], ["15,102", "grass"], ["14,101", "grass"],
  ["13,100", "grass"], ["13,101", "grass"], ["14,102", "grass"], ["13,102", "grass"],
  ["14,103", "grass"], ["13,103", "grass"], ["13,104", "grass"], ["14,104", "grass"],
  ["14,105", "grass"], ["15,105", "grass"], ["15,104", "grass"], ["15,103", "grass"],
  ["32,95", "road"], ["31,94", "road"], ["30,93", "road"], ["29,92", "road"],
  ["28,91", "road"], ["28,92", "road"], ["29,93", "road"], ["30,94", "road"]
];

const DEFAULT_HEIGHT_OVERRIDES = [
  ["64,133", -1], ["65,133", -1], ["64,134", -1], ["64,132", -1],
  ["63,131", -1], ["13,109", -1], ["12,110", -1], ["12,109", -1]
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
  scene.add(mesh);
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

function createBuildingLayer(name, origin, cells, color) {
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
  scene.add(mesh);
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

  createBuildingLayer(`${config.name}Foundation`, origin, foundation, config.colors.foundation);
  createBuildingLayer(`${config.name}Walls`, origin, walls, config.colors.wall);
  createBuildingLayer(`${config.name}Trim`, origin, trim, config.colors.trim);
  createBuildingLayer(`${config.name}Glass`, origin, glass, config.colors.glass);
  createBuildingLayer(`${config.name}Door`, origin, door, config.colors.door);
  createBuildingLayer(`${config.name}Roof`, origin, roof, config.colors.roof);
  createBuildingLayer(`${config.name}RoofHighlights`, origin, roofHighlight, config.colors.trim);

  houseColliders.push({
    minX: origin.x - (half + 0.65) * tileSize,
    maxX: origin.x + (half + 0.65) * tileSize,
    minZ: origin.z - (half + 0.65) * tileSize,
    maxZ: origin.z + (half + 0.65) * tileSize
  });
  walkableStepZones.push({
    minX: origin.x + (half + 0.5) * tileSize,
    maxX: origin.x + (half + 2.5) * tileSize,
    minZ: origin.z - 2.5 * tileSize,
    maxZ: origin.z + 2.5 * tileSize,
    height: tileSize
  });
}

mapConfig.structures.additionalHouses.forEach(createConfiguredBuilding);

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
  if (!characterChosen) return;
  keys.add(event.code);
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
addEventListener('keyup', (event) => keys.delete(event.code));

// If the window/tab loses focus while a movement key is held down (alt-tab,
// clicking a browser dialog, switching tabs, dragging outside the canvas...)
// the corresponding keyup never fires, so the key would stay stuck "held"
// forever and the character keeps walking on its own. Clear all held keys
// whenever we can no longer be sure we'll see the matching keyup.
function releaseAllKeys() {
  keys.clear();
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
  } catch (error) {
    console.warn('Could not save paint overrides:', error);
  }
}

let heightDirty = false;

// Undo/redo history. Each entry in the stack is a "batch" (everything one
// click/drag stroke or one クリア changed): a list of
// { map: 'tile' | 'height', key, before, after }, where before/after of
// `undefined` means the key was absent (i.e. undo/redo deletes it).
const undoStack = [];
const redoStack = [];
const overrideMaps = { tile: tilePaintOverrides, height: heightPaintOverrides };

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
  for (const change of batch) {
    const map = overrideMaps[change.map];
    const value = useAfter ? change.after : change.before;
    if (value === undefined) map.delete(change.key);
    else map.set(change.key, value);
  }
  heightDirty = true;
  paintDirty = true;
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
  if (!paintDirty && !heightDirty) return;
  paintDirty = false;
  heightDirty = false;
  buildTerrainFillBlocks();
  buildPaintableTiles();
  buildBlockRamp();
  updateTufts();
  savePaintOverrides();
}

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
  canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (painting) {
    lastPaintX = event.clientX;
    lastPaintY = event.clientY;
    return;
  }
  if (!dragging) return;
  cameraYaw -= event.movementX * 0.006;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + event.movementY * 0.004, cameraPitchMin, cameraPitchMax);
});
canvas.addEventListener('wheel', (event) => {
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.003, 2.7, 8);
}, { passive: true });

editToggle.addEventListener('click', () => {
  editMode = !editMode;
  editTools.classList.toggle('is-hidden', !editMode);
  editToggle.classList.toggle('is-active', editMode);
});

function updateEditToolsVisibility() {
  const target = document.querySelector('input[name="editTarget"]:checked').value;
  const action = document.querySelector('input[name="paintAction"]:checked').value;
  blockActionRow.classList.toggle('is-hidden', target !== 'block');
  materialRow.classList.toggle('is-hidden', target === 'block' && action === 'remove');
}

document.querySelectorAll('input[name="editTarget"], input[name="paintAction"]').forEach((input) => {
  input.addEventListener('change', updateEditToolsVisibility);
});
updateEditToolsVisibility();

exportPaintButton.addEventListener('click', () => {
  const blob = new Blob(
    [JSON.stringify({
      version: 2,
      overrides: [...tilePaintOverrides],
      heightOverrides: [...heightPaintOverrides]
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
  if (tilePaintOverrides.size === 0 && heightPaintOverrides.size === 0) return;
  if (!confirm('編集した内容をすべて削除します。よろしいですか？')) return;
  const batch = [];
  for (const [key, before] of tilePaintOverrides) recordChange(batch, 'tile', key, before, undefined);
  for (const [key, before] of heightPaintOverrides) recordChange(batch, 'height', key, before, undefined);
  tilePaintOverrides.clear();
  heightPaintOverrides.clear();
  paintDirty = true;
  heightDirty = true;
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
