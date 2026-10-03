import { generateId, clampDuration, findClipAtTime } from './timeline.js';

/**
 * Resolves an expression name against available library expression objects.
 * Matches case-insensitively, strips extensions, performs substring matching,
 * and falls back safely to 'smile' or the first available expression.
 *
 * @param {string} rawName - The expression name from JSON/AI
 * @param {Array<Object>} availableExpressions - Array of { id, name, filename, url } objects
 * @returns {Object|null} Matching expression object
 */
export function resolveExpressionObject(rawName, availableExpressions = []) {
  if (!availableExpressions || availableExpressions.length === 0) {
    const clean = (rawName || 'smile').replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().trim();
    return {
      id: clean,
      name: clean,
      filename: `${clean}.png`,
      url: `/expressions/${clean}.png`,
    };
  }

  const cleaned = (rawName || '').replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().trim();

  // 1. Exact match (by clean name or filename)
  const exact = availableExpressions.find((exp) => {
    const expClean = (exp.name || '').replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().trim();
    return expClean === cleaned || (exp.filename && exp.filename.toLowerCase() === cleaned);
  });
  if (exact) return exact;

  // 2. Substring match
  if (cleaned.length > 0) {
    const sub = availableExpressions.find((exp) => {
      const expClean = (exp.name || '').replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().trim();
      return cleaned.includes(expClean) || expClean.includes(cleaned);
    });
    if (sub) return sub;
  }

  // 3. Fallback: prefer "smile", then first available
  const smileFallback = availableExpressions.find((exp) =>
    (exp.name || '').toLowerCase().includes('smile')
  );
  return smileFallback || availableExpressions[0];
}

/**
 * Converts JSON or an array of items into fully hydrated timeline clip objects.
 *
 * @param {string|Array<Object>} jsonOrItems - Array of { expression, duration } or JSON string
 * @param {Array<Object>} availableExpressions - Array of expression library objects
 * @returns {Array<Object>} Array of timeline clips: { id, expression, duration }
 */
export function jsonToTimelineClips(jsonOrItems, availableExpressions = []) {
  let items = jsonOrItems;

  if (typeof items === 'string') {
    const trimmed = items.trim();
    if (!trimmed) return [];
    try {
      items = JSON.parse(trimmed);
    } catch {
      // Fallback: check if it's a comma-delimited sequence string (e.g. "smile, 0.6; wink, 0.3")
      if (trimmed.includes(',')) {
        items = trimmed
          .split(';')
          .map((segment) => segment.trim())
          .filter(Boolean)
          .map((segment) => {
            const parts = segment.split(',');
            const rawName = parts[0]?.trim() || '';
            const duration = parts[1] ? parseFloat(parts[1].trim()) : 0.6;
            return {
              expression: rawName,
              duration: isNaN(duration) ? 0.6 : duration,
            };
          })
          .filter((item) => item.expression.length > 0);
      } else {
        items = [];
      }
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items
    .filter((item) => item && (item.expression || typeof item === 'string'))
    .map((item) => {
      const rawName = typeof item === 'string' ? item : item.expression;
      const rawDuration = typeof item === 'object' && item.duration !== undefined ? item.duration : 0.6;

      const expressionObj = resolveExpressionObject(rawName, availableExpressions);
      const duration = clampDuration(rawDuration);

      return {
        id: generateId(),
        expression: expressionObj,
        duration,
      };
    });
}

/**
 * Splices a sequence of new clips into an existing timeline right after the playhead position.
 * If the playhead is past all clips or the timeline is empty, appends to the end.
 *
 * @param {Array<Object>} existingClips - Current timeline clips
 * @param {Array<Object>} newClips - New clips to insert
 * @param {number} playhead - Current playhead timestamp in seconds
 * @returns {Array<Object>} Next timeline clips array
 */
export function insertSequenceAtPlayhead(existingClips = [], newClips = [], playhead = 0) {
  if (!Array.isArray(newClips) || newClips.length === 0) {
    return existingClips || [];
  }
  if (!Array.isArray(existingClips) || existingClips.length === 0) {
    return [...newClips];
  }

  const active = findClipAtTime(existingClips, playhead);
  const insertIndex = active ? active.index + 1 : existingClips.length;

  const result = [...existingClips];
  result.splice(insertIndex, 0, ...newClips);
  return result;
}
