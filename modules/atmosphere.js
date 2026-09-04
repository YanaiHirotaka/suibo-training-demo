function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function weatherVisualState(weatherIntensity, floodProgress) {
  const rain = clamp01(weatherIntensity);
  const flood = clamp01(floodProgress);
  const wetness = rain * rain * (3 - 2 * rain);
  const stormAmount = rain * 0.78;

  return {
    wetness,
    stormAmount,
    exposure: lerp(1.08, 0.94, stormAmount),
    roadRoughness: lerp(0.56, 0.27, wetness),
    roadMetalness: lerp(0.07, 0.16, wetness),
    pavingRoughness: lerp(0.42, 0.19, wetness),
    pavingMetalness: lerp(0.11, 0.23, wetness),
    puddleOpacity: lerp(0, 0.11, wetness),
    floodOpacity: lerp(0.64, 0.76, flood),
    riverRoughness: lerp(0.08, 0.045, rain)
  };
}
