import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import StepProgress from '../components/StepProgress';

const BRANCHES = ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL', 'OTHER'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];
const CAREER_INTERESTS = [
  'AIML_ENGINEER', 'PRODUCT_MANAGER', 'DEVOPS_CLOUD', 'DATA_ANALYST', 
  'CYBERSECURITY', 'SWE_FRONTEND', 'EMBEDDED_IOT', 'SWE_BACKEND', 
  'FULLSTACK_DEV', 'DATA_ENGINEER'
];
const WORK_STYLES = ['Independent', 'Team Player', 'Hybrid', 'Startup'];

const EMPTY = {
  name: '', branch: 'CSE', cgpa: '', semester: 1, college_tier: 'Tier 2', backlog_count: 0,
  skills: [],
  career_interest: 'SWE_BACKEND', work_style_pref: 'Independent', communication_rating: 7,
};

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [loading, setLoading] = useState(false);
  const [allSkills, setAllSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load available skills from backend
  useEffect(() => {
    setSkillsLoading(true);
    setSkillsError('');
    api.get('/api/students/skills')
      .then(res => {
        const names = res.data.map(s => s.name);
        setAllSkills(names);
        setSkillsLoading(false);
      })
      .catch(err => {
        console.error('Skills fetch failed:', err);
        setSkillsError('Could not load skills. Please refresh the page.');
        setSkillsLoading(false);
      });
  }, []);

  // pre-fill name from auth user
  useEffect(() => {
    if (user?.name) setForm(f => ({ ...f, name: user.name }));
  }, [user]);

  // Try to load existing profile
  useEffect(() => {
    api.get('/api/students/profile').then(({ data }) => {
      setForm({
        name: data.name || user?.name || '',
        branch: data.branch || 'CSE',
        cgpa: data.cgpa ?? '',
        semester: data.semester || 1,
        college_tier: data.college_tier || 'Tier 2',
        backlog_count: data.backlog_count ?? 0,
        skills: data.skills || [],
        career_interest: data.career_interest || 'SWE_BACKEND',
        work_style_pref: data.work_style_pref || 'Independent',
        communication_rating: data.communication_rating || 7,
      });
    }).catch(() => {});
  }, [user?.name]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleSkill = (skill) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
    }));
  };

  const next = () => { setError(''); setStep(s => s + 1); };
  const back = () => { setError(''); setStep(s => s - 1); };

  const submit = async () => {
    setError(''); setLoading(true); setSaveStatus('saving');
    try {
      const payload = {
        ...form,
        cgpa: parseFloat(form.cgpa) || 0,
        backlog_count: parseInt(form.backlog_count) || 0,
        semester: parseInt(form.semester) || 1,
        communication_rating: parseInt(form.communication_rating) || 7,
      };
      const { data } = await api.post('/api/students/profile', payload);

      // Verify the backend returned a persisted profile document
      if (!data.profile) {
        throw new Error('Backend did not return a persisted profile. Please try again.');
      }

      console.log('[MIRRORMIND][PROFILE] Persistence confirmed:', {
        name: data.profile.name,
        cgpa: data.profile.cgpa,
        branch: data.profile.branch,
        skills_count: data.profile.skills?.length ?? 0,
        projects_count: data.profile.projects_count ?? 0,
        internships_count: data.profile.internship_count ?? 0,
      });

      localStorage.setItem('student_id', data.student_id);
      setSaveStatus('saved');

      // Run ML prediction in background without blocking UI
      api.get('/api/predict').catch(() => {});

      // Brief confirmation before navigating
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      setSaveStatus('error');
      setError(err.response?.data?.detail || err.message || 'Submission failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-header">
        <h1>🧠 MirrorMind</h1>
        <p>Build your profile to unlock your career predictions</p>
      </div>

      <div className="onboarding-card">
        <StepProgress current={step} total={4} />

        {error && <div className="alert alert-error">{error}</div>}

        {/* STEP 1 — Academic */}
        {step === 1 && (
          <>
            <div className="step-title">Academic Details</div>
            <div className="step-subtitle">Tell us about your academic background</div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <select className="form-select" value={form.branch} onChange={e => set('branch', e.target.value)}>
                  {BRANCHES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-select" value={form.semester} onChange={e => set('semester', e.target.value)}>
                  {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">CGPA (0–10)</label>
                <input className="form-input" type="number" min="0" max="10" step="0.01"
                  value={form.cgpa} onChange={e => set('cgpa', e.target.value)} placeholder="8.2" />
              </div>
              <div className="form-group">
                <label className="form-label">College Tier</label>
                <select className="form-select" value={form.college_tier} onChange={e => set('college_tier', e.target.value)}>
                  {TIERS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Active Backlogs</label>
              <input className="form-input" type="number" min="0" value={form.backlog_count}
                onChange={e => set('backlog_count', e.target.value)} placeholder="0" />
            </div>
            <div className="step-actions">
              <button className="btn btn-primary" onClick={next}>Next →</button>
            </div>
          </>
        )}

        {/* STEP 2 — Skills */}
        {step === 2 && (
          <>
            <div className="step-title">Technical Skills</div>
            <div className="step-subtitle">Click to select your skills · {form.skills.length} selected</div>
            <div className="form-group">
              {skillsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} style={{ height: 32, width: 80 + Math.random() * 40, borderRadius: 99, background: 'var(--bg-secondary)', border: '1px solid #ddd', animation: 'pulse 1.2s ease infinite' }} />
                    ))}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading skills from server...</div>
                </div>
              ) : skillsError ? (
                <div className="alert alert-error" style={{ marginBottom: 8 }}>
                  {skillsError}
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft: 12 }} onClick={() => window.location.reload()}>Retry</button>
                </div>
              ) : (
                <div className="skills-grid">
                  {allSkills.map(skill => (
                    <div key={skill}
                      className={`skill-tag ${form.skills.includes(skill) ? 'selected' : ''}`}
                      onClick={() => toggleSkill(skill)}
                    >{skill}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="step-actions">
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              <button className="btn btn-primary" onClick={next}>Next →</button>
            </div>
          </>
        )}

        {/* STEP 3 — Preferences */}
        {step === 3 && (
          <>
            <div className="step-title">Preferences</div>
            <div className="step-subtitle">Help us understand your goals</div>
            <div className="form-group">
              <label className="form-label">Career Interest</label>
              <select className="form-select" value={form.career_interest} onChange={e => set('career_interest', e.target.value)}>
                {CAREER_INTERESTS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Work Style Preference</label>
              <div className="radio-group">
                {WORK_STYLES.map(w => (
                  <label key={w} className={`radio-card ${form.work_style_pref === w ? 'selected' : ''}`}>
                    <input type="radio" name="work_style" value={w}
                      checked={form.work_style_pref === w}
                      onChange={() => set('work_style_pref', w)} />
                    <span className="radio-label">{w}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Communication Rating: {form.communication_rating}/10</label>
              <input type="range" className="rating-slider" min="1" max="10" step="1"
                value={form.communication_rating} onChange={e => set('communication_rating', e.target.value)} />
              <div className="rating-labels"><span>1 - Basic</span><span>5 - Good</span><span>10 - Excellent</span></div>
            </div>
            <div className="step-actions">
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              <button className="btn btn-primary" onClick={next}>Review →</button>
            </div>
          </>
        )}

        {/* STEP 4 — Review */}
        {step === 4 && (
          <>
            <div className="step-title">Review & Submit</div>
            <div className="step-subtitle">Confirm your details before we predict your career</div>
            <div className="review-grid">
              <div className="review-item"><div className="review-label">Name</div><div className="review-value">{form.name || '—'}</div></div>
              <div className="review-item"><div className="review-label">Branch</div><div className="review-value">{form.branch}</div></div>
              <div className="review-item"><div className="review-label">Semester</div><div className="review-value">{form.semester}</div></div>
              <div className="review-item"><div className="review-label">CGPA</div><div className="review-value">{form.cgpa || '—'}</div></div>
              <div className="review-item"><div className="review-label">College Tier</div><div className="review-value">{form.college_tier}</div></div>
              <div className="review-item"><div className="review-label">Backlogs</div><div className="review-value">{form.backlog_count}</div></div>
              <div className="review-item"><div className="review-label">Career Interest</div><div className="review-value">{form.career_interest}</div></div>
              <div className="review-item"><div className="review-label">Work Style</div><div className="review-value">{form.work_style_pref}</div></div>
              <div className="review-item"><div className="review-label">Communication</div><div className="review-value">{form.communication_rating}/10</div></div>
            </div>
            <div className="review-item" style={{ marginTop: 16 }}>
              <div className="review-label">Skills ({form.skills.length})</div>
              <div className="review-skills">
                {form.skills.length ? form.skills.map(s => <span key={s} className="review-skill-chip">{s}</span>) : <span style={{ color: 'var(--text-muted)' }}>None selected</span>}
              </div>
            </div>
            <div className="step-actions" style={{ marginTop: 28 }}>
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              <button id="submit-profile-btn" className="btn btn-primary" onClick={submit} disabled={loading || saveStatus === 'saving' || saveStatus === 'saved'}>
                {saveStatus === 'saving' ? '⏳ Saving profile…'
                  : saveStatus === 'saved' ? '✅ Saved — redirecting…'
                  : loading ? '⏳ Submitting…'
                  : '🚀 Submit & Predict'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
