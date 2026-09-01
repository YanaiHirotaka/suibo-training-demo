let audioEnabled = true;
let audioContext = null;
let masterAudioGain = null;
let rainAudioGain = null;

export function isAudioEnabled() {
  return audioEnabled;
}

export function ensureAudio() {
  if (audioContext) {
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  masterAudioGain = audioContext.createGain();
  masterAudioGain.gain.value = audioEnabled ? 0.55 : 0;
  masterAudioGain.connect(audioContext.destination);

  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  const rainSource = audioContext.createBufferSource();
  const rainFilter = audioContext.createBiquadFilter();
  rainAudioGain = audioContext.createGain();
  rainSource.buffer = buffer;
  rainSource.loop = true;
  rainFilter.type = 'bandpass';
  rainFilter.frequency.value = 2600;
  rainFilter.Q.value = 0.45;
  rainAudioGain.gain.value = 0;
  rainSource.connect(rainFilter).connect(rainAudioGain).connect(masterAudioGain);
  rainSource.start();
  return audioContext;
}

export function setRainAudioLevel(level) {
  if (!rainAudioGain || !audioContext) return;
  rainAudioGain.gain.setTargetAtTime(audioEnabled ? level : 0, audioContext.currentTime, 0.18);
}

export function playToneSequence(notes) {
  const context = ensureAudio();
  if (!context || !audioEnabled || !masterAudioGain) return;
  let startTime = context.currentTime + 0.02;
  notes.forEach(({ frequency, duration, volume = 0.16 }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain).connect(masterAudioGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
    startTime += duration + 0.045;
  });
}

export function setAudioEnabled(enabled) {
  audioEnabled = Boolean(enabled);
  if (!audioContext || !masterAudioGain) return;
  masterAudioGain.gain.setTargetAtTime(audioEnabled ? 0.55 : 0, audioContext.currentTime, 0.05);
}
