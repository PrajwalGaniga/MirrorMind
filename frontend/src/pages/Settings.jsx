import { useState, useEffect } from 'react';
import { useDevConsole } from '../context/DevConsoleContext';
import api from '../api/axios';

export default function Settings() {
  const { isOpen, toggleConsole } = useDevConsole();
  const [loading, setLoading] = useState(false);
  const [keyInfo, setKeyInfo] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchKeyInfo();
  }, []);

  const fetchKeyInfo = async () => {
    try {
      const res = await api.get('/api/settings/api-key');
      if (res.data.exists) {
        setKeyInfo(res.data);
      } else {
        setKeyInfo(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generateKey = async (isRegenerate = false) => {
    let password = null;
    if (isRegenerate) {
      if (!window.confirm("This will invalidate your current key. Are you sure?")) return;
      password = window.prompt("Please enter your password to regenerate the key:");
      if (!password) return;
    }
    setLoading(true);
    try {
      const endpoint = isRegenerate ? '/api/settings/api-key/regenerate' : '/api/settings/api-key';
      const payload = isRegenerate ? { password } : undefined;
      const res = await api.post(endpoint, payload);
      setNewKey(res.data.raw_key);
      fetchKeyInfo();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to generate key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page" style={{ paddingBottom: '100px' }}>
      <div className="dashboard-hero">
        <div className="hero-info">
          <div className="hero-name">Settings</div>
        </div>
      </div>

      <div className="dashboard-body">
        <div className="section-title">Developer Options</div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Developer Console</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                View real-time API logs, ML outputs, and system messages.
              </div>
            </div>
            <button 
              className={`btn ${isOpen ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={toggleConsole}
              style={{ width: 'auto' }}
            >
              {isOpen ? 'Console Active' : 'Enable Console'}
            </button>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 24 }}>API Key Management</div>
        <div className="card">
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Generate a personal API key to authenticate your VS Code extension.
          </div>
          
          {newKey && (
            <div style={{ padding: 16, backgroundColor: 'rgba(255, 165, 0, 0.1)', border: '1px solid orange', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', color: 'orange', marginBottom: 8 }}>⚠️ This is shown only once — copy it now.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <code style={{ flex: 1, padding: 8, backgroundColor: 'var(--bg-secondary)', borderRadius: 4, letterSpacing: showKey ? 'normal' : '2px', wordBreak: 'break-all', display: 'flex', alignItems: 'center' }}>
                  {showKey ? newKey : '•'.repeat(40)}
                </code>
                <button 
                  className="btn btn-secondary" 
                  onMouseDown={() => setShowKey(true)} 
                  onMouseUp={() => setShowKey(false)} 
                  onMouseLeave={() => setShowKey(false)}
                  onTouchStart={() => setShowKey(true)}
                  onTouchEnd={() => setShowKey(false)}
                  title="Hold to reveal"
                  style={{ padding: '0 12px' }}
                >
                  👁️
                </button>
                <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(newKey)}>Copy</button>
              </div>
            </div>
          )}

          {!keyInfo ? (
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => generateKey(false)} disabled={loading}>
              {loading ? 'Generating...' : 'Create your API key'}
            </button>
          ) : (
            <div>
              <div style={{ padding: 16, backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: 4 }}>ℹ️ Security Notice</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Your full API key is securely hidden. You can copy it, but it will not be displayed.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>Extension ID:</strong> 
                  <code style={{ padding: '4px 8px', backgroundColor: 'var(--bg-secondary)', borderRadius: 4 }}>
                    *******
                  </code>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                    onClick={() => navigator.clipboard.writeText(keyInfo.key_prefix)}
                    title="Copy Extension ID"
                  >
                    Copy Extension ID
                  </button>
                </div>
                <div><strong>Created:</strong> {new Date(keyInfo.created_at).toLocaleString()}</div>
                <div><strong>Last Used:</strong> {keyInfo.last_used_at ? new Date(keyInfo.last_used_at).toLocaleString() : 'Never'}</div>
              </div>
              <button className="btn btn-primary" style={{ width: 'auto', backgroundColor: '#ef4444', borderColor: '#ef4444' }} onClick={() => generateKey(true)} disabled={loading}>
                {loading ? 'Regenerating...' : 'Regenerate key'}
              </button>
            </div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: 24 }}>Account</div>
        <div className="card">
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Preferences and profile settings can be updated from the Onboarding flow.
          </div>
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => window.location.href = '/onboarding'}>
            Edit Profile Setup
          </button>
        </div>
      </div>
    </div>
  );
}
