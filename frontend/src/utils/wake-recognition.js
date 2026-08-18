/**
 * WakeRecognitionManager
 *
 * A single-instance SpeechRecognition lifecycle manager for MirrorMind's
 * hands-free voice pipeline. Owns exactly ONE SpeechRecognition object at
 * a time, handles all Chrome/Firefox error codes, and auto-restarts cleanly
 * so the caller never needs to manage recognition state directly.
 *
 * Usage:
 *   const mgr = new WakeRecognitionManager({
 *     onResult:      (transcript, mode) => { ... },
 *     onStateChange: (status) => { ... },   // 'ACTIVE' | 'RECONNECTING' | 'STOPPED' | 'MIC_ERROR'
 *   });
 *   mgr.start('wake');       // listen for wake-phrase
 *   mgr.start('confirm');    // listen for yes/no confirmation
 *   mgr.stop();              // cleanly stop (no auto-restart)
 *   mgr.isRunning()          // boolean
 */

// ── Wake-phrase patterns ────────────────────────────────────────────────────
// Matches:  "hello mirrormind"  "hello mirror mind"
//           "hey mirrormind"    "hey mirror mind"
// Case-insensitive; caller should normalize the transcript first.
const WAKE_PATTERNS = [
  /hello\s+mirror\s*mind/,
  /hey\s+mirror\s*mind/,
];

/** Normalize transcript: lowercase, strip punctuation, collapse whitespace */
function normalize(raw) {
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')      // collapse spaces
    .trim();
}

/** Returns true if the normalized transcript contains a valid wake phrase */
export function matchesWakePhrase(transcript) {
  const n = normalize(transcript);
  return WAKE_PATTERNS.some((p) => p.test(n));
}

// ── Restart backoff configuration ───────────────────────────────────────────
const RESTART_DELAY_MS = 300;   // minimum delay between restarts (Chrome loop guard)
const MIC_ERROR_CODES = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

export class WakeRecognitionManager {
  constructor({ onResult, onStateChange } = {}) {
    this._onResult = onResult || (() => {});
    this._onStateChange = onStateChange || (() => {});

    this._recognition = null;
    this._mode = 'wake';       // 'wake' | 'confirm'
    this._active = false;      // whether we WANT recognition running
    this._restartTimer = null;
    this._lastStartTime = 0;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  start(mode = 'wake') {
    if (!this._isBrowserSupported()) {
      console.warn('[MIRRORMIND][WAKE_MGR] SpeechRecognition not supported');
      this._onStateChange('MIC_ERROR');
      return;
    }

    this._mode = mode;
    this._active = true;
    this._clearRestartTimer();
    this._ensureRecognitionStopped();
    this._startInner();
  }

  stop() {
    this._active = false;
    this._clearRestartTimer();
    this._ensureRecognitionStopped();
    this._onStateChange('STOPPED');
    console.log('[MIRRORMIND][WAKE_MGR] stopped');
  }

  isRunning() {
    return this._active;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  _isBrowserSupported() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  _startInner() {
    if (!this._active) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Always create a fresh instance — avoids state machine corruption on reuse.
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this._lastStartTime = Date.now();
      this._onStateChange('ACTIVE');
      console.log(`[MIRRORMIND][WAKE_MGR] recognition_started mode=${this._mode}`);
    };

    rec.onresult = (event) => {
      if (!this._active) return;
      const last = event.results.length - 1;
      const raw = event.results[last][0].transcript;
      const normalized = normalize(raw);
      console.log(`[MIRRORMIND][WAKE_MGR] heard="${normalized}" mode=${this._mode}`);
      this._onResult(normalized, this._mode);
    };

    rec.onerror = (event) => {
      const code = event.error;
      console.warn(`[MIRRORMIND][WAKE_MGR] recognition_error code="${code}"`);

      if (MIC_ERROR_CODES.has(code)) {
        // Fatal — cannot restart without user action.
        this._active = false;
        this._onStateChange('MIC_ERROR');
        return;
      }

      // All other codes (no-speech, aborted, network, etc.) are recoverable.
      // 'onend' will fire after 'onerror' and trigger the restart logic there.
    };

    rec.onend = () => {
      console.log(`[MIRRORMIND][WAKE_MGR] recognition_ended active=${this._active}`);

      if (!this._active) return; // intentional stop — don't restart

      // Guard against Chrome's "restart immediately after end" loop by
      // ensuring a minimum gap since the last start.
      const elapsed = Date.now() - this._lastStartTime;
      const delay = Math.max(0, RESTART_DELAY_MS - elapsed);

      this._onStateChange('RECONNECTING');
      this._scheduleRestart(delay);
    };

    this._recognition = rec;

    try {
      rec.start();
    } catch (err) {
      // start() can throw if called while already running (shouldn't happen,
      // but guard anyway). Schedule a restart.
      console.warn('[MIRRORMIND][WAKE_MGR] start_threw', err);
      this._scheduleRestart(RESTART_DELAY_MS);
    }
  }

  _ensureRecognitionStopped() {
    if (this._recognition) {
      // Remove onend before stopping so the auto-restart logic doesn't fire.
      this._recognition.onend = null;
      this._recognition.onerror = null;
      this._recognition.onresult = null;
      this._recognition.onstart = null;
      try { this._recognition.abort(); } catch (_) {}
      this._recognition = null;
    }
  }

  _scheduleRestart(delayMs) {
    this._clearRestartTimer();
    if (!this._active) return;
    this._restartTimer = setTimeout(() => {
      this._restartTimer = null;
      if (this._active) {
        console.log('[MIRRORMIND][WAKE_MGR] restarting…');
        this._ensureRecognitionStopped();
        this._startInner();
      }
    }, delayMs);
  }

  _clearRestartTimer() {
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
  }
}
