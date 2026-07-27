import { useState, useRef, useEffect } from 'react';
import { useDevConsole } from '../context/DevConsoleContext';

export default function DeveloperConsole() {
  const { isOpen, toggleConsole, logs, clearLogs } = useDevConsole();
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const consoleRef = useRef(null);

  if (!isOpen) return null;

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const getSourceColor = (source) => {
    switch (source) {
      case 'API': return 'var(--accent-primary)';
      case 'ML': return 'var(--accent-secondary)';
      case 'CLOUDINARY': return 'var(--accent-amber)';
      default: return '#FFF';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'error': return 'var(--accent-rose)';
      case 'success': return 'var(--accent-secondary)';
      default: return '#111';
    }
  };

  return (
    <div 
      ref={consoleRef}
      className="dev-console-overlay"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="dev-console-header" 
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="dev-console-title">⚡ Dev Console</div>
        <div className="dev-console-actions">
          <button className="dev-console-btn" onClick={clearLogs} title="Clear">🚫</button>
          <button className="dev-console-btn" onClick={toggleConsole} title="Close">✖</button>
        </div>
      </div>
      <div className="dev-console-body">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
            Waiting for activity...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="dev-console-log">
              <div className="dev-console-log-header">
                <span className="dev-console-badge" style={{ background: getSourceColor(log.source) }}>
                  {log.source}
                </span>
                <span className="dev-console-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="dev-console-msg" style={{ color: getTypeColor(log.type) }}>
                {log.message}
              </div>
              {log.data && (
                <pre className="dev-console-data">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
