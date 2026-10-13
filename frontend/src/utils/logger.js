class Logger {
  constructor() {
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  log(type, source, message, data = null) {
    const logEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      type, // 'info', 'success', 'error', 'warning'
      source, // 'API', 'ML', 'APP', 'CLOUDINARY'
      message,
      data
    };
    
    // Broadcast
    this.listeners.forEach(listener => listener(logEntry));
  }
}

export const devLogger = new Logger();

const VOICE_LOG_MAX = 200;

class VoiceLog {
  constructor() {
    this._entries = [];
    if (typeof window !== 'undefined') {
      window.__voiceLog = this;
    }
  }

  push(source, event, detail = {}) {
    const entry = {
      t: new Date().toISOString(),
      source, // 'NOVA' | 'INTERVIEW' | 'WORKLET' | 'PLAYBACK'
      event, // e.g. 'WS_OPEN', 'FLUSH', 'ACTIVITY_START', 'RMS_BARGE_IN'
      ...detail,
    };
    this._entries.push(entry);
    if (this._entries.length > VOICE_LOG_MAX) {
      this._entries.shift();
    }
    console.debug(`[VL][${source}][${event}]`, detail);
  }

  /** Returns last N entries as a copy */
  get(n = VOICE_LOG_MAX) {
    return this._entries.slice(-n);
  }

  /** Dump all as JSON string — paste into bug report */
  dump() {
    return JSON.stringify(this._entries, null, 2);
  }
}

export const voiceLog = new VoiceLog();

