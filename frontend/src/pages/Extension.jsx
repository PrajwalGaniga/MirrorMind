import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

export default function Extension() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [status, setStatus] = useState('active');
  const [revealedData, setRevealedData] = useState({}); // mapping from id -> { corrected_block, explanation }

  const fetchErrors = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/extension/errors?status=${status}`);
      setErrors(data);
      setFetchError('');
    } catch (err) {
      setFetchError(err.response?.data?.detail || 'Failed to load extension errors.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchErrors();

    // Refetch on window focus
    const onFocus = () => fetchErrors();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchErrors]);

  const handleReveal = async (id) => {
    try {
      const { data } = await api.get(`/api/extension/errors/${id}/reveal`);
      setRevealedData(prev => ({ ...prev, [id]: data }));
      
      // Auto resolve via full_fix when revealed
      await api.patch(`/api/extension/errors/${id}/resolve`, { resolved_via: 'full_fix' });
      if (status === 'active') {
        setErrors(prev => prev.filter(e => e.id !== id));
      } else {
        setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved_via: 'full_fix' } : e));
      }
    } catch (err) {
      alert('Failed to reveal fix.');
    }
  };

  const handleSolved = async (id) => {
    try {
      await api.patch(`/api/extension/errors/${id}/resolve`, { resolved_via: 'hint' });
      if (status === 'active') {
        setErrors(prev => prev.filter(e => e.id !== id));
      } else {
        setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved_via: 'hint' } : e));
      }
    } catch (err) {
      alert('Failed to mark as solved.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/extension/errors/${id}`);
      setErrors(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert('Failed to delete history item.');
    }
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <div className="loading-text">Loading AI insights...</div>
      </div>
    );
  }

  // Format relative time safely without external libraries, simple fallback
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString();
  };

  return (
    <div className="dashboard-page" style={{ paddingBottom: '100px' }}>
      <div className="dashboard-hero">
        <div className="hero-info">
          <div>
            <div className="hero-name">Coding Skill Gap Monitor</div>
            <div className="hero-meta">
              <span className="hero-badge">💻 VS Code Extension</span>
              <span className="hero-badge">AI Assistant Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-body">
        {fetchError && <div className="alert alert-error" style={{ marginBottom: 24 }}>{fetchError}</div>}

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button 
            className={`btn ${status === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatus('active')}
          >
            Captured Errors
          </button>
          <button 
            className={`btn ${status === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatus('history')}
          >
            History
          </button>
        </div>

        {errors.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {status === 'active' ? 'No active coding errors captured yet. Keep coding in VS Code!' : 'No history found.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errors.map(error => {
              const basename = error.file_path.split(/[\\/]/).pop();
              const isRevealed = !!revealedData[error.id];
              const isResolved = !!error.resolved_via;
              const isHintSolved = error.resolved_via === 'hint';
              
              return (
                <div key={error.id} className="card" style={{ 
                  padding: '24px', 
                  borderLeft: isResolved ? '4px solid #10b981' : '4px solid var(--primary)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px', textDecoration: isHintSolved ? 'line-through' : 'none' }}>
                        {basename}:{error.line}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontFamily: 'monospace' }}>
                        [{error.source || 'VSCode'}] {error.error_message}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {formatTime(error.created_at)}
                    </div>
                  </div>

                  {error.hint && (
                    <div style={{ 
                      backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                      padding: '12px 16px', 
                      borderRadius: '8px',
                      color: '#3b82f6',
                      fontWeight: 500,
                      marginBottom: '16px'
                    }}>
                      💡 Hint: {error.hint}
                    </div>
                  )}

                  {status === 'active' && !isRevealed && !isHintSolved && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn btn-primary" onClick={() => handleReveal(error.id)}>
                        Show fix 🪄
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleSolved(error.id)}>
                        I solved it myself ✓
                      </button>
                    </div>
                  )}

                  {status === 'history' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#10b981', fontWeight: 600 }}>
                        {isHintSolved ? '✓ Solved by yourself' : '🪄 Revealed fix'}
                      </div>
                      <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={() => handleDelete(error.id)}>
                        Delete
                      </button>
                    </div>
                  )}

                  {isHintSolved && status === 'active' && (
                    <div style={{ color: '#10b981', fontWeight: 600 }}>
                      ✓ Solved by yourself
                    </div>
                  )}

                  {isRevealed && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                      <h4 style={{ marginBottom: '8px' }}>Explanation</h4>
                      <p style={{ marginBottom: '16px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                        {revealedData[error.id]?.explanation}
                      </p>
                      
                      <h4 style={{ marginBottom: '8px' }}>Corrected Code</h4>
                      <pre style={{ 
                        backgroundColor: '#1e1e1e', 
                        color: '#d4d4d4',
                        padding: '16px', 
                        borderRadius: '8px',
                        overflowX: 'auto',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}>
                        {revealedData[error.id]?.corrected_block}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
