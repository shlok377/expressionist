import path from 'fs';

export const MIN_CLIP_DURATION = 0.2;
export const MAX_CLIP_DURATION = 2.0;
export const DEFAULT_CLIP_DURATION = 0.6;

/**
 * In-memory IP rate limiter:
 * - Max 5 requests per 60 seconds window
 * - Minimum 3 seconds debounce cooldown between requests
 */
export class RateLimiter {
  constructor({ maxRequests = 5, windowMs = 60000, cooldownMs = 3000 } = {}) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.cooldownMs = cooldownMs;
    this.records = new Map(); // ip -> { timestamps: [], lastRequest: number }
  }

  isAllowed(ip) {
    const now = Date.now();
    let record = this.records.get(ip);
    if (!record) {
      record = { timestamps: [], lastRequest: 0 };
      this.records.set(ip, record);
    }

    // Cooldown check (debounce)
    if (record.lastRequest && now - record.lastRequest < this.cooldownMs) {
      const waitSeconds = Math.ceil((this.cooldownMs - (now - record.lastRequest)) / 1000);
      return {
        allowed: false,
        error: `Please wait ${waitSeconds}s before requesting again.`,
        retryAfter: waitSeconds,
      };
    }

    // Window check
    record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const waitSeconds = Math.ceil((this.windowMs - (now - oldest)) / 1000);
      return {
        allowed: false,
        error: `Rate limit exceeded (max ${this.maxRequests} requests per minute). Try again in ${waitSeconds}s.`,
        retryAfter: waitSeconds,
      };
    }

    record.timestamps.push(now);
    record.lastRequest = now;
    return { allowed: true };
  }

  reset() {
    this.records.clear();
  }
}

/**
 * Clamps duration between 0.2s and 2.0s with 1 decimal precision.
 */
export function clampDuration(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return DEFAULT_CLIP_DURATION;
  const rounded = Math.round(num * 10) / 10;
  return Math.min(MAX_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, rounded));
}

/**
 * Sanitizes and fuzzy-matches an expression name against the available names list.
 *
 * @param {string} rawName - The name provided by the AI
 * @param {string[]} availableNames - Array of clean available expression names
 * @returns {string} Best matching expression name from availableNames
 */
export function matchExpression(rawName, availableNames = []) {
  if (!availableNames || availableNames.length === 0) {
    return (rawName || 'smile').toLowerCase().trim();
  }

  if (!rawName || typeof rawName !== 'string') {
    return availableNames.includes('smile') ? 'smile' : availableNames[0];
  }

  // Strip any extensions like .png, .jpg if passed
  const cleaned = rawName.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().trim();

  // 1. Exact match (case-insensitive)
  const exact = availableNames.find((name) => name.toLowerCase() === cleaned);
  if (exact) return exact;

  // 2. Substring match (e.g. "blushing" -> "blush")
  const sub = availableNames.find(
    (name) => cleaned.includes(name.toLowerCase()) || name.toLowerCase().includes(cleaned)
  );
  if (sub) return sub;

  // 3. Fallback: prefer "smile", then "neutral", then first available
  if (availableNames.includes('smile')) return 'smile';
  return availableNames[0];
}

/**
 * Formats an array of { expression, duration } items into a delimited string.
 * Example: "happy, 0.5; wink, 0.2; smile, 0.6"
 */
