import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import StepProgress from '../components/StepProgress';

const BRANCHES = ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL', 'OTHER'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];
const DOMAINS = ['Software', 'Data', 'ML-AI', 'DevOps', 'Embedded', 'Other', 'None'];
const CAREER_INTERESTS = [
  'AI_ML', 'SWE_FRONTEND', 'SWE_BACKEND', 'DATA_ANALYST', 'DEVOPS_CLOUD',
  'DATA_ENGINEER', 'FULLSTACK', 'CYBERSECURITY', 'EMBEDDED', 'RESEARCH', 'PRODUCT_MANAGER'
];
const WORK_STYLES = ['Startup', 'MNC', 'Research', 'Government'];

const ALL_SKILLS = [
  'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue', 'node.js',
  'express', 'django', 'fastapi', 'flask', 'spring boot', 'html', 'css', 'tailwind',
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'firebase', 'tensorflow', 'pytorch',
  'keras', 'scikit-learn', 'machine learning', 'deep learning', 'nlp', 'computer vision',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'linux', 'git', 'github',
  'ci/cd', 'tableau', 'power bi', 'excel', 'statistics', 'data analysis', 'spark', 'kafka',
  'c++', 'c#', 'go', 'rust', 'swift', 'kotlin', 'php', 'ruby',
  'penetration testing', 'cybersecurity', 'embedded c', 'arduino', 'raspberry pi', 'rtos'
];

const EMPTY = {
  name: '', branch: 'CSE', cgpa: '', semester: 1, college_tier: 'Tier 2', backlog_count: 0,
  skills: [], certifications: [], projects_count: 0,
  internship_count: 0, internship_domain: 'None',
  career_interest: 'AI_ML', work_style_pref: 'Startup', communication_rating: 3,
};

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [certInput, setCertInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

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
        certifications: data.certifications || [],
        projects_count: data.projects_count ?? 0,
        internship_count: data.internship_count ?? 0,
        internship_domain: data.internship_domain || 'None',
        career_interest: data.career_interest || 'AI_ML',
        work_style_pref: data.work_style_pref || 'Startup',
        communication_rating: data.communication_rating || 3,
      });
    }).catch(() => {});
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleSkill = (skill) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
    }));
  };

  const addCert = () => {
    const v = certInput.trim();
    if (v && !form.certifications.includes(v)) {
      set('certifications', [...form.certifications, v]);
    }
    setCertInput('');
  };

  const removeCert = (c) => set('certifications', form.certifications.filter(x => x !== c));

  const next = () => { setError(''); setStep(s => s + 1); };
  const back = () => { setError(''); setStep(s => s - 1); };

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const payload = {
        ...form,
        cgpa: parseFloat(form.cgpa) || 0,
        projects_count: parseInt(form.projects_count) || 0,
        internship_count: parseInt(form.internship_count) || 0,
        backlog_count: parseInt(form.backlog_count) || 0,
        semester: parseInt(form.semester) || 1,
        communication_rating: parseInt(form.communication_rating) || 3,
      };
      const { data } = await api.post('/api/students/profile', payload);
      localStorage.setItem('student_id', data.student_id);
      await api.get('/api/predict');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Submission failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-header">
        <h1>🧠 MirrorMind</h1>
        <p>Build your profile to unlock your career predictions</p>
      </div>

      <div className="onboarding-card">
        <StepProgress current={step} total={5} />

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
              <div className="skills-grid">
                {ALL_SKILLS.map(skill => (
                  <div key={skill}
                    className={`skill-tag ${form.skills.includes(skill) ? 'selected' : ''}`}
                    onClick={() => toggleSkill(skill)}
                    id={`skill-${skill.replace(/[^a-z0-9]/g, '-')}`}
                  >{skill}</div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Certifications</label>
              <div className="cert-input-row">
                <input className="form-input" value={certInput} onChange={e => setCertInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCert()}
                  placeholder="e.g. AWS Cloud Practitioner" />
                <button className="btn btn-secondary btn-sm" type="button" onClick={addCert} style={{ whiteSpace: 'nowrap' }}>Add</button>
              </div>
              {form.certifications.length > 0 && (
                <div className="cert-list">
                  {form.certifications.map(c => (
                    <div key={c} className="cert-tag">
                      {c} <span className="cert-remove" onClick={() => removeCert(c)}>×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Projects Count</label>
              <input className="form-input" type="number" min="0" value={form.projects_count}
                onChange={e => set('projects_count', e.target.value)} placeholder="4" />
            </div>
            <div className="step-actions">
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              <button className="btn btn-primary" onClick={next}>Next →</button>
            </div>
          </>
        )}

        {/* STEP 3 — Experience */}
        {step === 3 && (
          <>
            <div className="step-title">Experience</div>
            <div className="step-subtitle">Share your industry exposure</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Internships (0–5)</label>
                <input className="form-input" type="number" min="0" max="5" value={form.internship_count}
                  onChange={e => set('internship_count', e.target.value)} placeholder="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Internship Domain</label>
                <select className="form-select" value={form.internship_domain} onChange={e => set('internship_domain', e.target.value)}>
                  {DOMAINS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="step-actions">
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              <button className="btn btn-primary" onClick={next}>Next →</button>
            </div>
          </>
        )}

        {/* STEP 4 — Preferences */}
        {step === 4 && (
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
              <label className="form-label">Communication Rating: {form.communication_rating}/5</label>
              <input type="range" className="rating-slider" min="1" max="5" step="1"
                value={form.communication_rating} onChange={e => set('communication_rating', e.target.value)} />
              <div className="rating-labels"><span>1 - Basic</span><span>3 - Good</span><span>5 - Excellent</span></div>
            </div>
            <div className="step-actions">
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              <button className="btn btn-primary" onClick={next}>Review →</button>
            </div>
          </>
        )}

        {/* STEP 5 — Review */}
        {step === 5 && (
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
              <div className="review-item"><div className="review-label">Projects</div><div className="review-value">{form.projects_count}</div></div>
              <div className="review-item"><div className="review-label">Internships</div><div className="review-value">{form.internship_count} ({form.internship_domain})</div></div>
              <div className="review-item"><div className="review-label">Career Interest</div><div className="review-value">{form.career_interest}</div></div>
              <div className="review-item"><div className="review-label">Work Style</div><div className="review-value">{form.work_style_pref}</div></div>
            </div>
            <div className="review-item" style={{ marginTop: 16 }}>
              <div className="review-label">Skills ({form.skills.length})</div>
              <div className="review-skills">
                {form.skills.length ? form.skills.map(s => <span key={s} className="review-skill-chip">{s}</span>) : <span style={{ color: 'var(--text-muted)' }}>None selected</span>}
              </div>
            </div>
            {form.certifications.length > 0 && (
              <div className="review-item" style={{ marginTop: 12 }}>
                <div className="review-label">Certifications</div>
                <div className="review-skills">
                  {form.certifications.map(c => <span key={c} className="review-skill-chip">{c}</span>)}
                </div>
              </div>
            )}
            <div className="step-actions" style={{ marginTop: 28 }}>
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              <button id="submit-profile-btn" className="btn btn-primary" onClick={submit} disabled={loading}>
                {loading ? '⏳ Submitting…' : '🚀 Submit & Predict'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
