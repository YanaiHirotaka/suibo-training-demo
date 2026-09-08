export const SUCCESS_PRESENTATION_TIMING = Object.freeze({
  cameraDurationMs: 1100,
  titleRevealMs: 520,
  statsRevealMs: 980,
  focusMs: 1450
});

export function easeInOutCubic(value) {
  const t = Math.max(0, Math.min(1, value));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function successPresentationState(elapsedMs, reducedMotion = false) {
  if (reducedMotion) {
    return {
      cameraProgress: 1,
      titleVisible: true,
      statsVisible: true,
      scoreProgress: 1,
      focusReady: true
    };
  }

  const elapsed = Math.max(0, elapsedMs);
  const scoreDuration = Math.max(1, SUCCESS_PRESENTATION_TIMING.focusMs - SUCCESS_PRESENTATION_TIMING.statsRevealMs);
  return {
    cameraProgress: easeInOutCubic(elapsed / SUCCESS_PRESENTATION_TIMING.cameraDurationMs),
    titleVisible: elapsed >= SUCCESS_PRESENTATION_TIMING.titleRevealMs,
    statsVisible: elapsed >= SUCCESS_PRESENTATION_TIMING.statsRevealMs,
    scoreProgress: easeInOutCubic((elapsed - SUCCESS_PRESENTATION_TIMING.statsRevealMs) / scoreDuration),
    focusReady: elapsed >= SUCCESS_PRESENTATION_TIMING.focusMs
  };
}
