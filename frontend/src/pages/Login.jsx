import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowRight, 
  Brain, 
  ShieldCheck, 
  CheckCircle2, 
  X,
  Mic,
  FolderGit2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', form);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      console.error('[LOGIN ERROR]', err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message === 'Network Error' || !err.response) {
        setError(
          `Connection failed: Cannot reach backend server at ${api.defaults.baseURL || 'localhost:8000'}. Check if the server or ngrok tunnel is online.`
        );
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
  };

  return (
    <div className="auth-page">
      <div className="auth-split-wrapper">
        {/* ── Left Column: Brand Feature Showcase (Desktop & Tablet) ── */}
        <div className="auth-brand-showcase">
          <div>
            <div className="auth-showcase-badge">
              <Sparkles size={14} />
              <span>Next-Gen AI Career Copilot</span>
            </div>

            <h2 className="auth-showcase-title">
              Predict your career path with AI precision.
            </h2>
            <p className="auth-showcase-desc">
              MirrorMind continuously reflects your projects, technical skills, and live voice mock interviews to map your optimal engineering trajectory.
            </p>

            <div className="auth-brand-features">
              <div className="auth-brand-feature-item">
                <div className="auth-feature-icon">
                  <Mic size={18} />
                </div>
                <div>
                  <div className="auth-feature-title">Real-Time Voice Co-Pilot</div>
                  <div className="auth-feature-sub">Hands-free Gemini Live conversational mock interviews</div>
                </div>
              </div>

              <div className="auth-brand-feature-item">
                <div className="auth-feature-icon">
                  <Brain size={18} />
                </div>
                <div>
                  <div className="auth-feature-title">Predictive ML Classifier</div>
                  <div className="auth-feature-sub">Softmax probabilities matched across top industry domains</div>
                </div>
              </div>

              <div className="auth-brand-feature-item">
                <div className="auth-feature-icon">
                  <FolderGit2 size={18} />
                </div>
                <div>
                  <div className="auth-feature-title">Portfolio Intelligence</div>
                  <div className="auth-feature-sub">Synchronized tracking for GitHub repositories & certificates</div>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-showcase-footer">
            <span>MirrorMind Platform v2.4</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color="#10B981" /> Secure End-to-End Authentication
            </span>
          </div>
        </div>

        {/* ── Right Column: Authentication Form ── */}
        <div className="auth-form-column">
          <div className="auth-logo">
            <div className="auth-logo-icon">🧠</div>
            <span className="auth-logo-text">MirrorMind</span>
          </div>

          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to view your career predictions and interview intelligence</p>

          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit}>
            {/* Email Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                Email address
              </label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" size={18} />
                <input
                  id="login-email"
                  className="auth-input"
                  type="email"
                  name="email"
                  placeholder="name@university.edu"
                  value={form.email}
                  onChange={handle}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={18} />
                <input
                  id="login-password"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handle}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="auth-options-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="auth-forgot-link"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotSent(false);
                  setForgotEmail(form.email || '');
                }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              id="login-btn"
              className="btn btn-primary auth-submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account? <Link to="/register">Create one for free</Link>
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal Dialog ── */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className="auth-card"
            style={{ maxWidth: 420, animation: 'dropdownFade 0.2s ease', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowForgotModal(false)}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--slate-400)',
              }}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 6 }}>
              Reset Password
            </h3>
            <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 20 }}>
              Enter your email and we'll send you instructions to reset your account password.
            </p>

            {forgotSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle2 size={44} color="#10B981" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, color: 'var(--navy-900)', marginBottom: 4 }}>
                  Reset Link Sent!
                </div>
                <div style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 20 }}>
                  If an account exists for <strong>{forgotEmail}</strong>, check your inbox for instructions.
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => setShowForgotModal(false)}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">
                    Account Email
                  </label>
                  <div className="auth-input-wrapper">
                    <Mail className="auth-input-icon" size={18} />
                    <input
                      id="forgot-email"
                      className="auth-input"
                      type="email"
                      placeholder="name@university.edu"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 44 }}>
                  Send Recovery Link
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
