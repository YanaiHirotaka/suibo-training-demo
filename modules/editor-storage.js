import { readStoredJson, writeStoredJson } from './storage.js?v=20260901-24';

const TILE_PAINT_STORAGE_KEY = 'suiboTilePaintOverrides';
const HEIGHT_PAINT_STORAGE_KEY = 'suiboHeightPaintOverrides';
const FLOATING_BLOCK_STORAGE_KEY = 'suiboFloatingRangeBlocks';
const STRUCTURE_OFFSET_STORAGE_KEY = 'suiboStructureOffsets';

function loadEntryList(key, label) {
  const entries = readStoredJson(key, [], label);
  return Array.isArray(entries) ? entries : [];
}

export function loadTilePaintOverrides() {
  return loadEntryList(TILE_PAINT_STORAGE_KEY, 'paint overrides');
}

export function loadHeightPaintOverrides() {
  return loadEntryList(HEIGHT_PAINT_STORAGE_KEY, 'height overrides');
}

export function loadFloatingBlocks() {
  return loadEntryList(FLOATING_BLOCK_STORAGE_KEY, 'floating range blocks');
}

export function saveTerrainEditorState({ tiles, heights, floating }) {
  const results = [
    writeStoredJson(TILE_PAINT_STORAGE_KEY, tiles, 'paint overrides'),
    writeStoredJson(HEIGHT_PAINT_STORAGE_KEY, heights, 'height overrides'),
    writeStoredJson(FLOATING_BLOCK_STORAGE_KEY, floating, 'floating range blocks')
  ];
  return results.every(Boolean);
}

export function loadStructureOffsets() {
  return loadEntryList(STRUCTURE_OFFSET_STORAGE_KEY, 'structure offsets');
}

export function saveStructureOffsets(offsets) {
  return writeStoredJson(STRUCTURE_OFFSET_STORAGE_KEY, offsets, 'structure offsets');
}
