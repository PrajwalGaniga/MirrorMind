/**
 * ActionPanel.jsx — Module 9 Action Workflow UI
 *
 * Renders the active workflow: step prompts, collected data, preview, and
 * confirm/cancel controls. Only visible when activeAction is non-null.
 */
import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, ChevronRight, Loader2 } from 'lucide-react';

export default function ActionPanel({
  activeAction,
  onSubmitStep,
  onCancel,
  onConfirm,
  onConfirmInput,
  handsFree,
}) {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const inputRef = useRef(null);

  // Clear input when step advances
  useEffect(() => {
    setInputValue('');
    setInputError('');
    if (inputRef.current && !handsFree) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [activeAction?.stepIndex, handsFree]);

  if (!activeAction) return null;

  const { workflow, stepIndex, data, status } = activeAction;
  const totalSteps = workflow.steps.length;
  const currentStep = status === 'COLLECTING' ? workflow.steps[stepIndex] : null;
  const isExecuting = status === 'SAVING';
  const isPreview   = status === 'PREVIEW' || status === 'AWAITING_SAVE_CONFIRMATION' || status === 'EDITING';
  const isCollecting = status === 'COLLECTING';
  const isRefining  = status === 'REFINING';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const val = inputValue.trim();
    if (status === 'EDITING') {
      if (!val) return;
      setInputError('');
      onConfirmInput?.(val);
      setInputValue('');
      return;
    }
    if (!val && !currentStep?.optional && status === 'COLLECTING') {
      setInputError(currentStep?.errorMsg || 'Please enter a value.');
      return;
    }
    setInputError('');
    onSubmitStep(val || 'skip');
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Build preview lines
  const previewLines = isPreview ? workflow.previewLines(data) : [];

  return (
    <div className="action-panel" role="region" aria-label="Action workflow">
      {/* Header */}
      <div className="action-panel-header">
        <div className="action-panel-title-row">
          <span className="action-panel-icon">🎯</span>
          <span className="action-panel-title">{workflow.title}</span>
          {isExecuting && <Loader2 size={16} className="action-spinner" />}
        </div>
        {isCollecting && (
          <div className="action-step-indicator">
            Step {stepIndex + 1} of {totalSteps}
            <div className="action-step-bar">
              {workflow.steps.map((_, i) => (
                <div
                  key={i}
                  className={`action-step-dot ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>
        )}
        {status === 'PREVIEW' && (
          <div className="action-step-indicator">
            <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>📋 Review Before Saving</span>
          </div>
        )}
        {status === 'AWAITING_SAVE_CONFIRMATION' && (
          <div className="action-step-indicator">
            <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>✅ Ready to Save</span>
          </div>
        )}
        {status === 'EDITING' && (
          <div className="action-step-indicator">
            <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>✏️ What would you like to change?</span>
          </div>
        )}
        {isExecuting && (
          <div className="action-step-indicator">
            <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>⚡ Saving…</span>
          </div>
        )}
        {isRefining && (
          <div className="action-step-indicator">
            <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>✨ Preparing your information…</span>
          </div>
        )}

        {/* Cancel button — always visible except during execution */}
        {!isExecuting && (
          <button
            className="action-cancel-btn"
            onClick={onCancel}
            title="Cancel action"
            aria-label="Cancel action"
          >
            <XCircle size={18} />
          </button>
        )}
      </div>

      {/* Step collection UI */}
      {isCollecting && currentStep && (
        <div className="action-body">
          {/* Chat history */}
          <div className="action-chat-history">
            {workflow.steps.slice(0, stepIndex).map((step) => {
              const val = data[step.key];
              if (!val || val === 'skip') return null;
              return (
                <div key={step.key} className="action-chat-pair">
                  <div className="action-chat-msg ai-msg">
                    {step.prompt}
                  </div>
                  <div className="action-chat-msg user-msg">
                    {String(val)}
                  </div>
                </div>
              );
            })}

            {/* Current AI Prompt */}
            <div className="action-chat-pair">
              <div className="action-chat-msg ai-msg" style={{ borderLeft: '4px solid #6366f1' }}>
                {currentStep.prompt}
                {currentStep.hint && <div className="action-chat-hint" style={{ marginTop: '8px', marginLeft: 0 }}>{currentStep.hint}</div>}
              </div>
            </div>
          </div>

          {/* Text input (hidden in pure hands-free but still usable for text mode) */}
          <form className="action-input-row" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className={`action-input ${inputError ? 'action-input-error' : ''}`}
              type="text"
              placeholder={currentStep.optional ? 'Type your answer or "skip"' : 'Type your answer…'}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setInputError(''); }}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              aria-label={currentStep.prompt}
            />
            <button
              type="submit"
              className="btn btn-primary action-submit-btn"
              disabled={isExecuting}
            >
              Next →
            </button>
          </form>
          {inputError && <div className="action-input-error-msg">{inputError}</div>}

          {handsFree && (
            <div className="action-voice-hint">🎤 Speak your answer — MirrorMind is listening</div>
          )}
        </div>
      )}

      {/* Preview UI */}
      {isPreview && (
        <div className="action-body">
          <div className="action-preview-card">
            {previewLines.map(({ label, value }) => (
              <div key={label} className="action-preview-row">
                <span className="action-preview-label">{label}</span>
                <span className="action-preview-value">{value || '—'}</span>
              </div>
            ))}
          </div>

          {status === 'EDITING' && (
            <form className="action-input-row" onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
              <input
                ref={inputRef}
                className={`action-input ${inputError ? 'action-input-error' : ''}`}
                type="text"
                placeholder="Type what you want to change..."
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setInputError(''); }}
                onKeyDown={handleKeyDown}
                disabled={isExecuting || isRefining}
              />
              <button
                type="submit"
                className="btn btn-primary action-submit-btn"
                disabled={isExecuting || isRefining || !inputValue.trim()}
              >
                Update
              </button>
            </form>
          )}

          {handsFree && (
            <div className="action-voice-hint">
              {status === 'PREVIEW' ? (
                <>🎤 Say <strong>Looks good</strong> to proceed or <strong>Edit</strong> to change</>
              ) : status === 'AWAITING_SAVE_CONFIRMATION' ? (
                <>🎤 Say <strong>Yes</strong> to save or <strong>No</strong> to cancel</>
              ) : status === 'EDITING' ? (
                <>🎤 Speak your changes, or say <strong>Cancel</strong></>
              ) : null}
            </div>
          )}

          <div className="action-confirm-buttons">
            {status === 'PREVIEW' && (
              <>
                <button className="btn btn-primary action-confirm-btn" onClick={() => onConfirmInput?.('yes')}>
                  <CheckCircle2 size={16} /> Looks Good
                </button>
                <button className="btn btn-secondary action-edit-btn" onClick={() => onConfirmInput?.('no')}>
                  Edit
                </button>
              </>
            )}
            {status === 'AWAITING_SAVE_CONFIRMATION' && (
              <>
                <button className="btn btn-primary action-confirm-btn" onClick={() => onConfirmInput?.('yes')}>
                  <CheckCircle2 size={16} /> Save to Profile
                </button>
                <button className="btn btn-secondary action-edit-btn" onClick={() => onConfirmInput?.('no')}>
                  Don't Save
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Refining/Executing spinner */}
      {(isExecuting || isRefining) && (
        <div className="action-body action-executing">
          <Loader2 size={28} className="action-spinner-lg" />
          <span>{isRefining ? 'Refining your changes...' : 'Saving your changes…'}</span>
        </div>
      )}
    </div>
  );
}
