import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PrimaryRoleCard from '../components/PrimaryRoleCard';
import PredictionCards from '../components/PredictionCards';
import SkillRadarChart from '../components/SkillRadarChart';

const POLL_INTERVAL_MS = 4000; // Re-poll while waiting for fresh ML result
const MAX_RETRIES = 8;

const LoadingPipeline = () => {
  const steps = [
    "Fetching your profile and skill data...",
    "Sending data to the feature extraction layer...",
    "Generating embeddings for your tech stack...",
    "Running AI regression model on industry trends...",
    "Formatting predictive insights..."
  ];
  
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // The ML model can take up to 30s. Change step every ~4.5 seconds so it feels paced.
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 4500);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 24 }}>
      <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, minHeight: '54px' }}>
          {steps[currentStep]}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          {steps.map((_, idx) => (
            <div 
              key={idx} 
              style={{
                width: 12, 
                height: 12, 
                borderRadius: '50%', 
                backgroundColor: idx <= currentStep ? 'var(--primary)' : 'var(--bg-secondary)',
                transition: 'background-color 0.5s ease',
                boxShadow: idx === currentStep ? '0 0 8px var(--primary)' : 'none'
              }}
            />
          ))}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 24 }}>
          Our ML pipeline is securely analyzing your data in the background. This process takes up to 30 seconds on the first load.
        </div>
      </div>
    </div>
  );
};

export default function Predict() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  const fetchPredictions = useCallback(async (isRetry = false) => {
    if (!isRetry) {
      setLoading(true);
      setError('');
    }
    try {
      const { data: res } = await api.get('/api/predict');
      setData(res);
      setLoading(false);
      setRetryCount(0);
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/onboarding');
      } else {
        const msg = err.response?.data?.detail || 'Failed to load predictions.';
        setError(msg);
        setLoading(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      // 1. Tell the backend to wipe ALL cache (student.predictions + prediction_cache)
      await api.post('/api/predict/refresh');
      // 2. Fetch with force=true — backend will ALWAYS re-run ML, never serve stale data
      const { data: res } = await api.get('/api/predict?force=true');
      setData(res);
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/onboarding');
      } else {
        setError('Refresh failed. Please try again.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="dashboard-page" style={{ paddingBottom: '100px' }}>
      <div className="dashboard-hero">
        <div className="hero-info">
          <div className="hero-name">Career Predictions</div>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? '⏳ Computing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>
      <div className="dashboard-body">
        {loading ? (
          <LoadingPipeline />
        ) : error ? (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            <strong>Prediction Error:</strong> {error}
            <br />
            <span style={{ fontSize: 13 }}>This can happen if the ML model is still loading. Wait a moment and click Refresh.</span>
          </div>
        ) : data ? (
          <>
            {data.ml_failed && (
              <div className="alert" style={{ marginBottom: 20, background: '#fff8e6', border: '2px solid #f5a623', borderRadius: 10, padding: '14px 20px', fontSize: 14 }}>
                ⚠️ <strong>ML model unavailable.</strong> Showing your last successfully computed predictions.{' '}
                <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }} onClick={handleRefresh}>Try Again</button>
              </div>
            )}
            <div className="dashboard-grid-top">
              <PrimaryRoleCard prediction={data?.predictions?.[0]} />
              <div className="card">
                <PredictionCards predictions={data?.predictions} />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <SkillRadarChart skillRadar={data?.skill_radar} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
