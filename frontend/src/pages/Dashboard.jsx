import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import PrimaryRoleCard from '../components/PrimaryRoleCard';
import PredictionCards from '../components/PredictionCards';
import SkillRadarChart from '../components/SkillRadarChart';
import InsightBanner from '../components/InsightBanner';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchPredictions = async () => {
    setLoading(true); setError('');
    try {
      const { data: res } = await api.get('/api/predict');
      setData(res);
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/onboarding');
      } else {
        setError(err.response?.data?.detail || 'Failed to load predictions.');
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPredictions(); }, []);

  // Test profile uses the LOGGED-IN user's real name so it never overwrites with "Test Student"
  const runTestProfile = async () => {
    setTestLoading(true); setError('');
    try {
      const testPayload = {
        name: user?.name || 'Student',          // ← real user name, never hardcoded
        branch: 'CSE', cgpa: 8.5, semester: 7,
        college_tier: 'Tier 2', backlog_count: 0,
        skills: ['python', 'tensorflow', 'sql', 'numpy', 'scikit-learn', 'pytorch'],
        certifications: ['Google ML Crash Course'],
        projects_count: 5, internship_count: 1,
        internship_domain: 'ML-AI', career_interest: 'AI_ML',
        work_style_pref: 'Startup', communication_rating: 4,
      };
      await api.post('/api/students/profile', testPayload);
      const { data: res } = await api.get('/api/predict');
      setData(res);
    } catch (err) {
      setError('Test profile failed: ' + (err.response?.data?.detail || err.message));
    } finally { setTestLoading(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <div className="loading-text">Analysing your profile…</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <nav className="dashboard-nav">
        <div className="nav-logo">🧠 MirrorMind</div>
        <div className="nav-right">
          <span className="nav-user">{user?.name || user?.email}</span>
          <button
            id="dev-mode-btn"
            className="btn btn-ghost btn-sm dev-btn"
            onClick={() => navigate('/developer')}
          >
            ⚡ Developer Mode
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/onboarding')}>Edit Profile</button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-hero">
        <div className="hero-info">
          <div>
            {/* name / branch / cgpa come ONLY from API response (MongoDB student doc) */}
            <div className="hero-name">{data?.name || '—'}</div>
            <div className="hero-meta">
              {data?.branch && <span className="hero-badge">📚 {data.branch}</span>}
              {data?.cgpa > 0 && <span className="hero-badge">🎓 CGPA {data.cgpa}</span>}
              <span className="hero-badge">
                {data?.predictions?.[0]?.label ? `🏆 ${data.predictions[0].label}` : '🔮 Predictions Ready'}
              </span>
            </div>
          </div>
          <button
            id="test-profile-btn"
            className="btn btn-secondary btn-sm"
            onClick={runTestProfile}
            disabled={testLoading}
          >
            {testLoading ? '⏳ Loading…' : '🧪 Test Profile'}
          </button>
        </div>
      </div>

      <div className="dashboard-body">
        {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}
        <InsightBanner insight={data?.top_insight} />
        <div className="dashboard-grid-top">
          <PrimaryRoleCard prediction={data?.predictions?.[0]} />
          <div className="card">
            <PredictionCards predictions={data?.predictions} />
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <SkillRadarChart skillRadar={data?.skill_radar} />
        </div>
      </div>
    </div>
  );
}
