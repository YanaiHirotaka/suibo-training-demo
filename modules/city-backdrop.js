const BACKDROP_SIDES = Object.freeze(['north', 'west', 'east']);

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function hash01(index, salt) {
  let value = Math.imul((index + 1) ^ salt, 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 0xffffffff;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function cityBackdropBuildingProfile(index) {
  const safeIndex = Math.max(0, Math.floor(Number(index) || 0));
  const height = 7.2 + hash01(safeIndex, 0x31f2) * 10.8;
  return Object.freeze({
    width: round(3.6 + hash01(safeIndex, 0x87d1) * 2.8),
    depth: round(3.2 + hash01(safeIndex, 0xa3b5) * 2.2),
    height: round(height),
    colorIndex: Math.floor(hash01(safeIndex, 0xc7e9) * 6) % 6,
    windowColumns: 2 + Math.floor(hash01(safeIndex, 0xe411) * 3),
    windowRows: Math.max(3, Math.min(7, Math.floor(height / 2.15))),
    roofKind: Math.floor(hash01(safeIndex, 0x1963) * 3),
    offset: round((hash01(safeIndex, 0x5b8d) - 0.5) * 1.5)
  });
}

export function createCityBackdropPlan(mobile = false) {
  const counts = mobile ? [7, 4, 4] : [10, 6, 6];
  const plan = [];
  let profileIndex = 0;

  BACKDROP_SIDES.forEach((side, sideIndex) => {
    const count = counts[sideIndex];
    for (let index = 0; index < count; index += 1) {
      plan.push(Object.freeze({
        side,
        along: (index + 0.5) / count,
        ...cityBackdropBuildingProfile(profileIndex)
      }));
      profileIndex += 1;
    }
  });

  return Object.freeze(plan);
}

export function cityBackdropLightState(weatherIntensity, timeSeconds) {
  const storm = clamp01(weatherIntensity);
  const pulse = (Math.sin((Number(timeSeconds) || 0) * 0.72) + 1) / 2;
  return {
    opacity: round(0.5 + storm * 0.18 + pulse * 0.045),
    emissiveIntensity: round(0.42 + storm * 0.48 + pulse * 0.08)
  };
}
