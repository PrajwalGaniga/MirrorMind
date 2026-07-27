import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import InsightBanner from '../components/InsightBanner';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/students/profile');
      setProfile(data);
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/onboarding');
      } else {
        setError(err.response?.data?.detail || 'Failed to load profile.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <div className="loading-text">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page" style={{ paddingBottom: '100px' }}>
      <div className="dashboard-hero">
        <div className="hero-info">
          <div>
            <div className="hero-name">Welcome, {profile?.name || user?.name || 'Student'}!</div>
            <div className="hero-meta">
              <span className="hero-badge">🎓 {profile?.branch || 'N/A'} · Sem {profile?.semester || 'N/A'}</span>
              <span className="hero-badge">📊 CGPA: {profile?.cgpa || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-body">
        {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}

        {/* Quick Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{profile?.projects_count ?? (profile?.projects?.length ?? 0)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Projects</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{profile?.internship_count ?? (profile?.internships?.length ?? 0)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Internships</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{profile?.skills?.length ?? 0}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Skills</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{profile?.cgpa ?? '—'}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>CGPA</div>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔮</div>
          <h2 style={{ marginBottom: 8 }}>Your AI Career Predictions</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            Our ML model analyses your skills, CGPA, projects, and internships to predict the best career paths for you.
          </p>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/predict')}>
            View Predictions ✨
          </button>
        </div>
      </div>
    </div>
  );
}
