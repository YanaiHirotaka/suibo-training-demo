const TRAINING_RECORDS_STORAGE_KEY = 'suibo-training-records-v1';
const TRAINING_PROGRESS_STORAGE_KEY = 'suibo-training-progress-v1';
const TOUCH_TUTORIAL_STORAGE_KEY = 'suibo-touch-tutorial-complete-v1';

export const TRAINING_PROGRESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function readStoredJson(key, fallback, label) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    console.warn(`Could not load ${label}:`, error);
    return fallback;
  }
}

export function writeStoredJson(key, value, label) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save ${label}:`, error);
    return false;
  }
}

export function loadTrainingRecords() {
  const stored = readStoredJson(TRAINING_RECORDS_STORAGE_KEY, {}, 'training records');
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

export function saveTrainingRecords(records) {
  return writeStoredJson(TRAINING_RECORDS_STORAGE_KEY, records, 'training records');
}

export function loadTrainingProgress() {
  return readStoredJson(TRAINING_PROGRESS_STORAGE_KEY, null, 'training progress');
}

export function saveTrainingProgress(progress) {
  return writeStoredJson(TRAINING_PROGRESS_STORAGE_KEY, progress, 'training progress');
}

export function clearTrainingProgress() {
  try {
    localStorage.removeItem(TRAINING_PROGRESS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isTouchTutorialComplete() {
  try {
    return localStorage.getItem(TOUCH_TUTORIAL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markTouchTutorialComplete() {
  try {
    localStorage.setItem(TOUCH_TUTORIAL_STORAGE_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}
