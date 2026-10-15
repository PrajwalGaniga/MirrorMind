import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Edit2, LogOut, Briefcase, FolderGit2, GraduationCap, Terminal } from 'lucide-react';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/students/profile')
      .then(res => setProfile(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="dashboard-page" style={{ paddingBottom: '100px' }}>
      {/* Portfolio Hero Header */}
      <div className="dashboard-hero" style={{ position: 'relative', overflow: 'visible', marginBottom: 40, padding: '28px 24px', textAlign: 'center' }}>
        
        {/* Top Header Action Row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: 12 }}>
          <button 
            onClick={() => navigate('/onboarding')}
            className="btn btn-secondary" 
            style={{ padding: '0 18px', height: 40, fontSize: 13 }}
          >
            <Edit2 size={15} /> Edit Profile
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', marginBottom: 16 }}>
             <div style={{ 
               width: 120, height: 120, borderRadius: '50%', backgroundColor: 'var(--bg-card)', 
               border: '4px solid #FFFFFF', overflow: 'hidden', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
               display: 'flex', alignItems: 'center', justifyContent: 'center'
             }}>
               {profile?.avatar_url ? (
                 <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               ) : (
                 <span style={{ fontSize: 52 }}>👤</span>
               )}
             </div>
          </div>
          
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: 'var(--navy-900)', margin: '0 0 10px 0', letterSpacing: '-0.02em' }}>
            {profile?.name || user?.name || 'Your Name'}
          </h1>
          
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="hero-badge"><GraduationCap size={15} /> {profile?.branch || 'N/A'}</span>
            <span className="hero-badge">Semester {profile?.semester || 'N/A'}</span>
            <span className="hero-badge">Tier {profile?.college_tier || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-body">
        
        {/* Top Grid: Academic & Skills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
          
          {/* Academic Info */}
          <div className="card">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={20} color="var(--primary)" /> Academic Profile
            </div>
            <div className="review-grid">
              <div className="review-item">
                <div className="review-label">CGPA</div>
                <div className="review-value" style={{ fontSize: 24, color: 'var(--primary)', fontWeight: 800 }}>{profile?.cgpa || 'N/A'}</div>
              </div>
              <div className="review-item">
                <div className="review-label">Backlogs</div>
                <div className="review-value" style={{ fontSize: 24, fontWeight: 800 }}>{profile?.backlog_count ?? 0}</div>
              </div>
              <div className="review-item">
                <div className="review-label">Career Goal</div>
                <div className="review-value" style={{ textTransform: 'capitalize', fontSize: 13 }}>{profile?.career_interest?.replace(/_/g, ' ').toLowerCase() || 'N/A'}</div>
              </div>
              <div className="review-item">
                <div className="review-label">Work Style</div>
                <div className="review-value" style={{ fontSize: 13 }}>{profile?.work_style_pref || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Technical Skills */}
          <div className="card">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={20} color="var(--primary)" /> Technical Skills
            </div>
            <div className="skills-grid" style={{ gap: 8, maxHeight: 200 }}>
              {profile?.skills?.length ? profile.skills.map(s => (
                <span key={s} className="skill-tag selected" style={{ pointerEvents: 'none' }}>{s}</span>
              )) : <div style={{ color: 'var(--slate-400)', fontSize: 13 }}>No skills added yet.</div>}
            </div>
          </div>
        </div>

        {/* Experience / Internships Section */}
        <div className="card">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={20} color="var(--primary)" /> Experience
          </div>
          {profile?.internships?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {profile.internships.map(i => (
                <div key={i.id} style={{ padding: 18, border: 'var(--border-card)', borderRadius: 'var(--radius-inner)', background: 'var(--slate-50)', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 'min(100%, 240px)' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--navy-900)' }}>{i.role}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 6 }}>{i.company_name} • {i.domain}</div>
                    {i.description && <div style={{ fontSize: 13, color: 'var(--slate-700)', lineHeight: 1.5, marginBottom: 8 }}>{i.description}</div>}
                    {i.certificate_url && (
                      <div>
                        <a href={i.certificate_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>View Certificate ↗</a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--slate-50)', border: 'var(--border-card)', borderRadius: 'var(--radius-inner)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💼</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)' }}>No internships added.</div>
              <div style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4 }}>Add your experience via the Experience tab to boost your ML predictions.</div>
            </div>
          )}
        </div>

        {/* Featured Projects Section */}
        <div className="card">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderGit2 size={20} color="var(--primary)" /> Featured Projects
          </div>
          {profile?.projects?.length > 0 ? (
            <div className="responsive-grid-auto">
              {profile.projects.map(p => (
                <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.title} style={{ width: '100%', height: 160, objectFit: 'cover', borderBottom: 'var(--border-card)' }} />
                  ) : (
                    <div style={{ width: '100%', height: 160, background: 'var(--amber-bg)', borderBottom: 'var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderGit2 size={48} opacity={0.4} color="var(--amber-text)" />
                    </div>
                  )}
                  <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 6 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5, marginBottom: 14, flex: 1 }}>{p.description}</div>
                    
                    {(p.github_url || p.live_demo_url) && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                        {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>GitHub ↗</a>}
                        {p.live_demo_url && <a href={p.live_demo_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--purple-500)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Live Demo ↗</a>}
                      </div>
                    )}

                    {p.tech_stack?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {p.tech_stack.slice(0, 4).map(t => (
                          <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', border: '1px solid var(--slate-200)', borderRadius: 99, background: 'var(--slate-100)', color: 'var(--navy-800)' }}>{t}</span>
                        ))}
                        {p.tech_stack.length > 4 && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', color: 'var(--slate-500)' }}>+{p.tech_stack.length - 4}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--slate-50)', border: 'var(--border-card)', borderRadius: 'var(--radius-inner)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🚀</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)' }}>No projects added.</div>
              <div style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4 }}>Showcase your work in the Projects tab to enhance your profile.</div>
            </div>
          )}
        </div>
        
        <button 
          className="btn btn-secondary" 
          style={{ color: 'var(--rose-500)', borderColor: '#FECACA', maxWidth: 200, margin: '12px auto 0', display: 'flex' }} 
          onClick={logout}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}
