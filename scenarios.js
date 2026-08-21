export const TRAINING_SCENARIOS = Object.freeze([
  {
    id: 'beginner',
    name: '初級訓練',
    badge: 'ゆっくり確認',
    description: '水位上昇が緩やか。ハザードマップと基本操作を確認しながら避難します。',
    timeLimitSeconds: 300,
    flood: { maxLevelMeters: 2.2, riseSeconds: 240, forecastRiseMeters: 0.8 },
    scoreMultiplier: 0.85
  },
  {
    id: 'standard',
    name: '標準訓練',
    badge: '推奨',
    description: '水位変化を確認し、安全ルートで近くの人と避難する標準シナリオです。',
    timeLimitSeconds: 180,
    flood: { maxLevelMeters: 3, riseSeconds: 150, forecastRiseMeters: 1.2 },
    scoreMultiplier: 1
  },
  {
    id: 'rapid',
    name: '迅速避難',
    badge: '上級',
    description: '水位が急速に上昇します。素早い判断と安全ルートの維持が必要です。',
    timeLimitSeconds: 135,
    flood: { maxLevelMeters: 3.2, riseSeconds: 105, forecastRiseMeters: 1.6 },
    scoreMultiplier: 1.2
  }
]);

export function getTrainingScenario(id) {
  return TRAINING_SCENARIOS.find((scenario) => scenario.id === id) || TRAINING_SCENARIOS[1];
}
