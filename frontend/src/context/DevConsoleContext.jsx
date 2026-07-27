import { createContext, useContext, useState, useEffect } from 'react';
import { devLogger } from '../utils/logger';

const DevConsoleContext = createContext();

export function useDevConsole() {
  return useContext(DevConsoleContext);
}

export function DevConsoleProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Check if it should be open initially from local storage
    const saved = localStorage.getItem('dev_console_open');
    if (saved === 'true') {
      setIsOpen(true);
    }

    const unsubscribe = devLogger.subscribe((log) => {
      setLogs((prev) => [log, ...prev].slice(0, 100)); // Keep last 100 logs
    });

    return () => unsubscribe();
  }, []);

  const toggleConsole = () => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem('dev_console_open', next.toString());
      return next;
    });
  };

  const clearLogs = () => setLogs([]);

  return (
    <DevConsoleContext.Provider value={{ isOpen, toggleConsole, logs, clearLogs }}>
      {children}
    </DevConsoleContext.Provider>
  );
}
