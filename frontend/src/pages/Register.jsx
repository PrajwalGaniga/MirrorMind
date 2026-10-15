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
  Mic, 
  FolderGit2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', form);
      login(data.token, data.user);
      navigate('/onboarding');
    } catch (err) {
      console.error('[REGISTER ERROR]', err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message === 'Network Error' || !err.response) {
        setError(
          `Connection failed: Cannot reach backend server at ${api.defaults.baseURL || 'localhost:8000'}. Check if the server or ngrok tunnel is online.`
        );
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split-wrapper">
        {/* ── Left Column: Brand Feature Showcase (Desktop & Tablet) ── */}
        <div className="auth-brand-showcase">
          <div>
            <div className="auth-showcase-badge">
              <Sparkles size={14} />
              <span>Career Intelligence Engine</span>
            </div>

            <h2 className="auth-showcase-title">
              Start building your future with AI today.
            </h2>
            <p className="auth-showcase-desc">
              Create your account to unlock real-time mock interviews, role probability matrices, and custom portfolio analysis built for tech careers.
            </p>

            <div className="auth-brand-features">
              <div className="auth-brand-feature-item">
                <div className="auth-feature-icon">
                  <Brain size={18} />
                </div>
                <div>
                  <div className="auth-feature-title">AI Career Predictions</div>
                  <div className="auth-feature-sub">Rankings across 10 engineering specializations</div>
                </div>
              </div>

              <div className="auth-brand-feature-item">
                <div className="auth-feature-icon">
                  <Mic size={18} />
                </div>
                <div>
                  <div className="auth-feature-title">Nova Voice Co-Pilot</div>
                  <div className="auth-feature-sub">Interactive interview simulation with Gemini Live</div>
                </div>
              </div>

              <div className="auth-brand-feature-item">
                <div className="auth-feature-icon">
                  <FolderGit2 size={18} />
                </div>
                <div>
                  <div className="auth-feature-title">Project & Skill Verification</div>
                  <div className="auth-feature-sub">Direct resume & credential intelligence extraction</div>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-showcase-footer">
            <span>MirrorMind Platform v2.4</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color="#10B981" /> 100% Student-First Privacy
            </span>
          </div>
        </div>

        {/* ── Right Column: Registration Form ── */}
        <div className="auth-form-column">
          <div className="auth-logo">
            <div className="auth-logo-icon">🧠</div>
            <span className="auth-logo-text">MirrorMind</span>
          </div>

          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Start your personalized career prediction journey</p>

          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit}>
            {/* Email Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                Email address
              </label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" size={18} />
                <input
                  id="reg-email"
                  className="auth-input"
                  type="email"
                  name="email"
                  placeholder="arjun@university.edu"
                  value={form.email}
                  onChange={handle}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="reg-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={18} />
                <input
                  id="reg-password"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handle}
                  required
                  minLength={6}
                  autoComplete="new-password"
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
              <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>
                Must be at least 6 characters long
              </div>
            </div>

            {/* Terms & Conditions Checkbox */}
            <div className="auth-options-row" style={{ marginTop: 14, marginBottom: 20 }}>
              <label className="auth-checkbox-label" style={{ fontSize: 12, lineHeight: 1.4 }}>
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span>
                  I agree to the <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Terms of Service</span> and <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Privacy Policy</span>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="register-btn"
              className="btn btn-primary auth-submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  <span>Creating account…</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
