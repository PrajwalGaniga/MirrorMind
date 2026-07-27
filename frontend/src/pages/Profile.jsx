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
      <div className="dashboard-hero" style={{ position: 'relative', overflow: 'visible', marginBottom: 60, paddingBottom: 60, textAlign: 'center' }}>
        
        <button 
          onClick={() => navigate('/onboarding')}
          className="btn btn-secondary" 
          style={{ position: 'absolute', top: 24, right: 32, width: 'auto', padding: '0 20px', height: 44, zIndex: 10, boxShadow: '2px 4px 0px rgba(0,0,0,1)' }}
        >
          <Edit2 size={16} /> Edit Profile
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 20 }}>
          <div style={{ position: 'relative', marginBottom: 16 }}>
             <div style={{ 
               width: 140, height: 140, borderRadius: '50%', backgroundColor: 'var(--bg-card)', 
               border: '4px solid #000', overflow: 'hidden', boxShadow: '4px 6px 0px rgba(0,0,0,0.15)',
               display: 'flex', alignItems: 'center', justifyContent: 'center'
             }}>
               {profile?.avatar_url ? (
                 <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               ) : (
                 <span style={{ fontSize: 64 }}>👤</span>
               )}
             </div>
          </div>
          
          <h1 style={{ fontSize: 42, fontWeight: 800, color: '#111', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
            {profile?.name || user?.name || 'Your Name'}
          </h1>
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="hero-badge"><GraduationCap size={16} /> {profile?.branch || 'N/A'}</span>
            <span className="hero-badge">Semester {profile?.semester || 'N/A'}</span>
            <span className="hero-badge">Tier {profile?.college_tier || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-body" style={{ marginTop: -80, position: 'relative', zIndex: 5 }}>
        
        {/* Top Grid: Academic & Skills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
          
          {/* Academic Info */}
          <div className="card" style={{ animation: 'fadeUp 0.4s ease 0.1s both' }}>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><GraduationCap size={20} /> Academic Profile</div>
            <div className="review-grid">
              <div className="review-item">
                <div className="review-label">CGPA</div>
                <div className="review-value" style={{ fontSize: 28, color: 'var(--text-primary)', fontWeight: 800 }}>{profile?.cgpa || 'N/A'}</div>
              </div>
              <div className="review-item">
                <div className="review-label">Backlogs</div>
                <div className="review-value" style={{ fontSize: 28, fontWeight: 800 }}>{profile?.backlog_count ?? 0}</div>
              </div>
              <div className="review-item">
                <div className="review-label">Career Goal</div>
                <div className="review-value" style={{ textTransform: 'capitalize' }}>{profile?.career_interest?.replace('_', ' ').toLowerCase() || 'N/A'}</div>
              </div>
              <div className="review-item">
                <div className="review-label">Work Style</div>
                <div className="review-value">{profile?.work_style_pref || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Technical Skills */}
          <div className="card" style={{ animation: 'fadeUp 0.4s ease 0.2s both' }}>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Terminal size={20} /> Technical Skills</div>
            <div className="review-skills" style={{ gap: 10 }}>
              {profile?.skills?.length ? profile.skills.map(s => (
                <span key={s} className="skill-tag selected" style={{ padding: '6px 14px', fontSize: 14, pointerEvents: 'none' }}>{s}</span>
              )) : <div style={{ color: 'var(--text-muted)' }}>No skills added yet.</div>}
            </div>
          </div>
        </div>

        {/* Experience / Internships Section */}
        <div className="card" style={{ marginBottom: 32, animation: 'fadeUp 0.4s ease 0.3s both' }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Briefcase size={20} /> Experience</div>
          {profile?.internships?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {profile.internships.map(i => (
                <div key={i.id} style={{ padding: 20, border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', display: 'flex', gap: 20, alignItems: 'flex-start', boxShadow: '2px 2px 0 rgba(0,0,0,0.1)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--accent-primary)', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '2px 2px 0 rgba(0,0,0,1)' }}>
                    <Briefcase size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{i.role}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>{i.company_name} • {i.domain}</div>
                    {i.description && <div style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 8 }}>{i.description}</div>}
                    {i.certificate_url && (
                      <div>
                        <a href={i.certificate_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>View Certificate ↗</a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-secondary)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💼</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>No internships added.</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4 }}>Add your experience via the mobile app to boost your ML predictions.</div>
            </div>
          )}
        </div>

        {/* Featured Projects Section */}
        <div className="card" style={{ marginBottom: 40, animation: 'fadeUp 0.4s ease 0.4s both' }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FolderGit2 size={20} /> Featured Projects</div>
          {profile?.projects?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {profile.projects.map(p => (
                <div key={p.id} style={{ border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', boxShadow: '2px 4px 0 rgba(0,0,0,0.15)' }} 
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '4px 8px 0 rgba(0,0,0,0.2)'; }} 
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '2px 4px 0 rgba(0,0,0,0.15)'; }}>
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.title} style={{ width: '100%', height: 180, objectFit: 'cover', borderBottom: '2px solid #000' }} />
                  ) : (
                    <div style={{ width: '100%', height: 180, background: 'var(--accent-amber)', borderBottom: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderGit2 size={56} opacity={0.6} />
                    </div>
                  )}
                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{p.title}</div>
                    <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 16, flex: 1 }}>{p.description}</div>
                    
                    {(p.github_url || p.live_demo_url) && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>GitHub ↗</a>}
                        {p.live_demo_url && <a href={p.live_demo_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Live Demo ↗</a>}
                      </div>
                    )}

                    {p.tech_stack?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {p.tech_stack.slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', border: '2px solid #000', borderRadius: 99, background: 'var(--accent-secondary)' }}>{t}</span>
                        ))}
                        {p.tech_stack.length > 3 && <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px' }}>+{p.tech_stack.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-secondary)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>No projects added.</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4 }}>Showcase your work to stand out to recruiters.</div>
            </div>
          )}
        </div>
        
        <button className="btn btn-secondary" style={{ color: 'var(--accent-rose)', borderColor: 'var(--accent-rose)', maxWidth: 200, margin: '0 auto', display: 'flex' }} onClick={logout}>
          <LogOut size={18} /> Log Out
        </button>
      </div>
    </div>
  );
}
