import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [category, setCategory] = useState('project');
  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/documents');
      setDocuments(data);
    } catch (err) {
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    
    // Client side validation
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    try {
      await api.post('/api/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('✓ Document uploaded successfully. The document is now stored in your MirrorMind knowledge base.');
      fileInputRef.current.value = '';
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?\n\nRemoving this document will permanently remove the stored file.')) {
      return;
    }
    
    setError('');
    setSuccess('');
    
    try {
      await api.delete(`/api/documents/${docId}`);
      setSuccess('Document deleted successfully.');
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete document.');
    }
  };

  const handleViewDocument = async (doc) => {
    if (doc.cloudinary_url) {
      window.open(doc.cloudinary_url, '_blank', 'noopener,noreferrer');
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/documents/${doc._id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch document');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Cleanup object URL after a while to avoid memory leaks
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Failed to open document. It may have been deleted.');
    }
  };

  const handleProcess = async (docId) => {
    try {
      // 1. Start Processing
      setDocuments(docs => docs.map(doc => doc._id === docId ? { ...doc, processing_status: 'processing' } : doc));
      await api.post(`/api/documents/${docId}/process`);
      
      // Fetch intermediate state so UI updates
      const { data: updatedDocs } = await api.get('/api/documents');
      setDocuments(updatedDocs);
      
      // 2. Start Embedding if processing was successful
      const processedDoc = updatedDocs.find(d => d._id === docId);
      if (processedDoc && processedDoc.processing_status === 'processed') {
          setDocuments(docs => docs.map(doc => doc._id === docId ? { ...doc, embedding_status: 'embedding' } : doc));
          await api.post(`/api/documents/${docId}/embed`);
          fetchDocuments();
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to process document.');
      fetchDocuments();
    }
  };

  return (
    <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
      <h2 style={{ marginBottom: '16px' }}>My Documents</h2>
      
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16, color: 'green' }}>{success}</div>}

      <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Upload Document</h3>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>File:</label>
            <input 
              type="file" 
              accept=".pdf,application/pdf"
              ref={fileInputRef}
              disabled={uploading}
              style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Category:</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              disabled={uploading}
              className="input"
              style={{ width: '150px' }}
            >
              <option value="project">Project</option>
              <option value="resume">Resume</option>
              <option value="internship">Internship</option>
              <option value="certificate">Certificate</option>
              <option value="academic">Academic</option>
              <option value="learning">Learning</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleUpload}
            disabled={uploading}
            style={{ minWidth: '100px' }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {uploading && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '12px', marginBottom: '4px' }}>Uploading...</div>
            <div style={{ height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '75%', background: 'var(--primary-color)' }}></div>
            </div>
          </div>
        )}
      </div>

      <div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>Loading documents...</div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No documents uploaded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {documents.map((doc) => (
              <div key={doc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                    {doc.original_filename}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{doc.category}</span>
                    <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                    <span>Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>Status:</strong>
                    {doc.processing_status === 'uploaded' && <span>Uploaded. Not processed yet.</span>}
                    {doc.processing_status === 'processing' && (
                      <span style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                        Extracting text...
                      </span>
                    )}
                    {doc.processing_status === 'failed' && <span style={{ color: 'red' }}>Document processing failed.</span>}
                    
                    {doc.processing_status === 'processed' && (
                      <>
                        {!doc.embedding_status && <span style={{ color: 'orange' }}>Text extracted. Embedding pending.</span>}
                        {doc.embedding_status === 'embedding' && (
                          <span style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                            Generating semantic embeddings...
                          </span>
                        )}
                        {doc.embedding_status === 'embedded' && (
                          <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Ready for MirrorMind</span>
                        )}
                        {doc.embedding_status === 'failed' && (
                          <span style={{ color: 'red' }}>Document processed, but semantic indexing failed.</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleViewDocument(doc)}
                      className="btn"
                      style={{ background: '#f5f5f5', color: '#333' }}
                    >
                      View
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleDelete(doc._id)}
                      disabled={doc.processing_status === 'processing'}
                    >
                      Delete
                    </button>
                  </div>
                  
                  {(doc.processing_status === 'uploaded' || doc.processing_status === 'failed' || doc.embedding_status === 'failed') && (
                    <button 
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleProcess(doc._id)}
                      disabled={doc.processing_status === 'processing' || doc.embedding_status === 'embedding'}
                    >
                      {(doc.processing_status === 'failed' || doc.embedding_status === 'failed') ? 'Retry Process' : 'Process Document'}
                    </button>
                  )}
                  {doc.processing_status === 'processed' && (
                    <button 
                      className="btn"
                      style={{ padding: '6px 12px', fontSize: '12px', background: '#f5f5f5', color: '#333' }}
                      onClick={() => handleProcess(doc._id)}
                    >
                      Reprocess
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
