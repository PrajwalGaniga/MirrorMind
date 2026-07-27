import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PrimaryRoleCard from '../components/PrimaryRoleCard';
import PredictionCards from '../components/PredictionCards';
import SkillRadarChart from '../components/SkillRadarChart';

const POLL_INTERVAL_MS = 4000; // Re-poll while waiting for fresh ML result
const MAX_RETRIES = 8;

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
      // Clear cache first, then re-fetch
      await api.post('/api/predict/refresh');
      await fetchPredictions();
    } catch (err) {
      setError('Refresh failed. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <div className="loading-text">Analysing your profile…</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
          The ML model is running. This may take up to 30 seconds on first load.
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page" style={{ paddingBottom: '100px' }}>
      <div className="dashboard-hero">
        <div className="hero-info">
          <div className="hero-name">Career Predictions</div>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh}>
            🔄 Refresh
          </button>
        </div>
      </div>
      <div className="dashboard-body">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            <strong>Prediction Error:</strong> {error}
            <br />
            <span style={{ fontSize: 13 }}>This can happen if the ML model is still loading. Wait a moment and click Refresh.</span>
          </div>
        )}
        {data && (
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
        )}
      </div>
    </div>
  );
}
