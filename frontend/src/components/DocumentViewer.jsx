/**
 * DocumentViewer.jsx — Module 9 Split-Screen PDF Viewer
 *
 * Slides in from the right when a document is opened via voice/text command.
 * Uses an <iframe> pointing to the Cloudinary-hosted PDF URL.
 * Intelligence chat remains fully functional alongside it.
 */
import { useEffect, useRef } from 'react';
import { X, FileText, ExternalLink } from 'lucide-react';

export default function DocumentViewer({ document: doc, onClose }) {
  const iframeRef = useRef(null);

  // Build a viewable URL — use the raw Cloudinary URL directly
  // which will trigger the browser's native PDF viewer.
  const getViewerUrl = (doc) => {
    if (!doc) return '';
    const raw = doc.cloudinary_url || doc.file_url || '';
    if (!raw) return '';
    return raw;
  };

  // Keyboard escape to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!doc) return null;

  const viewerUrl = getViewerUrl(doc);
  const rawUrl = doc.cloudinary_url || doc.file_url || '';

  return (
    <div className="doc-viewer-panel" role="complementary" aria-label="Document viewer">
      {/* Header bar */}
      <div className="doc-viewer-header">
        <div className="doc-viewer-title">
          <FileText size={16} />
          <span title={doc.filename}>{doc.filename}</span>
          {doc.category && (
            <span className="doc-viewer-badge">{doc.category}</span>
          )}
        </div>
        <div className="doc-viewer-controls">
          {rawUrl && (
            <a
              href={rawUrl}
              target="_blank"
              rel="noreferrer"
              className="doc-viewer-external"
              title="Open in new tab"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <button
            className="doc-viewer-close"
            onClick={onClose}
            title="Close document (Esc)"
            aria-label="Close document viewer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* PDF iframe */}
      <div className="doc-viewer-body">
        {viewerUrl ? (
          <iframe
            ref={iframeRef}
            src={viewerUrl}
            className="doc-viewer-iframe"
            title={`Viewing: ${doc.filename}`}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="doc-viewer-error">
            <FileText size={48} opacity={0.3} />
            <p>No preview available for this document.</p>
            {rawUrl && (
              <a href={rawUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ width: 'auto', marginTop: 12 }}>
                Open in new tab ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
