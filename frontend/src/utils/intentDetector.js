/**
 * intentDetector.js — Module 9.1 Intent Classification
 *
 * Pure regex/keyword classifier with:
 * - Expanded alias patterns for all action commands
 * - Fuzzy Levenshtein matching for garbled STT output
 * - Confidence scoring with 0.85 threshold
 * - Suggestion field for UNKNOWN intents (smart clarification)
 *
 * Zero LLM calls, zero API calls.
 * Returns { intent, payload, confidence, suggestion? } for every input.
 *
 * Integrates with commandNormalizer.js — expects pre-normalized input
 * via normalizeCommand(), but also runs its own cleanTranscript() for
 * backward compatibility with direct callers.
 */

import { normalizeCommand } from './commandNormalizer.js';

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN DEFINITIONS
// Each array is ordered from highest to lowest confidence.
// Patterns use looser matching (.* instead of strict ^$) for STT resilience.
// ═══════════════════════════════════════════════════════════════════════════

// ── NAVIGATION ──────────────────────────────────────────────────────────────
const NAV_TARGETS = [
  { keywords: ['project', 'projects'],           path: '/projects' },
  { keywords: ['profile', 'my profile'],         path: '/profile' },
  { keywords: ['internship', 'internships', 'experience', 'experiences'], path: '/internships' },
  { keywords: ['dashboard', 'home', 'main'],     path: '/dashboard' },
  { keywords: ['setting', 'settings'],           path: '/settings' },
  { keywords: ['prediction', 'predictions', 'predict'], path: '/predict' },
  { keywords: ['extension', 'extensions'],       path: '/extension' },
  { keywords: ['document', 'documents', 'docs'], path: '/documents' },
];

const NAV_VERBS = /^(go\s+to|navigate\s+to|take\s+me\s+to|open|show|switch\s+to|head\s+to|move\s+to)\s+/;

// ── OPEN DOCUMENT ───────────────────────────────────────────────────────────
const DOC_OPEN_PATTERNS = [
  // Explicit: "open my resume", "show my CV", "display the document"
  { re: /(open|show|display|view|pull\s+up|bring\s+up)\s+(my|the|a)?\s*(resume|cv|curriculum\s*vitae)/i, conf: 1.0 },
  { re: /(open|show|display|view)\s+(my|the|a)?\s*(document|file|upload)/i, conf: 0.9 },
  // Looser: any sentence with action verb + document keyword
  { re: /\b(open|show|display|view)\b.*\b(resume|cv)\b/i, conf: 0.88 },
  { re: /\b(open|show|display|view)\b.*\b(document|file)\b/i, conf: 0.85 },
  // Keyword only (high enough confidence for short commands)
  { re: /^(resume|cv)$/i, conf: 0.85 },
];

// ── CLOSE DOCUMENT ──────────────────────────────────────────────────────────
const DOC_CLOSE_PATTERNS = [
  { re: /(close|hide|dismiss|shut)\s+(the|my|this)?\s*(document|resume|pdf|viewer|panel|file|it)/i, conf: 1.0 },
  { re: /^(close|hide|dismiss)\s+(it|this|that)$/i, conf: 0.95 },
  { re: /^go\s+back(\s+from\s+(the\s+)?document)?$/i, conf: 0.9 },
];

// ── ADD PROJECT ─────────────────────────────────────────────────────────────
const ADD_PROJECT_PATTERNS = [
  { re: /(add|create|insert|make|put|start)\s+(a\s+|an?\s+|another\s+|one\s+more\s+)?(new\s+)?project/i, conf: 1.0 },
  { re: /^new\s+project$/i, conf: 0.95 },
  { re: /\b(add|create)\b.*\bproject\b/i, conf: 0.88 },
  // Keyword only
  { re: /^project$/i, conf: 0.3 },
];

// ── ADD INTERNSHIP ──────────────────────────────────────────────────────────
const ADD_INTERNSHIP_PATTERNS = [
  { re: /(add|create|insert|make|record|put|start)\s+(a\s+|an?\s+|another\s+|one\s+more\s+)?(new\s+)?(internship|experience|work\s+experience)/i, conf: 1.0 },
  { re: /^new\s+(internship|experience)$/i, conf: 0.95 },
  { re: /\b(add|create)\b.*\b(internship|experience)\b/i, conf: 0.88 },
  // Keyword only
  { re: /^(internship|experience)$/i, conf: 0.3 },
];

