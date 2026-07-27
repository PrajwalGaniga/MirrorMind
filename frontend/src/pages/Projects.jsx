import { useState, useEffect } from 'react';
import api from '../api/axios';
import { FolderGit2, Image as ImageIcon, FileText } from 'lucide-react';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveDemoUrl, setLiveDemoUrl] = useState('');
  const [techStack, setTechStack] = useState([]);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [certFile, setCertFile] = useState(null);
  
  const [submitLoading, setSubmitLoading] = useState(false);
  const [allSkills, setAllSkills] = useState([]);

  const fetchProjects = () => {
    setLoading(true);
    api.get('/api/students/projects')
      .then(res => setProjects(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
    api.get('/api/students/skills')
      .then(res => setAllSkills(res.data.map(s => s.name)))
      .catch(err => console.error(err));
  }, []);

  const toggleSkill = (skill) => {
    setTechStack(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const uploadToCloudinary = async (file, folder) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mirrormind_unsigned');
    formData.append('folder', folder);
    
    const res = await fetch('https://api.cloudinary.com/v1_1/ss5gnsii/auto/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    return data.secure_url;
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitLoading(true);
    try {
      let thumbnailUrl = null;
      let certificateUrl = null;

      if (thumbnailFile) {
        thumbnailUrl = await uploadToCloudinary(thumbnailFile, 'mirrormind/thumbnails');
      }
      if (certFile) {
        certificateUrl = await uploadToCloudinary(certFile, 'mirrormind/certificates');
      }

      const payload = {
        title,
        description,
        github_url: githubUrl || null,
        live_demo_url: liveDemoUrl || null,
        tech_stack: techStack,
        thumbnail_url: thumbnailUrl,
        certificate_url: certificateUrl
      };
      await api.post('/api/students/projects', payload);
      
      // Reset form
      setTitle('');
      setDescription('');
      setGithubUrl('');
      setLiveDemoUrl('');
      setTechStack([]);
      setThumbnailFile(null);
      setCertFile(null);
      document.getElementById('thumb-input').value = "";
      document.getElementById('cert-input').value = "";

      fetchProjects();
    } catch (err) {
      console.error(err);
      alert('Failed to add project');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this project?')) {
      try {
        await api.delete(`/api/students/projects/${id}`);
        fetchProjects();
      } catch(err) {
        console.error(err);
      }
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="dashboard-page" style={{ paddingBottom: '100px' }}>
      <div className="dashboard-hero">
        <div className="hero-info">
          <div className="hero-name">Featured Projects</div>
        </div>
      </div>
      <div className="dashboard-body">
        
        <form className="card" onSubmit={handleAddProject} style={{ marginBottom: 32, padding: 24 }}>
          <div className="section-title">Add New Project</div>
          
          <div className="form-group">
            <label className="form-label">Project Title *</label>
            <input required className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. AI Career Predictor" />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea required className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the project" rows={3} style={{ resize: 'vertical' }} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Tech Stack ({techStack.length} selected)</label>
            <div className="skills-grid" style={{ maxHeight: '200px', overflowY: 'auto', padding: '8px', border: 'var(--border-thick)', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
              {allSkills.length === 0 ? <div>Loading skills...</div> : allSkills.map(skill => (
                <div key={skill}
                  className={`skill-tag ${techStack.includes(skill) ? 'selected' : ''}`}
                  onClick={() => toggleSkill(skill)}
                  style={{ padding: '4px 10px', fontSize: 13 }}
                >{skill}</div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">GitHub URL</label>
              <input type="url" className="form-input" value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/..." />
            </div>
            <div className="form-group">
              <label className="form-label">Live Demo URL</label>
              <input type="url" className="form-input" value={liveDemoUrl} onChange={e => setLiveDemoUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label"><ImageIcon size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Thumbnail Image</label>
              <input id="thumb-input" type="file" accept="image/*" className="form-input" onChange={e => setThumbnailFile(e.target.files[0])} />
            </div>
            <div className="form-group">
              <label className="form-label"><FileText size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Certificate / Credential</label>
              <input id="cert-input" type="file" accept="image/*,application/pdf" className="form-input" onChange={e => setCertFile(e.target.files[0])} />
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ marginTop: 16 }}>
            {submitLoading ? 'Uploading & Adding...' : 'Add Project'}
          </button>
        </form>

        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FolderGit2 size={24} /> My Projects ({projects.length})</div>
        {projects.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            No projects added yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {projects.map(p => (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderBottom: 'var(--border-thick)' }} />
                ) : (
                  <div style={{ width: '100%', height: '200px', background: 'var(--accent-amber)', borderBottom: 'var(--border-thick)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <FolderGit2 size={48} opacity={0.5} />
                  </div>
                )}
                
                <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{p.title}</div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 16, flex: 1 }}>{p.description}</div>
                  
                  {(p.github_url || p.live_demo_url) && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>GitHub ↗</a>}
                      {p.live_demo_url && <a href={p.live_demo_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Live Demo ↗</a>}
                    </div>
                  )}

                  {p.tech_stack && p.tech_stack.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                      {p.tech_stack.map(t => (
                        <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', border: '1px solid #000', borderRadius: 99, background: 'var(--bg-primary)' }}>{t}</span>
                      ))}
                    </div>
                  )}

                  <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--accent-rose)', borderColor: 'var(--accent-rose)', alignSelf: 'flex-start' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
