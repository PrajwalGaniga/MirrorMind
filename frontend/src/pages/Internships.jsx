import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Briefcase, FileText } from 'lucide-react';

export default function Internships() {
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [domain, setDomain] = useState('Software');
  const [description, setDescription] = useState('');
  const [certFile, setCertFile] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchInternships = () => {
    setLoading(true);
    api.get('/api/students/internships')
      .then(res => setInternships(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInternships();
  }, []);

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

  const handleAddInternship = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      let certificateUrl = null;
      if (certFile) {
        certificateUrl = await uploadToCloudinary(certFile, 'mirrormind/certificates');
      }

      const payload = {
        role,
        company_name: company,
        domain,
        description,
        certificate_url: certificateUrl,
        start_date: new Date().toISOString()
      };
      await api.post('/api/students/internships', payload);
      
      setRole('');
      setCompany('');
      setDomain('Software');
      setDescription('');
      setCertFile(null);
      if (document.getElementById('cert-input')) document.getElementById('cert-input').value = "";
      
      fetchInternships();
    } catch (err) {
      console.error(err);
      alert('Failed to add internship');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this internship?')) {
      try {
        await api.delete(`/api/students/internships/${id}`);
        fetchInternships();
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
          <div className="hero-name">Experience</div>
        </div>
      </div>
      <div className="dashboard-body">
        
        <form className="card" onSubmit={handleAddInternship} style={{ marginBottom: 32, padding: 24 }}>
          <div className="section-title">Add New Experience</div>
          
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Role *</label>
              <input required className="form-input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Frontend Developer Intern" />
            </div>
            <div className="form-group">
              <label className="form-label">Company Name *</label>
              <input required className="form-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Domain</label>
            <select className="form-select" value={domain} onChange={e => setDomain(e.target.value)}>
              <option>Software</option>
              <option>Data</option>
              <option>ML-AI</option>
              <option>DevOps</option>
              <option>Embedded</option>
              <option>Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your responsibilities and achievements..." rows={3} style={{ resize: 'vertical' }} />
          </div>

          <div className="form-group">
            <label className="form-label"><FileText size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Certificate / Offer Letter</label>
            <input id="cert-input" type="file" accept="image/*,application/pdf" className="form-input" onChange={e => setCertFile(e.target.files[0])} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ marginTop: 16 }}>
            {submitLoading ? 'Uploading & Adding...' : 'Add Experience'}
          </button>
        </form>

        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Briefcase size={24} /> My Experience ({internships.length})</div>
        {internships.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            No internships added yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {internships.map(i => (
              <div key={i.id} className="card" style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: 50, height: 50, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Briefcase size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 'min(100%, 240px)' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy-900)' }}>{i.role}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 8 }}>{i.company_name} • {i.domain}</div>
                  {i.description && (
                    <div style={{ fontSize: 14, color: 'var(--slate-700)', lineHeight: 1.5, marginBottom: 12 }}>{i.description}</div>
                  )}
                  {i.certificate_url && (
                    <div style={{ marginBottom: 12 }}>
                      <a href={i.certificate_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>View Certificate ↗</a>
                    </div>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(i.id)} style={{ color: 'var(--rose-500)', borderColor: '#FECACA', marginTop: 4 }}>
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