// ── EDIT PROFILE ────────────────────────────────────────────────────────────
const PROFILE_FIELD_MAP = {
  name:                 /\b(name|full\s*name)\b/i,
  branch:               /\b(branch|department|major)\b/i,
  semester:             /\b(semester|sem)\b/i,
  cgpa:                 /\b(cgpa|gpa|grade\s*point)\b/i,
  college_tier:         /\b(college\s*tier|tier)\b/i,
  backlog_count:        /\b(backlog|backlogs|arrears)\b/i,
  career_interest:      /\b(career\s*interest|career\s*goal|career\s*path)\b/i,
  work_style_pref:      /\b(work\s*style|work\s*preference)\b/i,
  communication_rating: /\b(communication|comm\s*rating)\b/i,
};

const EDIT_PROFILE_PATTERNS = [
  { re: /^(edit|change|update|modify|set)\s+(my\s+)?profile$/i, conf: 1.0 },
  { re: /(change|update|set|edit|modify)\s+(my\s+)?(name|cgpa|gpa|branch|semester|tier|backlog|career|work\s*style|communication)/i, conf: 0.95 },
  { re: /\b(edit|change|update|modify)\b.*\b(profile|name|cgpa|gpa|branch)\b/i, conf: 0.88 },
];

// ── CANCEL / CONFIRM / REJECT ───────────────────────────────────────────────
const CANCEL_PATTERNS = [
  { re: /^(cancel|stop|abort|never\s*mind|forget\s+it|don'?t|no)$/i, conf: 1.0 },
  { re: /^(cancel|stop)\s+(that|this|it|the\s+action)$/i, conf: 1.0 },
];

const CONFIRM_PATTERNS = [
  { re: /^(yes|yeah|yep|yup|sure|ok|okay|proceed|confirm|go\s+ahead|do\s+it|correct|right|absolutely)$/i, conf: 1.0 },
  { re: /^(yes|yeah),?\s+(please|go\s+ahead|do\s+it)$/i, conf: 1.0 },
];

// ═══════════════════════════════════════════════════════════════════════════
// FUZZY MATCHING — Levenshtein distance for garbled STT output
// ═══════════════════════════════════════════════════════════════════════════

const KNOWN_COMMANDS = [
  { phrase: 'open my resume',       intent: 'OPEN_DOCUMENT',  payload: { query: 'resume' } },
  { phrase: 'open my cv',           intent: 'OPEN_DOCUMENT',  payload: { query: 'cv' } },
  { phrase: 'show my resume',       intent: 'OPEN_DOCUMENT',  payload: { query: 'resume' } },
  { phrase: 'show my document',     intent: 'OPEN_DOCUMENT',  payload: { query: 'document' } },
  { phrase: 'open my document',     intent: 'OPEN_DOCUMENT',  payload: { query: 'document' } },
  { phrase: 'close the document',   intent: 'CLOSE_DOCUMENT', payload: {} },
  
  { phrase: 'add a project',        intent: 'ADD_PROJECT',    payload: {} },
  { phrase: 'create a project',     intent: 'ADD_PROJECT',    payload: {} },
  { phrase: 'add a new project',    intent: 'ADD_PROJECT',    payload: {} },
  { phrase: 'new project',          intent: 'ADD_PROJECT',    payload: {} },

  { phrase: 'add an internship',    intent: 'ADD_INTERNSHIP', payload: {} },
  { phrase: 'create an internship', intent: 'ADD_INTERNSHIP', payload: {} },
  { phrase: 'add a new internship', intent: 'ADD_INTERNSHIP', payload: {} },
  { phrase: 'new internship',       intent: 'ADD_INTERNSHIP', payload: {} },
  
  // Common STT garbles for "add new internship"
  { phrase: 'add new issues',       intent: 'ADD_INTERNSHIP', payload: {} },
  { phrase: 'so add new chip',      intent: 'ADD_INTERNSHIP', payload: {} },
  { phrase: 'add new chip',         intent: 'ADD_INTERNSHIP', payload: {} },
  { phrase: 'new intention',        intent: 'ADD_INTERNSHIP', payload: {} },
  { phrase: 'add new intention',    intent: 'ADD_INTERNSHIP', payload: {} },

  { phrase: 'update my cgpa',       intent: 'EDIT_PROFILE',   payload: { field: 'cgpa' } },
  { phrase: 'change my cgpa',       intent: 'EDIT_PROFILE',   payload: { field: 'cgpa' } },
  { phrase: 'update my name',       intent: 'EDIT_PROFILE',   payload: { field: 'name' } },
  { phrase: 'change my name',       intent: 'EDIT_PROFILE',   payload: { field: 'name' } },
  { phrase: 'update my profile',    intent: 'EDIT_PROFILE',   payload: {} },
  
  { phrase: 'go to projects',       intent: 'NAVIGATE',       payload: { path: '/projects' } },
  { phrase: 'go to profile',        intent: 'NAVIGATE',       payload: { path: '/profile' } },
  { phrase: 'go to internships',    intent: 'NAVIGATE',       payload: { path: '/internships' } },
  { phrase: 'go to settings',       intent: 'NAVIGATE',       payload: { path: '/settings' } },
  { phrase: 'open projects',        intent: 'NAVIGATE',       payload: { path: '/projects' } },
  { phrase: 'show internships',     intent: 'NAVIGATE',       payload: { path: '/internships' } },
  { phrase: 'open my profile',      intent: 'NAVIGATE',       payload: { path: '/profile' } },
];

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Compute similarity (0–1) between two strings using Levenshtein distance.
 */
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Extract profile field + value
// ═══════════════════════════════════════════════════════════════════════════

function extractProfileEdit(input) {
  let detectedField = null;
  for (const [field, re] of Object.entries(PROFILE_FIELD_MAP)) {
    if (re.test(input)) { detectedField = field; break; }
  }
  const valueMatch = /\bto\s+(.+?)(?:\s*$|\.)/i.exec(input);
  const detectedValue = valueMatch ? valueMatch[1].trim() : null;
  return { field: detectedField, value: detectedValue };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect intent from a user's input string.
 *
 * @param {string} rawInput — raw or pre-normalized input
 * @param {object} [options] — { skipNormalize: boolean }
 * @returns {{ intent: string, payload: object, confidence: number, suggestion?: string }}
 */
export function detectIntent(rawInput, options = {}) {
  if (!rawInput || !rawInput.trim()) {
    return { intent: 'INFORMATION_QUERY', payload: { query: rawInput }, confidence: 1.0 };
  }

  // Normalize (unless caller already did it)
  const normalized = options.skipNormalize ? rawInput.toLowerCase().trim() : normalizeCommand(rawInput);
  const wordCount = normalized.split(/\s+/).length;

  let bestMatch = { intent: 'INFORMATION_QUERY', payload: { query: rawInput }, confidence: 0.0 };

  const updateBest = (intent, payload, conf) => {
    if (conf > bestMatch.confidence) {
      bestMatch = { intent, payload, confidence: conf };
    }
  };

  // ── 1. Cancel action ────────────────────────────────────────────────────
  for (const { re, conf } of CANCEL_PATTERNS) {
    if (re.test(normalized)) updateBest('CANCEL_ACTION', {}, conf);
  }

  // ── 2. Confirm action ──────────────────────────────────────────────────
  for (const { re, conf } of CONFIRM_PATTERNS) {
    if (re.test(normalized)) updateBest('CONFIRM_ACTION', {}, conf);
  }

  // ── 3. Close document ──────────────────────────────────────────────────
  for (const { re, conf } of DOC_CLOSE_PATTERNS) {
    if (re.test(normalized)) updateBest('CLOSE_DOCUMENT', {}, conf);
  }

  // ── 4. Open document ──────────────────────────────────────────────────
  for (const { re, conf } of DOC_OPEN_PATTERNS) {
    if (re.test(normalized)) {
      // Extract what kind of document
      const docType = normalized.match(/\b(resume|cv|document|file|upload)\b/i);
      updateBest('OPEN_DOCUMENT', { query: docType ? docType[1] : normalized }, conf);
    }
  }

  // ── 5. Navigation ─────────────────────────────────────────────────────
  // Try explicit nav verb + target
  const navVerbMatch = normalized.match(NAV_VERBS);
  if (navVerbMatch && bestMatch.intent !== 'OPEN_DOCUMENT') {
    const rest = normalized.replace(NAV_VERBS, '').replace(/^(my|the)\s+/, '').trim();
    for (const { keywords, path } of NAV_TARGETS) {
      if (keywords.some(k => rest === k || rest === k + 's' || rest === k.replace(/s$/, ''))) {
        updateBest('NAVIGATE', { path }, 1.0);
      }
    }
  }
  // Also check patterns like "open projects" where "open" is both nav and doc verb
  // but "projects" clearly means navigation (no "my" or "the" before it)
  if (bestMatch.intent !== 'NAVIGATE' && bestMatch.intent !== 'OPEN_DOCUMENT') {
    for (const { keywords, path } of NAV_TARGETS) {
      // Match "show projects", "open internships" etc. without possessive
      const navRe = new RegExp(`^(go\\s+to|open|show|take\\s+me\\s+to)\\s+(the\\s+)?` +
        keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '$', 'i');
      if (navRe.test(normalized)) {
        updateBest('NAVIGATE', { path }, 1.0);
      }
    }
  }

  // ── 6. Add project ────────────────────────────────────────────────────
  for (const { re, conf } of ADD_PROJECT_PATTERNS) {
    if (re.test(normalized)) updateBest('ADD_PROJECT', {}, conf);
  }

  // ── 7. Add internship ─────────────────────────────────────────────────
  for (const { re, conf } of ADD_INTERNSHIP_PATTERNS) {
    if (re.test(normalized)) updateBest('ADD_INTERNSHIP', {}, conf);
  }

  // ── 8. Edit profile ───────────────────────────────────────────────────
  for (const { re, conf } of EDIT_PROFILE_PATTERNS) {
    if (re.test(normalized)) {
      const { field, value } = extractProfileEdit(normalized);
      updateBest('EDIT_PROFILE', { field, value }, conf);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THRESHOLD + FUZZY MATCHING
  // ═══════════════════════════════════════════════════════════════════════

  if (bestMatch.intent !== 'INFORMATION_QUERY' && bestMatch.confidence >= 0.85) {
    // High-confidence match — return directly
    console.log(`[MIRRORMIND][INTENT] intent=${bestMatch.intent} confidence=${bestMatch.confidence}`);
    return bestMatch;
  }

  // If we had a low-confidence match OR no match at all, try fuzzy matching
  // BUT only for short inputs (< 8 words) — long inputs are likely real questions
  if (wordCount < 8) {
    let bestFuzzy = { sim: 0, cmd: null };
    for (const cmd of KNOWN_COMMANDS) {
      const sim = similarity(normalized, cmd.phrase);
      if (sim > bestFuzzy.sim) {
        bestFuzzy = { sim, cmd };
      }
    }

    // If fuzzy match is very high (> 0.85), treat it as a real match
    if (bestFuzzy.sim > 0.85 && bestFuzzy.cmd) {
      console.log(`[MIRRORMIND][INTENT] intent=${bestFuzzy.cmd.intent} confidence=${bestFuzzy.sim.toFixed(2)} source=fuzzy phrase="${bestFuzzy.cmd.phrase}"`);
      return {
        intent: bestFuzzy.cmd.intent,
        payload: { ...bestFuzzy.cmd.payload },
        confidence: bestFuzzy.sim,
      };
    }

    // If fuzzy match is moderate (> 0.55), return UNKNOWN with a suggestion
    if (bestFuzzy.sim > 0.55 && bestFuzzy.cmd) {
      console.log(`[MIRRORMIND][INTENT] intent=UNKNOWN confidence=${bestFuzzy.sim.toFixed(2)} suggestion="${bestFuzzy.cmd.phrase}"`);
      return {
        intent: 'UNKNOWN',
        payload: { query: rawInput },
        confidence: bestFuzzy.sim,
        suggestion: bestFuzzy.cmd.phrase,
        suggestedIntent: bestFuzzy.cmd.intent,
        suggestedPayload: { ...bestFuzzy.cmd.payload },
      };
    }
  }

  // If we had a below-threshold regex match, return UNKNOWN
  if (bestMatch.intent !== 'INFORMATION_QUERY' && bestMatch.confidence < 0.85) {
    console.log(`[MIRRORMIND][INTENT] intent=${bestMatch.intent} confidence=${bestMatch.confidence} -> UNKNOWN`);
    return { intent: 'UNKNOWN', payload: { query: rawInput }, confidence: bestMatch.confidence };
  }

  // Default: INFORMATION_QUERY — goes to RAG/LLM
  console.log(`[MIRRORMIND][INTENT] intent=INFORMATION_QUERY confidence=1.0`);
  return { intent: 'INFORMATION_QUERY', payload: { query: rawInput }, confidence: 1.0 };
}

/**
 * Returns true if the intent is a deterministic action (not a RAG query).
 */
export function isActionIntent(intent) {
  return [
    'NAVIGATE',
    'OPEN_DOCUMENT',
    'CLOSE_DOCUMENT',
    'ADD_PROJECT',
    'ADD_INTERNSHIP',
    'EDIT_PROFILE',
    'CANCEL_ACTION',
    'CONFIRM_ACTION',
  ].includes(intent);
}