export function formatSequenceString(items, { withExtension = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map((item) => {
      const name = withExtension ? `${item.expression}.png` : item.expression;
      return `${name}, ${item.duration.toFixed(1)}`;
    })
    .join('; ');
}

/**
 * AI Director Service
 */
export class AiDirector {
  constructor({ rateLimiter = new RateLimiter(), fetchImpl = globalThis.fetch } = {}) {
    this.rateLimiter = rateLimiter;
    this.fetch = fetchImpl;
  }

  /**
   * Generates a sequence of expressions from a script using Google Gemini.
   */
  async processScript({
    script,
    targetDuration = null,
    personality = 'High-Energy Mascot',
    customPrompt = '',
    availableExpressions = [],
    apiKey,
    model = 'gemini-2.5-flash',
    ip = '127.0.0.1',
  }) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw { status: 401, message: 'Gemini API key is required. Please provide your key in settings.' };
    }

    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      throw { status: 400, message: 'Voiceover script text is required.' };
    }

    // Rate limit check
    const rateCheck = this.rateLimiter.isAllowed(ip);
    if (!rateCheck.allowed) {
      throw { status: 429, message: rateCheck.error, retryAfter: rateCheck.retryAfter };
    }

    const vocabList = availableExpressions.length > 0
      ? availableExpressions
      : ['angry', 'blush', 'bruh', 'laughing', 'smile', 'surprised', 'wink'];

    const durationInstruction = targetDuration && targetDuration > 0
      ? `The voiceover audio or reading duration is approximately ${targetDuration.toFixed(1)} seconds. Make sure the sum of all clip durations closely matches approximately ${targetDuration.toFixed(1)}s (within +/- 10%).`
      : 'Estimate appropriate timing based on the script pacing, ensuring natural comedic cadence.';

    const systemInstruction = `You are an expert animated mascot director. You direct mascot reaction animations by choosing the best facial expression for each segment of a voiceover script.

Available Expressions Vocabulary:
[${vocabList.map((e) => `"${e}"`).join(', ')}]

Rules:
1. ONLY choose expressions from the Available Expressions list above.
2. For each expression cut, assign a duration in seconds between 0.2 and 2.0 (in 0.1s increments).
3. ${durationInstruction}
4. Reflect the mascot's personality: "${personality}".
${customPrompt ? `Additional personality / direction instructions: "${customPrompt}"` : ''}
5. Return a JSON array of objects, where each object has:
   - "expression": exact name from available expressions list
   - "duration": number between 0.2 and 2.0
   - "scriptSegment": the spoken phrase or emotion this expression covers`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `Here is the voiceover script to direct:\n"""\n${script}\n"""` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              expression: {
                type: 'STRING',
                enum: vocabList,
              },
              duration: {
                type: 'NUMBER',
              },
              scriptSegment: {
                type: 'STRING',
              },
            },
            required: ['expression', 'duration'],
          },
        },
      },
    };

    const targetModel = model || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    let response;
    try {
      response = await this.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      console.error('Fetch network error to Gemini API:', err);
      throw { status: 502, message: `Failed to connect to Gemini API: ${err.message}` };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errMsg = `Gemini API returned status ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errMsg = parsed.error.message;
        }
      } catch {
        if (errText) errMsg = errText;
      }

      if (response.status === 400 && errMsg.includes('API_KEY_INVALID')) {
        throw { status: 401, message: 'Invalid Gemini API key. Please verify your API key in settings.' };
      }
      if (response.status === 429) {
        throw { status: 429, message: 'Gemini API quota exceeded or rate limited. Please try again later.' };
      }
      throw { status: response.status, message: errMsg };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const textContent = candidate?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw { status: 500, message: 'No response received from Gemini model.' };
    }

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(textContent);
    } catch (err) {
      console.error('Failed to parse Gemini JSON output:', textContent);
      throw { status: 500, message: 'Invalid JSON response from AI model.' };
    }

    if (!Array.isArray(parsedItems)) {
      parsedItems = [parsedItems];
    }

    // Validate, sanitize, fuzzy-match, and clamp
    const validatedItems = parsedItems.map((item) => {
      const expression = matchExpression(item.expression, vocabList);
      const duration = clampDuration(item.duration);
      return {
        expression,
        duration,
        scriptSegment: item.scriptSegment || '',
      };
    });

    const sequenceString = formatSequenceString(validatedItems, { withExtension: false });
    const sequenceStringWithExt = formatSequenceString(validatedItems, { withExtension: true });
    const totalDuration = Math.round(validatedItems.reduce((acc, i) => acc + i.duration, 0) * 10) / 10;

    return {
      success: true,
      sequenceString,
      sequenceStringWithExt,
      items: validatedItems,
      totalDuration,
      count: validatedItems.length,
    };
  }
}
