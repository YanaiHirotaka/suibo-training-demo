function evenlySpaced(start, end, count) {
  if (count <= 1) return [start];
  return Array.from({ length: count }, (_, index) => start + (end - start) * index / (count - 1));
}

export function createUrbanUtilityPlan({
  mobile = false,
  mainRoadSideX,
  mainRoadNorthZ,
  mainRoadSouthZ,
  crossStreetSideZ,
  crossStreetWestX,
  crossStreetEastX
}) {
  const mainCount = mobile ? 6 : 9;
  const crossCount = mobile ? 3 : 5;
  const mainPoles = evenlySpaced(mainRoadSouthZ, mainRoadNorthZ, mainCount).map((z, index) => ({
    id: `main-${index}`,
    line: 'main',
    x: mainRoadSideX,
    z,
    crossarmAxis: 'x'
  }));
  const crossPoles = evenlySpaced(crossStreetEastX, crossStreetWestX, crossCount).map((x, index) => ({
    id: `cross-${index}`,
    line: 'cross',
    x,
    z: crossStreetSideZ,
    crossarmAxis: 'z'
  }));
  const poles = [...mainPoles, ...crossPoles];
  const spans = [];
  for (const line of [mainPoles, crossPoles]) {
    for (let index = 1; index < line.length; index += 1) {
      spans.push({ from: line[index - 1].id, to: line[index].id });
    }
  }
  return Object.freeze({
    poles: Object.freeze(poles),
    spans: Object.freeze(spans),
    cableSegmentsPerSpan: mobile ? 6 : 10
  });
}

export function cableSagOffset(amount, sagMeters = 0.32) {
  const t = Math.min(1, Math.max(0, Number(amount) || 0));
  if (t === 0 || t === 1) return 0;
  return -4 * Math.max(0, Number(sagMeters) || 0) * t * (1 - t);
}
