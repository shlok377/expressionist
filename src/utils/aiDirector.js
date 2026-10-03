export const PACING_WPM = {
  slow: 120,
  normal: 150,
  fast: 180,
};

export const PERSONALITY_PRESETS = [
  {
    id: 'high-energy',
    name: 'High-Energy Mascot',
    description: 'Rapid cuts (0.3s–0.6s), expressive reactions, bouncy and enthusiastic.',
    prompt: 'High-energy, animated, upbeat mascot. Reacts quickly to punchlines and excitement with rapid, dynamic expressions.',
  },
  {
    id: 'deadpan',
    name: 'Deadpan & Sarcastic',
    description: 'Longer holds (0.8s–1.5s), subtle side-eyes, deadpan reactions.',
    prompt: 'Dry, deadpan, unimpressed and sarcastic reviewer. Holds skeptical or tired expressions during absurd remarks.',
  },
  {
    id: 'educational',
    name: 'Warm & Educational',
    description: 'Steady pacing (0.6s–1.2s), welcoming smiles and pointing gestures.',
    prompt: 'Friendly, warm, and helpful guide. Uses supportive smiles and explanatory pointing gestures matching the spoken directions.',
  },
  {
    id: 'custom',
    name: 'Custom Persona',
    description: 'Define your own personality and directing style.',
    prompt: '',
  },
];

/**
 * Estimates reading duration in seconds from script text based on speaking pacing.
 *
 * @param {string} text - Voiceover script text
 * @param {'slow'|'normal'|'fast'} [pacing='normal'] - Speaking cadence
 * @returns {number} Estimated duration in seconds (1 decimal precision)
 */
export function estimateScriptDuration(text, pacing = 'normal') {
  if (!text || typeof text !== 'string') return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  const wpm = PACING_WPM[pacing] || PACING_WPM.normal;
  const duration = (words.length / wpm) * 60;
  return Math.max(0.6, Math.round(duration * 10) / 10);
}

/**
 * Formats validated items into the target output representation.
 *
 * @param {Array<{expression: string, duration: number}>} items
 * @param {'clean'|'extension'|'json'} [format='clean']
 * @returns {string} Formatted output
 */
export function formatSequence(items, format = 'clean') {
  if (!Array.isArray(items) || items.length === 0) return '';

  if (format === 'json') {
    return JSON.stringify(
      items.map((i) => ({ expression: i.expression, duration: i.duration })),
      null,
      2
    );
  }

  const withExt = format === 'extension';
  return items
    .map((item) => {
      const name = withExt ? `${item.expression}.png` : item.expression;
      return `${name}, ${item.duration.toFixed(1)}`;
    })
    .join('; ');
}

/**
 * Parses a sequence string back into structured items.
 * Handles "expression, 0.5; expression, 0.2" formats.
 */
export function parseSequenceString(str) {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const parts = segment.split(',');
      const rawName = parts[0]?.trim() || '';
      const cleanName = rawName.replace(/\.[a-zA-Z0-9]+$/, '');
      const duration = parts[1] ? parseFloat(parts[1].trim()) : 0.6;
      return {
        expression: cleanName,
        duration: isNaN(duration) ? 0.6 : Math.round(duration * 10) / 10,
      };
    })
    .filter((item) => item.expression.length > 0);
}
