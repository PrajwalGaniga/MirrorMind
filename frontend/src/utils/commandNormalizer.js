/**
 * commandNormalizer.js — Module 9.1 STT Artifact Cleanup
 *
 * Deterministic text normalization layer that runs BEFORE intent detection.
 * Cleans up common Whisper transcription artifacts, accented characters,
 * filler words, and known mis-transcriptions so that the intent detector
 * can reliably match short commands.
 *
 * IMPORTANT: No blind replacements. Every normalization is a specific,
 * safe, known mapping that cannot change the semantic meaning of a
 * legitimate question.
 */

// ── Accented character map ──────────────────────────────────────────────────
const ACCENT_MAP = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ñ': 'n', 'ç': 'c',
};

function stripAccents(str) {
  return str.replace(/[àáâãäèéêëìíîïòóôõöùúûüñç]/gi, (match) => {
    return ACCENT_MAP[match.toLowerCase()] || match;
  });
}

// ── Known STT mis-transcriptions → safe corrections ─────────────────────────
// These are ONLY applied to short inputs (< 12 words) to avoid mangling real questions.
const STT_CORRECTIONS = [
  // "mirror mind" → "mirrormind" (common split by Whisper)
  [/\bmirror\s+mind\b/gi, 'mirrormind'],
  // "see v" / "c v" / "c.v." / "c.v" → "cv"
  [/\b(see\s+v|c\s+v|c\.v\.?)\b/gi, 'cv'],
  // "g p a" / "g.p.a" → "gpa"
  [/\b(g\s+p\s+a|g\.p\.a\.?)\b/gi, 'gpa'],
  // "c g p a" / "c.g.p.a" → "cgpa"
  [/\b(c\s+g\s+p\s+a|c\.g\.p\.a\.?)\b/gi, 'cgpa'],
  // "dot pdf" / ".pdf" / "pdf" suffix after document names
  [/\s*(\.?\s*pdf)\s*$/gi, ''],
  // "dot doc" / ".doc" suffix
  [/\s*(\.?\s*docx?)\s*$/gi, ''],
];

// ── Filler phrases to strip (anchored at start) ─────────────────────────────
const START_FILLERS = [
  /^(excuse me|pardon me|hey|hi|hello)\s*,?\s*/i,
  /^(can you|could you|would you|will you)\s+(please\s+)?/i,
  /^(please|kindly)\s+/i,
  /^(i would like to|i'd like to|i want to|i wanna|i need to)\s+/i,
  /^(let me|let's)\s+/i,
  /^(go ahead and|just)\s+/i,
  /^(mirror\s*mind|mirrormind)\s*,?\s*/i,
];

// ── Filler words to strip (anywhere) ────────────────────────────────────────
const INLINE_FILLERS = [
  /\b(uh+|um+|hmm+|ah+|er+|like)\b/gi,
];

// ── Article/pronoun simplification ──────────────────────────────────────────
// "show me my resume" → "show my resume"
// "can you show me the resume" → "show resume" (after START_FILLERS strip)
const PRONOUN_SIMPLIFICATIONS = [
  [/\bshow\s+me\s+(my|the)\b/gi, 'show $1'],
  [/\bshow\s+me\b/gi, 'show'],
  [/\blet\s+me\s+see\b/gi, 'show'],
  [/\bbring\s+up\b/gi, 'open'],
  [/\bpull\s+up\b/gi, 'open'],
];

// ── Main normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize a raw STT transcript for intent detection.
 * Returns the cleaned text. Does NOT mutate the input.
 *
 * @param {string} raw - Raw Whisper transcript
 * @returns {string} Cleaned, normalized text
 */
export function normalizeCommand(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw;

  // 1. Lowercase
  text = text.toLowerCase();

  // 2. Strip accented characters
  text = stripAccents(text);

  // 3. Remove punctuation except hyphens and apostrophes
  text = text.replace(/[^\w\s'-]/g, '');

  // 4. Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // 5. Remove start fillers
  for (const filler of START_FILLERS) {
    text = text.replace(filler, '');
  }
  text = text.trim();

  // 6. Remove inline fillers
  for (const filler of INLINE_FILLERS) {
    text = text.replace(filler, '');
  }
  text = text.replace(/\s+/g, ' ').trim();

  // 7. Apply STT corrections (only for short inputs — < 12 words)
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 12) {
    for (const [pattern, replacement] of STT_CORRECTIONS) {
      text = text.replace(pattern, replacement);
    }
  }

  // 8. Apply pronoun simplifications
  for (const [pattern, replacement] of PRONOUN_SIMPLIFICATIONS) {
    text = text.replace(pattern, replacement);
  }

  // 9. Final cleanup
  text = text.replace(/\s+/g, ' ').trim();

  console.log(`[MIRRORMIND][VOICE][NORMALIZED] text="${text}"`);
  return text;
}
