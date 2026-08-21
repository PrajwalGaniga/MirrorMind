/**
 * useActionEngine.js — Module 9 Action State Machine Hook
 *
 * Manages the lifecycle of a deterministic workflow:
 *   idle → collecting (step by step) → preview → confirm → executing → done
 *
 * Exposes:
 *   activeAction   — null | { workflow, stepIndex, data, status, interruptIntent }
 *   startAction    — (intent, payload, currentProfile) => void
 *   submitStep     — (value: string) => Promise<void>
 *   cancelAction   — () => void
 *   confirmAction  — () => Promise<void>
 *   handleDocumentOpen — (query, documents) => { found, doc, candidates }
 *
 * Dependencies passed in via options (avoids circular imports):
 *   navigate, user, api, onSpeak, onSetVoiceState
 */

import { useState, useRef, useCallback } from 'react';
import api from '../api/axios';
import { WORKFLOWS, buildEditProfileWorkflow, CONFIRM_WORDS, NO_WORDS, CANCEL_WORDS } from '../utils/actionWorkflows';

const ACTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function useActionEngine({ navigate, user, onSpeak, onSetVoiceState }) {
  const [activeAction, setActiveAction] = useState(null);
  // openDocument: null | { doc }
  const [openDocument, setOpenDocument] = useState(null);

  const timeoutRef = useRef(null);
  const activeActionRef = useRef(null); // stable ref for async callbacks

  // Keep ref in sync
  const setAction = useCallback((val) => {
    activeActionRef.current = val;
    setActiveAction(val);
  }, []);

  // ── Document open/close ───────────────────────────────────────────────────
  const handleDocumentOpen = useCallback((query, documents) => {
    if (!documents || documents.length === 0) {
      return { found: false, doc: null, candidates: [] };
    }

    const q = query.toLowerCase();
    // Try to extract a filename hint from the query
    const filenameHint = q.match(/(\w[\w.\-_]+\.pdf)/i)?.[1]?.toLowerCase();

    let matches = documents;

    // Filter by filename hint if present
    if (filenameHint) {
      const filtered = documents.filter(d => d.filename.toLowerCase().includes(filenameHint));
      if (filtered.length > 0) matches = filtered;
    } else {
      // Filter by keywords: resume, cv, project, report, certificate, transcript
      const KEYWORDS = ['resume', 'cv', 'project', 'report', 'certificate', 'transcript'];
      const keyword = KEYWORDS.find(k => q.includes(k));
      if (keyword) {
        const filtered = documents.filter(d =>
          d.filename.toLowerCase().includes(keyword) ||
          d.category?.toLowerCase().includes(keyword)
        );
        if (filtered.length > 0) matches = filtered;
      }
    }

    if (matches.length === 1) {
      return { found: true, doc: matches[0], candidates: [] };
    }
    if (matches.length > 1) {
      return { found: false, doc: null, candidates: matches };
    }
    return { found: false, doc: null, candidates: [] };
  }, []);

  const openDocumentById = useCallback((doc) => {
    setOpenDocument(doc);
    console.log(`[MIRRORMIND][ACTION] open_document filename=${doc.filename}`);
  }, []);

  const closeDocument = useCallback(() => {
    setOpenDocument(null);
    console.log('[MIRRORMIND][ACTION] close_document');
  }, []);

  // ── Session timeout ────────────────────────────────────────────────────────
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (activeActionRef.current) {
        console.log('[MIRRORMIND][ACTION] session_timeout — clearing incomplete workflow');
        setAction(null);
        onSpeak?.('Action session expired. No changes were saved.');
        onSetVoiceState?.('WAKE_LISTENING');
      }
    }, ACTION_TIMEOUT_MS);
  }, [onSpeak, onSetVoiceState, setAction]);

  const clearTimeout_ = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // ── Start a new action ─────────────────────────────────────────────────────
  const startAction = useCallback(async (intent, payload, currentProfile) => {
    console.log(`[MIRRORMIND][ACTION] intent=${intent}`);

    let workflow = null;

    if (intent === 'ADD_PROJECT')    workflow = WORKFLOWS.ADD_PROJECT;
    if (intent === 'ADD_INTERNSHIP') workflow = WORKFLOWS.ADD_INTERNSHIP;
    if (intent === 'OPEN_DOCUMENT')  workflow = WORKFLOWS.OPEN_DOCUMENT;
    if (intent === 'NAVIGATE')       workflow = WORKFLOWS.NAVIGATE;
    if (intent === 'EDIT_PROFILE') {
      const { field, value } = payload;
      if (!field) {
        // Don't know which field — ask via RAG fallback or clarify
        onSpeak?.("What would you like to update in your profile? For example, say: change my CGPA to 9.2.");
        return { handled: true };
      }
      workflow = buildEditProfileWorkflow(field, value, currentProfile);
    }

    if (!workflow) return { handled: false };

    const firstStep = workflow.steps[0];
    const initialData = {};

    if (intent === 'OPEN_DOCUMENT') {
      initialData.doc = payload.doc;
      initialData.query = payload.query;
    }
    if (intent === 'NAVIGATE') {
      initialData.path = payload.path;
    }

    // Pre-fill if value was already extracted by intent detector
    if (intent === 'EDIT_PROFILE' && payload.value && firstStep?.prefilled) {
      initialData[firstStep.key] = payload.value;
    }

    const newAction = {
      workflow,
      stepIndex: 0,
      data: initialData,
      status: 'COLLECTING', // COLLECTING | PREVIEW | EXECUTING | DONE
    };

    setAction(newAction);
    resetTimeout();

    onSetVoiceState?.('ACTION_COLLECTING');

    // If workflow has 0 steps (e.g. OPEN_DOCUMENT, NAVIGATE)
    if (workflow.steps.length === 0) {
      const preview = { ...newAction, status: 'PREVIEW' };
      setAction(preview);
      onSetVoiceState?.('ACTION_PREVIEW');
      const prompt = workflow.previewPrompt ? workflow.previewPrompt(initialData) : buildPreviewSpeech(workflow, initialData);
      onSpeak?.(prompt, 'ACTION_PREVIEW');
      return { handled: true };
    }

    // If the first step has a pre-filled value, skip asking and go straight to preview
    if (intent === 'EDIT_PROFILE' && payload.value && workflow.steps.length === 1) {
      const firstName = (user?.name || 'there').split(' ')[0];
      const prompt = `Okay ${firstName}. You want to change your ${workflow.steps[0].key} to "${payload.value}". Should I save that?`;
      const preview = { ...newAction, status: 'PREVIEW' };
      setAction(preview);
      onSetVoiceState?.('ACTION_PREVIEW');
      onSpeak?.(prompt, 'ACTION_PREVIEW');
    } else {
      const firstName = (user?.name || 'there').split(' ')[0];
      const prompt = `Okay ${firstName}. ${firstStep.prompt}`;
      onSpeak?.(prompt, 'ACTION_COLLECTING');
    }

    console.log(`[MIRRORMIND][ACTION] step=${firstStep.key}`);
    return { handled: true };
  }, [user, onSpeak, onSetVoiceState, resetTimeout, setAction]);

  // ── Refine collected draft ─────────────────────────────────────────────────
  const refineDraft = useCallback(async (actionState, editInstruction = null) => {
    const { workflow, data } = actionState;
    console.log('[MIRRORMIND][ACTION] state=REFINING');
    console.log('[MIRRORMIND][ACTION] openrouter_refinement_started=true');
    
    setAction({ ...actionState, status: 'REFINING' });
    onSetVoiceState?.('ACTION_REFINING');
    
    if (editInstruction) {
      onSpeak?.('Refining your changes...', 'ACTION_REFINING');
    } else {
      onSpeak?.('Great. I have all the details. Let me prepare the information for you.', 'ACTION_REFINING');
    }

    try {
      const res = await api.post('/api/actions/normalize', {
        workflow_id: workflow.id,
        collected_data: data,
        edit_instruction: editInstruction,
        provider: 'openrouter'
      });
      
      const normalizedData = res.data.normalized;
      if (!normalizedData) throw new Error('Normalization failed to return valid JSON.');
      
      const updatedAction = { ...actionState, data: normalizedData, status: 'PREVIEW' };
      console.log('[MIRRORMIND][ACTION] preview_ready=true');
      setAction(updatedAction);
      onSetVoiceState?.('ACTION_PREVIEW');

      const previewText = buildPreviewSpeech(workflow, normalizedData);
      onSpeak?.(previewText, 'ACTION_PREVIEW');
    } catch (err) {
      console.error('[MIRRORMIND][ACTION] refinement error:', err);
      onSpeak?.('Something went wrong while preparing your information. Please review or try again.');
      // Revert to PREVIEW with unrefined data so they can edit or cancel
      const fallbackAction = { ...actionState, status: 'PREVIEW' };
      setAction(fallbackAction);
      onSetVoiceState?.('ACTION_PREVIEW');
    }
  }, [onSpeak, onSetVoiceState, setAction]);

  // ── Submit a step answer ───────────────────────────────────────────────────
  const submitStep = useCallback(async (value) => {
    const current = activeActionRef.current;
    if (!current || current.status !== 'COLLECTING') return;

    resetTimeout();

    const { workflow, stepIndex, data } = current;
    const step = workflow.steps[stepIndex];

    if (!step) return;

    // Handle "skip" for optional steps
    const isSkip = value.trim().toLowerCase() === 'skip';
    const effectiveValue = (step.optional && isSkip) ? 'skip' : value;

    // Validate
    if (!step.optional || !isSkip) {
      if (!step.validator(effectiveValue)) {
        onSpeak?.(step.errorMsg);
        return;
      }
    }

    const newData = { ...data, [step.key]: effectiveValue };
    const nextStepIndex = stepIndex + 1;

    console.log(`[MIRRORMIND][ACTION] step=${step.key} value="${effectiveValue.substring(0, 40)}"`);

    if (nextStepIndex >= workflow.steps.length) {
      // All steps collected
      const updatedAction = { ...current, data: newData, stepIndex: nextStepIndex };

      if (['ADD_PROJECT', 'ADD_INTERNSHIP'].includes(workflow.id)) {
        refineDraft(updatedAction);
      } else {
        const previewAction = { ...updatedAction, status: 'PREVIEW' };
        setAction(previewAction);
        onSetVoiceState?.('ACTION_PREVIEW');

        const previewText = buildPreviewSpeech(workflow, newData);
        onSpeak?.(previewText, 'ACTION_PREVIEW');
        console.log('[MIRRORMIND][ACTION] preview_ready=true');
      }
    } else {
      // Advance to next step
      const nextStep = workflow.steps[nextStepIndex];
      const updatedAction = { ...current, data: newData, stepIndex: nextStepIndex };
      setAction(updatedAction);

      onSpeak?.(nextStep.prompt, 'ACTION_COLLECTING');
      console.log(`[MIRRORMIND][ACTION] step=${nextStep.key}`);
    }
  }, [onSpeak, onSetVoiceState, resetTimeout, setAction, refineDraft]);

  // ── Build preview speech ───────────────────────────────────────────────────
  function buildPreviewSpeech(workflow, data) {
    const lines = workflow.previewLines(data);
    const summary = lines
      .filter(l => l.value && l.value !== '—')
      .map(l => `${l.label}: ${l.value}`)
      .join('. ');
    return `I've prepared the details. ${summary}. Should I save this?`;
  }

  // ── Confirm and execute ────────────────────────────────────────────────────
  const confirmAction = useCallback(async () => {
    const current = activeActionRef.current;
    if (!current || current.status !== 'AWAITING_SAVE_CONFIRMATION') return;

    clearTimeout_();
    const { workflow, data } = current;
    setAction({ ...current, status: 'SAVING' });
    onSetVoiceState?.('ACTION_SAVING');
    console.log('[MIRRORMIND][ACTION] database_save_started=true');

    try {
      const payload = workflow.buildPayload(data);
      console.log(`[MIRRORMIND][ACTION] execution=started apiPath=${workflow.apiPath}`);

      if (workflow.id === 'OPEN_DOCUMENT') {
        const query = data.query?.toLowerCase() || 'resume';
        const res = await api.get('/api/documents');
        const docs = res.data;
        const matched = docs.find(d => 
          (d.filename && d.filename.toLowerCase().includes(query)) ||
          (d.type && d.type.toLowerCase().includes(query)) ||
          (d.category && d.category.toLowerCase().includes(query))
        );
        
        if (matched) {
          openDocumentById(matched);
        } else {
          throw new Error(`Could not find a document matching "${data.query}".`);
        }
      } else if (workflow.id === 'NAVIGATE') {
        navigate(data.path);
      } else if (workflow.method === 'POST') {
        await api.post(workflow.apiPath, payload);
      } else if (workflow.method === 'PATCH') {
        await api.patch(workflow.apiPath, payload);
      }

      console.log('[MIRRORMIND][ACTION] database_save_success=true');
      setAction(null);
      onSetVoiceState?.('WAKE_LISTENING');
      onSpeak?.(workflow.successMessage(data), 'WAKE_LISTENING');
    } catch (err) {
      console.error('[MIRRORMIND][ACTION] execution=failed', err);
      const msg = err.response?.data?.detail || 'Something went wrong. Nothing was saved.';
      setAction(null);
      onSetVoiceState?.('ERROR');
      onSpeak?.(`Save failed. ${msg}`, 'ERROR');
    }
  }, [clearTimeout_, onSpeak, onSetVoiceState, setAction, navigate, openDocumentById]);

  // ── Cancel workflow ────────────────────────────────────────────────────────
  const cancelAction = useCallback(async (silent = false) => {
    clearTimeout_();
    const current = activeActionRef.current;
    setAction(null);
    onSetVoiceState?.('WAKE_LISTENING');
    if (!silent && current) {
      onSpeak?.('Action cancelled. No changes were saved.', 'WAKE_LISTENING');
    }
    console.log('[MIRRORMIND][ACTION] cancelled');
  }, [clearTimeout_, onSpeak, onSetVoiceState, setAction]);

  // ── Handle confirmation/cancel voice input during PREVIEW ─────────────────
  const handleConfirmationInput = useCallback(async (input) => {
    const current = activeActionRef.current;
    if (!current) return;

    const clean = input.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const isConfirm = CONFIRM_WORDS.some(w => clean.includes(w));
    const isNo      = NO_WORDS.some(w => clean.includes(w));
    const isCancel  = CANCEL_WORDS.some(w => clean.includes(w));
    
    // Explicit hardcoded check for exact value logging requirement
    console.log(`[MIRRORMIND][ACTION][CONFIRMATION] value=${clean}`);

    if (current.status === 'PREVIEW') {
      if (isConfirm) {
        console.log('[MIRRORMIND][ACTION] preview_confirmed=true');
        setAction({ ...current, status: 'AWAITING_SAVE_CONFIRMATION' });
        onSetVoiceState?.('ACTION_AWAITING_SAVE_CONFIRMATION');
        onSpeak?.('Everything looks good. Would you like me to save this?', 'ACTION_AWAITING_SAVE_CONFIRMATION');
      } else if (isNo || isCancel) {
        setAction({ ...current, status: 'EDITING' });
        onSetVoiceState?.('ACTION_EDITING');
        onSpeak?.('Okay. What would you like to change?', 'ACTION_EDITING');
      } else {
        onSpeak?.("I didn't understand. Please say yes to proceed, or no to make changes.");
      }
    } else if (current.status === 'AWAITING_SAVE_CONFIRMATION') {
      if (isConfirm) {
        console.log('[MIRRORMIND][ACTION] save_confirmation=true');
        await confirmAction();
      } else if (isCancel) {
        await cancelAction();
      } else if (isNo) {
        setAction({ ...current, status: 'PREVIEW' });
        onSetVoiceState?.('ACTION_PREVIEW');
        onSpeak?.("Okay. I won't save it. Your information is still available here if you'd like to make changes.", 'ACTION_PREVIEW');
      } else {
        onSpeak?.("Please say yes to save, or no to cancel.");
      }
    } else if (current.status === 'EDITING') {
      if (isCancel) {
        await cancelAction();
        return;
      }
      if (['ADD_PROJECT', 'ADD_INTERNSHIP'].includes(current.workflow.id)) {
        refineDraft(current, input);
      } else {
        setAction({ ...current, status: 'PREVIEW' });
        onSetVoiceState?.('ACTION_PREVIEW');
        onSpeak?.("I can't refine this automatically. Let's review it again.", 'ACTION_PREVIEW');
      }
    }
  }, [confirmAction, cancelAction, refineDraft, onSpeak, setAction]);

  // ── Handle interruption (new intent mid-workflow) ─────────────────────────
  const handleInterruption = useCallback(async (newIntent, newPayload, currentProfile) => {
    const current = activeActionRef.current;
    if (!current) {
      // No active action — just start the new one
      return startAction(newIntent, newPayload, currentProfile);
    }

    // Warn user
    const workflowName = current.workflow.title;
    const msg = `You're currently working on: ${workflowName}. Do you want to cancel that and ${describeIntent(newIntent)} instead?`;
    onSpeak?.(msg);

    // Store pending interrupt for the next confirmation
    setAction({ ...current, pendingInterrupt: { intent: newIntent, payload: newPayload, currentProfile } });
    return { handled: true, interrupted: true };
  }, [startAction, onSpeak, setAction]);

  // ── Handle interrupt confirmation ─────────────────────────────────────────
  const resolveInterruption = useCallback(async (confirmed) => {
    const current = activeActionRef.current;
    if (!current?.pendingInterrupt) return;

    const { intent, payload, currentProfile } = current.pendingInterrupt;

    if (confirmed) {
      setAction(null);
      await startAction(intent, payload, currentProfile);
    } else {
      // Resume current workflow
      const resumed = { ...current, pendingInterrupt: undefined };
      setAction(resumed);
      const step = resumed.workflow.steps[resumed.stepIndex];
      onSpeak?.(`Okay, continuing. ${step?.prompt || 'Ready to continue.'}`);
    }
  }, [startAction, onSpeak, setAction]);



  return {
    activeAction,
    openDocument,
    startAction,
    submitStep,
    cancelAction,
    confirmAction,
    handleConfirmationInput,
    handleInterruption,
    resolveInterruption,
    handleDocumentOpen,
    openDocumentById,
    closeDocument,
  };
}

// ── Intent description helper ─────────────────────────────────────────────
function describeIntent(intent) {
  const MAP = {
    ADD_PROJECT: 'add a project',
    ADD_INTERNSHIP: 'add an internship',
    EDIT_PROFILE: 'update your profile',
    NAVIGATE: 'navigate',
    OPEN_DOCUMENT: 'open a document',
    CLOSE_DOCUMENT: 'close the document',
  };
  return MAP[intent] || intent.toLowerCase().replace('_', ' ');
}
