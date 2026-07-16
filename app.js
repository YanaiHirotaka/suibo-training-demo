import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#game');
const guide = document.querySelector('#startGuide');
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
    depth: 120
  },
  cellBlocks: 15,
  playerStartBlock: {
    x: 75,
    z: 112.5
  },
  structures: {
    startHouse: {
      centerBlock: {
        x: 52.5,
        z: 107.5
      },
      halfBlocks: 7
    },
    additionalHouses: [
      {
        name: 'SmallBlueHouse',
        centerBlock: { x: 52.5, z: 87.5 },
        halfBlocks: 6,
        wallHeightBlocks: 10,
        roofHeightBlocks: 4,
        colors: { foundation: 0x858782, wall: 0xb8c6d7, trim: 0x4f6170, glass: 0x5fa9c7, door: 0x5b3a2d, roof: 0x2f5572 }
      },
      {
        name: 'BlockApartment',
        centerBlock: { x: 52.5, z: 67.5 },
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
      targetCellFromNorth: 4
    },
    stairsFromRoad: {
      angleDegrees: 60,
      widthBlocks: 15,
      lengthBlocks: 60,
      stepRunBlocks: 3,
      connectionOverlapBlocks: 2
    },
    river: {
      // Upstream is the north edge. "Rightから23ブロック目" means x = width - 23.
      upstream: {
        leftFromRight: 23,
        rightFromRight: 8
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
  gradient.addColorStop(0, '#052f47');
  gradient.addColorStop(0.38, '#0d5d86');
  gradient.addColorStop(0.68, '#0a486c');
  gradient.addColorStop(1, '#031f34');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  let seed = 193;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  ctx.lineCap = 'round';

  for (let i = 0; i < 180; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = 22 + random() * 78;
    const alpha = 0.035 + random() * 0.12;
    ctx.strokeStyle = `rgba(144, 204, 225, ${alpha})`;
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
    const alpha = 0.06 + random() * 0.16;
    ctx.strokeStyle = `rgba(207, 241, 252, ${alpha})`;
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
    ctx.fillStyle = `rgba(0, 20, 34, ${0.10 + random() * 0.18})`;
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
    const alpha = 0.12 + random() * 0.30;
    ctx.strokeStyle = `rgba(232, 252, 255, ${alpha})`;
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
    ctx.strokeStyle = `rgba(132, 201, 220, ${0.08 + random() * 0.16})`;
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

function getStairProfile() {
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

  return {
    startX: (road.left + road.right) / 2,
    startZ: road.top,
    forward,
    across,
    width: stairs.widthBlocks,
    length: stairs.lengthBlocks,
    stepRun: stairs.stepRunBlocks,
    overlap: stairs.connectionOverlapBlocks
  };
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

function getTerrainHeightBlocks(blockX, blockZ) {
  if (blockX < 0 || blockX >= tilesWide || blockZ < 0 || blockZ >= tilesDeep) return 0;
  if (isRiverBlock(blockX, blockZ)) return 0;

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
  const height = Math.max(0, baseLevel - shoulderDrop - riverDrop);
  return isBeyondRampEnd ? height : terrainHeightLimitedByHouses(blockX, blockZ, height);
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
const grassTileCells = [];
const roadTileCells = [];
const riverTileCells = [];

for (let z = 0; z < tilesDeep; z++) {
  for (let x = 0; x < tilesWide; x++) {
    if (isRiverBlock(x, z)) riverTileCells.push([x, z]);
    else if (isRoadBlock(x, z)) roadTileCells.push([x, z]);
    else if (isStairBlock(x, z)) {
      // The block ramp generates its own asphalt top. Do not place a ground tile
      // here too, otherwise the two coplanar surfaces flicker.
    }
    else grassTileCells.push([x, z]);
  }
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
  color: 0xffffff,
  roughness: 0.18,
  metalness: 0.04,
  emissive: 0x031d31,
  emissiveIntensity: 0.13,
  transparent: true,
  opacity: 0.94
});

const grassTiles = createGroundTiles(
  'GrassGroundBlocks',
  grassTileCells,
  grassTileMaterial,
  (x, z) => terrainTileY(x, z, 0.005 + ((x * 17 + z * 31) % 7) * 0.001),
  (x, z, color) => {
    const shade = 0.96 + Math.sin(x * 12.47 + z * 7.31) * 0.025 + Math.cos(z * 2.9) * 0.012;
    color.setRGB(shade, shade, shade * 0.97);
  }
);

const roadTiles = createGroundTiles(
  'RoadGroundBlocks',
  roadTileCells,
  roadTileMaterial,
  (x, z) => terrainTileY(x, z, 0.026 + ((x * 23 + z * 31) % 5) * 0.003),
  (x, z, color) => {
    const roadBase = 0.58 + ((x * 11 + z * 13) % 9) * 0.018;
    const warm = ((x + z) % 4) * 0.015;
    color.setRGB(roadBase + warm, roadBase * 0.96 + warm, roadBase * 0.90);
  }
);

const riverGroundTiles = createGroundTiles(
  'RiverGroundBlocks',
  riverTileCells,
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
  for (let z = 0; z < tilesDeep; z++) {
    for (let x = 0; x < tilesWide; x++) {
      if (isRiverBlock(x, z)) continue;
      if (isStairBlock(x, z)) continue;

      const heightBlocks = getTerrainHeightBlocks(x, z);
      for (let y = 0; y < heightBlocks; y++) {
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

const terrainFillBlocks = createTerrainFillBlocks();

scene.add(field);

// Fine grass clusters give the surface parallax without changing its walkable height.
const tuftGeometry = new THREE.BoxGeometry(0.16, 0.055, 0.16);
const tuftMaterial = new THREE.MeshLambertMaterial({ color: 0x4f9639 });
const tufts = new THREE.InstancedMesh(tuftGeometry, tuftMaterial, 900);
for (let i = 0; i < 900; i++) {
  const x = ((i * 47) % 997) / 997 * (fieldWidth - 1) - (halfFieldWidth - 0.5);
  const z = ((i * 83 + 19) % 991) / 991 * (fieldDepth - 1) - (halfFieldDepth - 0.5);
  const blockX = Math.floor(blockXFromWorld(x));
  const blockZ = Math.floor(blockZFromWorld(z));
  if (isRiverBlock(blockX, blockZ) || isRoadBlock(blockX, blockZ) || isStairBlock(blockX, blockZ)) {
    tileMatrix.makeScale(0, 0, 0);
  } else {
    tileMatrix.makeTranslation(x, getTerrainHeightBlocks(blockX, blockZ) * tileSize + 0.13, z);
  }
  tufts.setMatrixAt(i, tileMatrix);
}
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
    color: 0x2f82aa,
    transparent: true,
    opacity: 0.62,
    depthWrite: false
  });
  const surface = new THREE.Mesh(createRiverSurfaceGeometry(0.166), surfaceMaterial);
  surface.name = 'RiverSurfaceTexture';
  surface.renderOrder = 2;
  scene.add(surface);

  const reflectionMaterial = new THREE.MeshBasicMaterial({
    map: riverReflectionTexture,
    color: 0xe8fbff,
    transparent: true,
    opacity: 0.52,
    depthWrite: false
  });
  const reflection = new THREE.Mesh(createRiverSurfaceGeometry(0.174), reflectionMaterial);
  reflection.name = 'RiverReflectionTexture';
  reflection.renderOrder = 3;
  scene.add(reflection);

  const shimmerGeometry = new THREE.BoxGeometry(tileSize * 0.62, 0.012, tileSize * 0.18);
  const shimmerMaterial = new THREE.MeshBasicMaterial({
    color: 0xc7efff,
    transparent: true,
    opacity: 0.5
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
    color: 0xe6fbff,
    transparent: true,
    opacity: 0.68
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
  const stair = getStairProfile();
  const halfWidth = Math.floor(stair.width / 2);
  const topCells = [];
  const fillCells = [];

  for (let pathBlock = 0; pathBlock < stair.length; pathBlock++) {
    const along = pathBlock + 0.5;
    for (let across = -halfWidth; across <= halfWidth; across++) {
      const blockX = stair.startX + stair.forward.x * along + stair.across.x * across;
      const blockZ = stair.startZ + stair.forward.z * along + stair.across.z * across;
      const gridX = Math.floor(blockX);
      const gridZ = Math.floor(blockZ);
      if (isRoadBlock(gridX, gridZ)) continue;

      const level = getTerrainHeightBlocks(gridX, gridZ);
      topCells.push({ pathBlock, across, level, blockX, blockZ });
      for (let y = 0; y < level; y++) {
        fillCells.push({ pathBlock, across, level, y, blockX, blockZ });
      }
    }
  }

  const asphaltGeometry = new THREE.BoxGeometry(tileSize - 0.004, rampSurfaceThickness, tileSize - 0.004);
  const asphaltMesh = new THREE.InstancedMesh(
    asphaltGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.01 }),
    topCells.length
  );
  asphaltMesh.name = 'BlockRampAsphaltTops';

  const fillMesh = new THREE.InstancedMesh(
    houseBlockGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 }),
    fillCells.length
  );
  fillMesh.name = 'BlockRampFilledBase';

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  topCells.forEach(({ pathBlock, across, level, blockX, blockZ }, index) => {
    matrix.makeTranslation(
      worldXFromBlock(blockX),
      level * tileSize + rampSurfaceThickness / 2,
      worldZFromBlock(blockZ)
    );
    asphaltMesh.setMatrixAt(index, matrix);

    const edgeDirt = Math.abs(across) / halfWidth * 0.05;
    const progress = pathBlock / stair.length;
    const noise = (((pathBlock * 17 + across * 29) % 11) - 5) * 0.007;
    const shade = THREE.MathUtils.clamp(0.48 + progress * 0.11 - edgeDirt + noise, 0.34, 0.64);
    color.setRGB(shade, shade * 0.99, shade * 0.95);
    asphaltMesh.setColorAt(index, color);
  });

  fillCells.forEach(({ pathBlock, across, y, blockX, blockZ }, index) => {
    matrix.makeTranslation(
      worldXFromBlock(blockX),
      tileSize / 2 + y * tileSize,
      worldZFromBlock(blockZ)
    );
    fillMesh.setMatrixAt(index, matrix);

    const edge = Math.abs(across) / halfWidth;
    const dirtNoise = (((pathBlock * 11 + across * 5 + y * 19) % 9) - 4) * 0.016;
    const shade = THREE.MathUtils.clamp(0.72 - edge * 0.10 + dirtNoise, 0.48, 0.80);
    if ((pathBlock + across + y) % 5 === 0) {
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

const blockRamp = createBlockRamp();

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

function makePlayer() {
  const root = new THREE.Group();
  root.name = 'Player';
  const visual = new THREE.Group();
  root.add(visual);

  const yellow = 0xe7ad08;
  const yellowLight = 0xffca19;
  const yellowDark = 0xb77b05;
  const yellowShadow = 0x9f6904;
  const yellowSoft = 0xf4bc10;
  const navy = 0x20394a;
  const navyLight = 0x2e5269;
  const navyDark = 0x142536;
  const skin = 0xf0b780;
  const skinShadow = 0xd99567;
  const hair = 0x4e3426;
  const hairLight = 0x6a4730;

  // Raincoat body: layered panels replace one oversized torso block.
  boxPart(visual, 'coatCore', [0.40, 0.32, 0.30], [0, 0.55, 0.01], yellow);
  boxPart(visual, 'coatChestVolume', [0.31, 0.22, 0.055], [0, 0.57, -0.166], yellowSoft);
  boxPart(visual, 'coatBackVolume', [0.35, 0.30, 0.075], [0, 0.53, 0.18], yellowDark);
  boxPart(visual, 'coatShoulders', [0.49, 0.09, 0.31], [0, 0.69, 0.01], yellowLight);
  boxPart(visual, 'coatShoulderBackLip', [0.42, 0.055, 0.085], [0, 0.705, 0.205], yellowDark);
  boxPart(visual, 'coatSkirt', [0.48, 0.15, 0.32], [0, 0.37, 0.02], yellow);
  boxPart(visual, 'coatHem', [0.50, 0.055, 0.34], [0, 0.30, 0.025], yellowDark);
  boxPart(visual, 'zipper', [0.025, 0.34, 0.018], [0, 0.53, -0.126], 0xffdf55);
  boxPart(visual, 'pocketL', [0.11, 0.08, 0.025], [-0.13, 0.43, -0.137], yellowDark);
  boxPart(visual, 'pocketR', [0.11, 0.08, 0.025], [0.13, 0.43, -0.137], yellowDark);
  boxPart(visual, 'coatSideL', [0.07, 0.27, 0.30], [-0.225, 0.50, 0.01], 0xd49306);
  boxPart(visual, 'coatSideR', [0.07, 0.27, 0.30], [0.225, 0.50, 0.01], 0xd49306);
  boxPart(visual, 'coatSideBackL', [0.045, 0.21, 0.08], [-0.26, 0.49, 0.15], yellowShadow);
  boxPart(visual, 'coatSideBackR', [0.045, 0.21, 0.08], [0.26, 0.49, 0.15], yellowLight);
  boxPart(visual, 'collarL', [0.15, 0.075, 0.04], [-0.085, 0.68, -0.14], yellowDark);
  boxPart(visual, 'collarR', [0.15, 0.075, 0.04], [0.085, 0.68, -0.14], yellowDark);
  boxPart(visual, 'chestPanelL', [0.15, 0.11, 0.024], [-0.095, 0.57, -0.137], 0xf0b708);
  boxPart(visual, 'chestPanelR', [0.15, 0.11, 0.024], [0.095, 0.57, -0.137], 0xf0b708);
  boxPart(visual, 'frontTorsoRibL', [0.075, 0.255, 0.042], [-0.185, 0.535, -0.176], yellowDark);
  boxPart(visual, 'frontTorsoRibR', [0.075, 0.255, 0.042], [0.185, 0.535, -0.176], yellowLight);
  boxPart(visual, 'frontChestRaisedL', [0.105, 0.085, 0.048], [-0.09, 0.61, -0.19], 0xffd141);
  boxPart(visual, 'frontChestRaisedR', [0.105, 0.085, 0.048], [0.09, 0.61, -0.19], 0xe3a207);
  boxPart(visual, 'frontBellyRaisedL', [0.13, 0.095, 0.045], [-0.092, 0.49, -0.188], yellowSoft);
  boxPart(visual, 'frontBellyRaisedR', [0.13, 0.095, 0.045], [0.092, 0.49, -0.188], yellow);
  boxPart(visual, 'collarDepthL', [0.12, 0.055, 0.065], [-0.105, 0.704, -0.17], yellowShadow);
  boxPart(visual, 'collarDepthR', [0.12, 0.055, 0.065], [0.105, 0.704, -0.17], yellowDark);
  boxPart(visual, 'waistFoldL', [0.075, 0.18, 0.02], [-0.18, 0.45, -0.145], yellowShadow);
  boxPart(visual, 'waistFoldR', [0.075, 0.18, 0.02], [0.18, 0.45, -0.145], yellowLight);
  boxPart(visual, 'zipperPull', [0.035, 0.045, 0.02], [0.006, 0.455, -0.156], 0x6f571c);
  boxPart(visual, 'leftPocketTop', [0.115, 0.018, 0.028], [-0.13, 0.485, -0.151], 0xffd24b);
  boxPart(visual, 'rightPocketTop', [0.115, 0.018, 0.028], [0.13, 0.485, -0.151], 0xffd24b);
  boxPart(visual, 'leftPocketVolume', [0.115, 0.07, 0.05], [-0.13, 0.425, -0.185], 0xc98705);
  boxPart(visual, 'rightPocketVolume', [0.115, 0.07, 0.05], [0.13, 0.425, -0.185], 0xf2b60d);
  boxPart(visual, 'zipperRaisedTrack', [0.04, 0.32, 0.032], [0, 0.535, -0.194], 0xd19005);
  boxPart(visual, 'coatLeftBottomTile', [0.105, 0.065, 0.03], [-0.155, 0.325, -0.145], yellowSoft);
  boxPart(visual, 'coatRightBottomTile', [0.105, 0.065, 0.03], [0.155, 0.325, -0.145], yellowDark);
  boxPart(visual, 'coatBackFoldL', [0.07, 0.24, 0.025], [-0.17, 0.50, 0.138], yellowShadow);
  boxPart(visual, 'coatBackFoldR', [0.07, 0.24, 0.025], [0.17, 0.50, 0.138], yellowDark);
  boxPart(visual, 'coatBackCenter', [0.035, 0.32, 0.025], [0, 0.51, 0.143], 0xf7c21b);
  boxPart(visual, 'coatBackLowerBlockL', [0.13, 0.085, 0.05], [-0.105, 0.345, 0.195], yellowShadow);
  boxPart(visual, 'coatBackLowerBlockR', [0.13, 0.085, 0.05], [0.105, 0.345, 0.195], yellow);
  boxPart(visual, 'coatBackHoodShadow', [0.22, 0.055, 0.045], [0, 0.655, 0.222], yellowShadow);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      if ((row + col) % 2 === 0) {
        voxelTile(visual, `coatFrontPixel${row}_${col}`, -0.145 + col * 0.072, 0.625 - row * 0.073, -0.184, row % 2 ? yellowDark : yellowLight, 0.9);
      }
    }
  }
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row + col) % 2 === 1) {
        voxelTile(visual, `coatBackPixel${row}_${col}`, -0.108 + col * 0.072, 0.61 - row * 0.07, 0.232, row % 2 ? yellowShadow : yellowSoft, 0.95);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    boxPart(visual, `button${i}`, [0.025, 0.025, 0.018], [0.035, 0.62 - i * 0.075, -0.151], 0x6f571c);
  }
  for (let i = 0; i < 3; i++) {
    boxPart(visual, `leftRaincoatPixel${i}`, [0.035, 0.035, 0.018], [-0.07 - i * 0.045, 0.63 - i * 0.09, -0.155], i % 2 ? yellowLight : yellowDark);
    boxPart(visual, `rightRaincoatPixel${i}`, [0.035, 0.035, 0.018], [0.07 + i * 0.045, 0.61 - i * 0.08, -0.155], i % 2 ? yellowDark : yellowLight);
  }

  const head = boxPart(visual, 'head', [0.31, 0.27, 0.31], [0, 0.84, -0.01], skin);
  boxPart(head, 'hoodTop', [0.30, 0.07, 0.36], [0, 0.135, 0.018], yellowLight);
  boxPart(head, 'hoodTopLeft', [0.09, 0.07, 0.33], [-0.13, 0.105, 0.018], yellow);
  boxPart(head, 'hoodTopRight', [0.09, 0.07, 0.33], [0.13, 0.105, 0.018], yellow);
  boxPart(head, 'hoodCrown', [0.17, 0.045, 0.32], [0, 0.18, 0.018], 0xffd337);
  boxPart(head, 'hoodTopBackStep', [0.24, 0.045, 0.07], [0, 0.158, 0.205], yellowShadow);
  boxPart(head, 'hoodLeft', [0.075, 0.23, 0.35], [-0.152, 0.01, 0.018], yellow);
  boxPart(head, 'hoodRight', [0.075, 0.23, 0.35], [0.152, 0.01, 0.018], yellow);
  boxPart(head, 'hoodBack', [0.32, 0.21, 0.09], [0, 0, 0.18], yellowDark);
  boxPart(head, 'hoodBackBulge', [0.24, 0.14, 0.065], [0, -0.02, 0.235], yellowShadow);
  boxPart(head, 'hoodTempleL', [0.055, 0.08, 0.05], [-0.13, -0.065, -0.145], yellowDark);
  boxPart(head, 'hoodTempleR', [0.055, 0.08, 0.05], [0.13, -0.065, -0.145], yellowDark);
  boxPart(head, 'hoodEdgeTopL', [0.085, 0.035, 0.035], [-0.105, 0.125, -0.145], yellowDark);
  boxPart(head, 'hoodEdgeTopM', [0.085, 0.035, 0.035], [0, 0.135, -0.145], 0xffdb44);
  boxPart(head, 'hoodEdgeTopR', [0.085, 0.035, 0.035], [0.105, 0.125, -0.145], yellowDark);
  boxPart(head, 'hoodCheekL', [0.04, 0.105, 0.04], [-0.128, -0.02, -0.155], yellowShadow);
  boxPart(head, 'hoodCheekR', [0.04, 0.105, 0.04], [0.128, -0.02, -0.155], yellow);
  boxPart(head, 'hoodSideTileL1', [0.035, 0.06, 0.06], [-0.18, 0.06, 0.00], yellowDark);
  boxPart(head, 'hoodSideTileL2', [0.035, 0.06, 0.06], [-0.18, -0.035, 0.055], yellowShadow);
  boxPart(head, 'hoodSideTileR1', [0.035, 0.06, 0.06], [0.18, 0.06, 0.00], yellowLight);
  boxPart(head, 'hoodSideTileR2', [0.035, 0.06, 0.06], [0.18, -0.035, 0.055], yellowDark);
  for (let i = 0; i < 4; i++) {
    voxelTile(head, `hoodTopPixel${i}`, -0.108 + i * 0.072, 0.188, -0.02 + (i % 2) * 0.062, i % 2 ? yellowLight : yellowDark, 0.85);
    voxelTile(head, `hoodBackPixel${i}`, -0.108 + i * 0.072, 0.058 - (i % 2) * 0.06, 0.272, i % 2 ? yellowShadow : yellow, 0.9);
  }
  boxPart(head, 'facePlaneRaised', [0.225, 0.205, 0.035], [0, -0.035, -0.176], 0xf3bd88);
  boxPart(head, 'foreheadBlock', [0.18, 0.045, 0.04], [0, 0.062, -0.19], skin);
  boxPart(head, 'leftBrowVolume', [0.075, 0.035, 0.045], [-0.074, 0.034, -0.204], 0x5b3a29);
  boxPart(head, 'rightBrowVolume', [0.075, 0.035, 0.045], [0.074, 0.034, -0.204], 0x5b3a29);
  boxPart(head, 'eyeSocketL', [0.058, 0.052, 0.032], [-0.074, -0.004, -0.204], 0xd5966d);
  boxPart(head, 'eyeSocketR', [0.058, 0.052, 0.032], [0.074, -0.004, -0.204], 0xd5966d);
  boxPart(head, 'cheekVolumeL', [0.072, 0.07, 0.052], [-0.096, -0.064, -0.204], 0xeaa879);
  boxPart(head, 'cheekVolumeR', [0.072, 0.07, 0.052], [0.096, -0.064, -0.204], 0xf2bd8a);
  boxPart(head, 'mouthMuzzle', [0.115, 0.062, 0.046], [0, -0.097, -0.205], 0xe0a173);
  boxPart(head, 'fringeL', [0.075, 0.055, 0.044], [-0.105, 0.092, -0.184], hair);
  boxPart(head, 'fringeMid', [0.065, 0.085, 0.046], [-0.035, 0.075, -0.19], hairLight);
  boxPart(head, 'fringeR', [0.07, 0.045, 0.044], [0.045, 0.095, -0.184], hair);
  boxPart(head, 'fringeTipL', [0.04, 0.055, 0.038], [-0.07, 0.045, -0.215], 0x3f2b20);
  boxPart(head, 'fringeTipR', [0.045, 0.04, 0.038], [0.095, 0.058, -0.215], hairLight);
  boxPart(head, 'sideHairL', [0.04, 0.105, 0.052], [-0.145, 0.02, -0.172], hair);
  boxPart(head, 'sideHairR', [0.04, 0.09, 0.052], [0.145, 0.03, -0.172], hair);
  boxPart(head, 'earL', [0.035, 0.075, 0.055], [-0.168, -0.015, -0.015], 0xda976c);
  boxPart(head, 'earR', [0.035, 0.075, 0.055], [0.168, -0.015, -0.015], 0xda976c);
  boxPart(head, 'jawL', [0.055, 0.055, 0.04], [-0.125, -0.12, -0.13], 0xe4a473);
  boxPart(head, 'jawR', [0.055, 0.055, 0.04], [0.125, -0.12, -0.13], 0xe4a473);
  boxPart(head, 'chin', [0.11, 0.042, 0.05], [0, -0.137, -0.185], skinShadow);
  boxPart(head, 'jawDepthL', [0.045, 0.07, 0.045], [-0.13, -0.108, -0.176], 0xd99468);
  boxPart(head, 'jawDepthR', [0.045, 0.07, 0.045], [0.13, -0.108, -0.176], 0xf2ba87);
  boxPart(head, 'eyeL', [0.04, 0.046, 0.026], [-0.073, -0.005, -0.226], 0x253342);
  boxPart(head, 'eyeR', [0.04, 0.046, 0.026], [0.073, -0.005, -0.226], 0x253342);
  boxPart(head, 'eyeGlintL', [0.012, 0.014, 0.012], [-0.066, 0.006, -0.243], 0xffffff);
  boxPart(head, 'eyeGlintR', [0.012, 0.014, 0.012], [0.080, 0.006, -0.243], 0xffffff);
  boxPart(head, 'browL', [0.064, 0.018, 0.026], [-0.073, 0.047, -0.228], hair);
  boxPart(head, 'browR', [0.064, 0.018, 0.026], [0.073, 0.047, -0.228], hair);
  boxPart(head, 'noseBridge', [0.026, 0.07, 0.034], [0, -0.024, -0.231], 0xe2a272);
  boxPart(head, 'noseTip', [0.046, 0.035, 0.052], [0, -0.056, -0.25], 0xd98f61);
  boxPart(head, 'noseHighlight', [0.016, 0.02, 0.012], [-0.007, -0.049, -0.282], 0xf6c090);
  boxPart(head, 'mouth', [0.068, 0.024, 0.026], [0, -0.095, -0.236], 0x7d3530);
  boxPart(head, 'lowerLip', [0.052, 0.014, 0.018], [0.004, -0.116, -0.238], 0xc76f62);
  boxPart(head, 'mouthHighlight', [0.028, 0.009, 0.012], [-0.018, -0.089, -0.255], 0xf4b0a0);
  boxPart(head, 'cheekL', [0.042, 0.022, 0.02], [-0.108, -0.065, -0.238], 0xe69775);
  boxPart(head, 'cheekR', [0.042, 0.022, 0.02], [0.108, -0.065, -0.238], 0xe69775);
  boxPart(head, 'faceShadowL', [0.024, 0.09, 0.022], [-0.149, -0.064, -0.198], skinShadow);
  boxPart(head, 'faceShadowR', [0.024, 0.08, 0.022], [0.149, -0.055, -0.198], 0xf6c091);

  // Articulated arms and legs are each assembled from multiple smaller blocks.
  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.285, 0.68, 0);
    boxPart(arm, 'upperSleeve', [0.14, 0.2, 0.19], [0, -0.09, 0], yellowLight);
    boxPart(arm, 'upperSleeveBack', [0.10, 0.17, 0.055], [0, -0.095, 0.115], yellowDark);
    boxPart(arm, 'upperSleeveFront', [0.10, 0.14, 0.04], [0, -0.095, -0.105], yellowSoft);
    boxPart(arm, 'shoulderCap', [0.16, 0.075, 0.205], [0, 0.005, 0], yellowDark);
    boxPart(arm, 'shoulderHighlight', [0.09, 0.035, 0.18], [side * 0.018, 0.046, -0.005], yellowSoft);
    boxPart(arm, 'upperSideFold', [0.035, 0.13, 0.17], [side * 0.058, -0.085, 0.005], yellowShadow);
    boxPart(arm, 'lowerSleeve', [0.13, 0.16, 0.18], [0, -0.26, 0], yellow);
    boxPart(arm, 'lowerSleeveBackBlock', [0.09, 0.095, 0.05], [0, -0.265, 0.105], yellowShadow);
    boxPart(arm, 'sleevePatch', [0.04, 0.1, 0.025], [-side * 0.045, -0.17, -0.085], 0xf5bd10);
    boxPart(arm, 'elbowTile', [0.085, 0.045, 0.035], [0, -0.205, 0.085], yellowDark);
    boxPart(arm, 'sleeveSeam', [0.018, 0.135, 0.025], [side * 0.062, -0.265, -0.08], yellowLight);
    boxPart(arm, 'cuff', [0.13, 0.055, 0.16], [0, -0.34, 0], yellowDark);
    boxPart(arm, 'hand', [0.11, 0.105, 0.135], [0, -0.415, -0.005], skin);
    boxPart(arm, 'knuckleBlock', [0.09, 0.035, 0.035], [0, -0.402, -0.082], skinShadow);
    boxPart(arm, 'thumb', [0.035, 0.055, 0.045], [-side * 0.06, -0.405, -0.045], 0xda976c);
    boxPart(arm, 'fingerLine', [0.07, 0.012, 0.01], [0, -0.44, -0.067], 0xc9825b);
    boxPart(arm, 'fingerA', [0.018, 0.04, 0.018], [-0.026, -0.465, -0.028], skinShadow);
    boxPart(arm, 'fingerB', [0.018, 0.043, 0.018], [0, -0.468, -0.03], skin);
    boxPart(arm, 'fingerC', [0.018, 0.038, 0.018], [0.026, -0.465, -0.028], skinShadow);
    visual.add(arm);
    return arm;
  }

  function makeLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.115, 0.39, 0);
    boxPart(leg, 'trouserTop', [0.19, 0.17, 0.24], [0, -0.08, 0.01], navy);
    boxPart(leg, 'trouserBackMass', [0.145, 0.145, 0.07], [0, -0.09, 0.145], navyDark);
    boxPart(leg, 'knee', [0.13, 0.07, 0.025], [0, -0.16, -0.11], 0x2b4c60);
    boxPart(leg, 'sideTrouserFold', [0.035, 0.155, 0.19], [side * 0.078, -0.15, 0], navyLight);
    boxPart(leg, 'trouserLower', [0.18, 0.13, 0.22], [0, -0.22, 0.01], navyDark);
    boxPart(leg, 'legFrontFacet', [0.105, 0.105, 0.035], [0, -0.215, -0.12], navyLight);
    boxPart(leg, 'ankleBlock', [0.145, 0.045, 0.20], [0, -0.285, 0.025], 0x274358);
    boxPart(leg, 'boot', [0.20, 0.1, 0.28], [0, -0.32, -0.025], 0x263038);
    boxPart(leg, 'bootToe', [0.17, 0.055, 0.055], [0, -0.315, -0.145], 0x3f4b51);
    boxPart(leg, 'bootBand', [0.185, 0.025, 0.255], [0, -0.34, -0.028], 0xa4a9a5);
    boxPart(leg, 'bootSideDark', [0.045, 0.075, 0.22], [side * 0.085, -0.32, -0.02], 0x11181d);
    boxPart(leg, 'toeHighlight', [0.075, 0.025, 0.025], [0, -0.292, -0.18], 0x5b6467);
    boxPart(leg, 'sole', [0.2, 0.035, 0.265], [0, -0.38, -0.03], 0x14191d);
    visual.add(leg);
    return leg;
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const backpack = new THREE.Group();
  backpack.position.set(0, 0.55, 0.205);
  boxPart(backpack, 'packMain', [0.36, 0.35, 0.20], [0, 0, 0], 0x26323a);
  boxPart(backpack, 'packBackVolume', [0.28, 0.28, 0.08], [0, -0.02, 0.14], 0x151d23);
  boxPart(backpack, 'packTop', [0.31, 0.075, 0.215], [0, 0.18, 0], 0x3c4850);
  boxPart(backpack, 'packTopStep', [0.23, 0.05, 0.22], [0, 0.235, 0.015], 0x48555d);
  boxPart(backpack, 'packSideL', [0.065, 0.25, 0.21], [-0.19, -0.015, 0], 0x171f25);
  boxPart(backpack, 'packSideR', [0.065, 0.25, 0.21], [0.19, -0.015, 0], 0x171f25);
  boxPart(backpack, 'packPocket', [0.26, 0.15, 0.075], [0, -0.07, 0.13], 0x171f25);
  boxPart(backpack, 'packPocketFlap', [0.23, 0.05, 0.085], [0, 0.015, 0.165], 0x465159);
  boxPart(backpack, 'packBuckle', [0.045, 0.05, 0.03], [0, -0.035, 0.21], 0x9da6a8);
  boxPart(backpack, 'packBottom', [0.31, 0.07, 0.205], [0, -0.19, 0], 0x151d23);
  boxPart(backpack, 'packCenterRidge', [0.05, 0.31, 0.04], [0, 0, 0.185], 0x59666d);
  boxPart(backpack, 'packLeftTile', [0.085, 0.11, 0.045], [-0.095, -0.06, 0.19], 0x303c43);
  boxPart(backpack, 'packRightTile', [0.085, 0.11, 0.045], [0.095, -0.06, 0.19], 0x10171c);
  boxPart(backpack, 'packSidePocketL', [0.05, 0.13, 0.11], [-0.22, -0.07, 0.045], 0x222d33);
  boxPart(backpack, 'packSidePocketR', [0.05, 0.13, 0.11], [0.22, -0.07, 0.045], 0x222d33);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      voxelTile(backpack, `packVoxel${row}_${col}`, -0.108 + col * 0.072, 0.095 - row * 0.075, 0.235, (row + col) % 2 ? 0x10171c : 0x3f4b51, 0.95);
    }
  }
  boxPart(backpack, 'strapL', [0.055, 0.36, 0.035], [-0.14, 0, -0.1], 0x171f25);
  boxPart(backpack, 'strapR', [0.055, 0.36, 0.035], [0.14, 0, -0.1], 0x171f25);
  boxPart(backpack, 'strapHighlightL', [0.018, 0.30, 0.018], [-0.118, 0.01, -0.126], 0x455058);
  boxPart(backpack, 'strapHighlightR', [0.018, 0.30, 0.018], [0.118, 0.01, -0.126], 0x455058);
  visual.add(backpack);

  root.userData = { visual, leftArm, rightArm, leftLeg, rightLeg };
  root.rotation.y = 0;
  return root;
}

