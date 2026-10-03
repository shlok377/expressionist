import fs from 'fs';
import path from 'path';

export const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

/**
 * Extracts clean expression names from an expressions directory by stripping supported extensions.
 *
 * @param {string} expressionsDir - Path to the expressions folder
 * @param {object} [fsModule=fs] - File system implementation for dependency injection / testing
 * @returns {string[]} Alphabetically sorted array of clean expression names
 */
export function getCleanExpressionNames(expressionsDir, fsModule = fs) {
  try {
    if (!fsModule.existsSync(expressionsDir)) {
      return [];
    }
    const files = fsModule.readdirSync(expressionsDir);
    const names = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return SUPPORTED_EXTS.has(ext);
      })
      .map((file) => {
        const ext = path.extname(file);
        return path.basename(file, ext).trim();
      })
      .filter((name) => name.length > 0);

    // Deduplicate and sort alphabetically
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error('Error scanning expressions for manifest:', err);
    return [];
  }
}

/**
 * Synchronizes the expression manifest file on disk.
 *
 * @param {string} expressionsDir - Path to expressions directory
 * @param {string} manifestPath - Path to target expressions_list.json file
 * @param {object} [fsModule=fs] - File system implementation
 * @returns {string[]} The written list of clean expression names
 */
export function syncExpressionManifest(expressionsDir, manifestPath, fsModule = fs) {
  const names = getCleanExpressionNames(expressionsDir, fsModule);
  try {
    const parentDir = path.dirname(manifestPath);
    if (!fsModule.existsSync(parentDir)) {
      fsModule.mkdirSync(parentDir, { recursive: true });
    }
    fsModule.writeFileSync(manifestPath, JSON.stringify(names, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing expression manifest file:', err);
  }
  return names;
}
