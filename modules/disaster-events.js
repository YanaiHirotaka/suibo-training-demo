function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function lowRoadEventState(floodProgress, closureActive = false, closureSkipped = false) {
  const progress = clamp01(floodProgress);
  const closureThreshold = 0.2;
  const approachRatio = clamp01(progress / closureThreshold);

  if (closureSkipped) {
    return {
      key: 'passed',
      label: '低地道路は通過済み',
      detail: '後戻りは不要です',
      approachRatio: 1
    };
  }
  if (closureActive || progress >= closureThreshold) {
    return {
      key: 'active',
      label: '低地道路 通行止め',
      detail: '高い道路へ迂回',
      approachRatio: 1
    };
  }
  if (progress >= 0.12) {
    return {
      key: 'imminent',
      label: '低地道路へ冠水接近',
      detail: '迂回路を確認',
      approachRatio
    };
  }
  return {
    key: 'monitoring',
    label: '低地道路を監視中',
    detail: `冠水接近 ${Math.round(approachRatio * 100)}%`,
    approachRatio
  };
}