const player = makePlayer();
player.position.set(startX, 0, startZ);
scene.add(player);

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

canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  guide.classList.add('is-hidden');
});
canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  cameraYaw -= event.movementX * 0.006;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + event.movementY * 0.004, cameraPitchMin, cameraPitchMax);
});
canvas.addEventListener('wheel', (event) => {
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.003, 2.7, 8);
}, { passive: true });

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
  minimapRoads.innerHTML = `
    <rect x="${road.left.toFixed(2)}" y="${road.top.toFixed(2)}" width="${(road.right - road.left).toFixed(2)}" height="${(road.bottom - road.top).toFixed(2)}" fill="#b8afa4" opacity=".9"/>
    <polygon points="${connectorPoints}" fill="#9d9992" opacity=".94"/>
    <polygon points="${stairPoints}" fill="#8d8b87" opacity=".92"/>
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
  cameraTarget.set(player.position.x, player.position.y + 0.67, player.position.z);
  const lookUpAmount = Math.max(0, -cameraPitch);
  cameraLookTarget.set(
    cameraTarget.x,
    cameraTarget.y + lookUpAmount * 2.15,
    cameraTarget.z
  );
  const horizontal = Math.cos(cameraPitch) * cameraDistance;
  desiredCamera.set(
    cameraTarget.x + Math.sin(cameraYaw) * horizontal,
    cameraTarget.y + Math.sin(cameraPitch) * cameraDistance + 0.35,
    cameraTarget.z + Math.cos(cameraYaw) * horizontal
  );
  desiredCamera.y = Math.max(desiredCamera.y, player.position.y + 0.18);
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

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;
  updatePlayer(dt);
  updateCamera(dt);
  updateMinimap();
  updateRiver(now);
  renderer.render(scene, camera);
}

initMinimap();
updateCamera(1);
requestAnimationFrame(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
