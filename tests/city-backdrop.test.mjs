import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cityBackdropBuildingProfile,
  cityBackdropLightState,
  createCityBackdropPlan
} from '../modules/city-backdrop.js';

test('背景建物の寸法と窓数は描画用の安全な範囲に収まる', () => {
  for (let index = 0; index < 40; index += 1) {
    const building = cityBackdropBuildingProfile(index);
    assert.ok(building.width >= 3.6 && building.width <= 6.4);
    assert.ok(building.depth >= 3.2 && building.depth <= 5.4);
    assert.ok(building.height >= 7.2 && building.height <= 18);
    assert.ok(building.windowColumns >= 2 && building.windowColumns <= 4);
    assert.ok(building.windowRows >= 3 && building.windowRows <= 7);
  }
});

test('背景街区は同じ入力から常に同じ配置計画を返す', () => {
  assert.deepEqual(createCityBackdropPlan(false), createCityBackdropPlan(false));
});

test('スマホ用計画は三方向を維持しながら棟数を削減する', () => {
  const desktop = createCityBackdropPlan(false);
  const mobile = createCityBackdropPlan(true);
  assert.ok(mobile.length < desktop.length);
  assert.deepEqual(new Set(mobile.map(({ side }) => side)), new Set(['north', 'west', 'east']));
});

test('悪天候では背景建物の窓が見つけやすくなる', () => {
  const clear = cityBackdropLightState(0, 2);
  const storm = cityBackdropLightState(1, 2);
  assert.ok(storm.opacity > clear.opacity);
  assert.ok(storm.emissiveIntensity > clear.emissiveIntensity);
});
