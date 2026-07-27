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
