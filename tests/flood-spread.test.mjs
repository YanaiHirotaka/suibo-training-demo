import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FLOOD_ARRIVAL_BAND_COUNT,
  buildConnectedFloodMap,
  connectedFloodArrivalRatio,
  floodArrivalBandIndex,
  localFloodLevelMeters
} from '../modules/flood-spread.js';

function buildMap(heights, blocked = new Set()) {
  const depth = heights.length;
  const width = heights[0].length;
  return buildConnectedFloodMap({
    width,
    depth,
    isFloodable: (x, z) => !blocked.has(`${x},${z}`),
    heightAt: (x, z) => heights[z][x],
    isSource: (x) => x === 0
  });
}

test('川からつながる低い経路を優先して浸水する', () => {
  const result = buildMap([
    [0, 4, 0, 0],
    [0, 0, 0, 0]
  ]);
  assert.equal(result.spillHeightBlocks[3], 0);
  assert.equal(result.distanceSteps[3], 4);
});

test('高い堤防しかない場合は堤防の高さまで到達が遅れる', () => {
  const result = buildMap([[0, 4, 0]]);
  assert.equal(result.spillHeightBlocks[2], 4);
  const ratio = connectedFloodArrivalRatio(4, 2, {
    blockSizeMeters: 0.3125,
    maximumLevelMeters: 2.5,
    mapWidthBlocks: 3
  });
  assert.equal(ratio, 0.5);
});

test('接続されていない場所は最高水位でも浸水しない', () => {
  const result = buildMap([[0, 0, 0]], new Set(['1,0']));
  assert.equal(result.spillHeightBlocks[2], Number.POSITIVE_INFINITY);
  assert.equal(connectedFloodArrivalRatio(result.spillHeightBlocks[2], 0, {
    blockSizeMeters: 0.3125,
    maximumLevelMeters: 3,
    mapWidthBlocks: 3
  }), 1);
  assert.equal(localFloodLevelMeters(3, 3, 1), 0);
});

test('到達後の水面は河川の基準水位と一致する', () => {
  assert.equal(localFloodLevelMeters(1.5, 3, 0.2), 1.5);
  assert.equal(localFloodLevelMeters(0.5, 3, 0.2), 0);
});

test('描画用の到達バンドは範囲内に収まる', () => {
  assert.equal(floodArrivalBandIndex(0), 0);
  assert.equal(floodArrivalBandIndex(1), FLOOD_ARRIVAL_BAND_COUNT - 1);
});
