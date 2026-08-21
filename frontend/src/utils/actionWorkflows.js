/**
 * actionWorkflows.js — Module 9 Deterministic Workflow Step Definitions
 *
 * Each workflow is an array of steps. Each step defines:
 *   key        — field name used when building the data object
 *   prompt     — text spoken/shown to user
 *   optional   — if true, user can say "skip" to bypass
 *   validator  — returns true if value is acceptable
 *   errorMsg   — spoken/shown when validator fails
 *   hint       — shown below input as a formatting hint
 */

// ── ADD_PROJECT ──────────────────────────────────────────────────────────────
export const ADD_PROJECT_WORKFLOW = {
  id: 'ADD_PROJECT',
  title: 'Add a Project',
  apiPath: '/api/students/projects',
  method: 'POST',
  steps: [
    {
      key: 'title',
      prompt: "What's the project name?",
      optional: false,
      validator: (v) => v.trim().length >= 2,
      errorMsg: "Please give the project a name (at least 2 characters).",
      hint: 'e.g. MirrorMind',
    },
    {
      key: 'description',
      prompt: "Give me a brief description of the project.",
      optional: false,
      validator: (v) => v.trim().length >= 10,
      errorMsg: "Description must be at least 10 characters.",
      hint: 'e.g. An AI academic and career intelligence assistant',
    },
    {
      key: 'tech_stack_raw',
      prompt: "What technologies did you use?",
      optional: false,
      validator: (v) => v.trim().length >= 2,
      errorMsg: "Please list at least one technology.",
      hint: 'e.g. FastAPI, MongoDB, React, Ollama',
    },
    {
      key: 'github_url',
      prompt: "What's the GitHub URL? Say skip if you don't have one.",
      optional: true,
      validator: (v) => !v || v === 'skip' || /^https?:\/\/.+/.test(v.trim()),
      errorMsg: "Please enter a valid URL starting with http or https, or say skip.",
      hint: 'e.g. https://github.com/username/project or skip',
    },
    {
      key: 'live_demo_url',
      prompt: "Is there a live demo URL? Say skip if not.",
      optional: true,
      validator: (v) => !v || v === 'skip' || /^https?:\/\/.+/.test(v.trim()),
      errorMsg: "Please enter a valid URL or say skip.",
      hint: 'e.g. https://mirrormind.app or skip',
    },
  ],
  /**
   * Build the final API payload from collected step data.
   * tech_stack_raw is a comma/space separated string → split into array.
   */
  buildPayload(data) {
    const techRaw = data.tech_stack_raw || '';
    const tech_stack = techRaw
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    return {
      title: data.title?.trim(),
      description: data.description?.trim(),
      tech_stack,
      github_url: (data.github_url && data.github_url !== 'skip') ? data.github_url.trim() : null,
      live_demo_url: (data.live_demo_url && data.live_demo_url !== 'skip') ? data.live_demo_url.trim() : null,
    };
  },
  previewLines(data) {
    const tech = (data.tech_stack_raw || '').split(/[,\s]+/).filter(Boolean).join(' • ');
    return [
      { label: 'Name', value: data.title },
      { label: 'Description', value: data.description },
      { label: 'Technologies', value: tech || '—' },
      { label: 'GitHub', value: (data.github_url && data.github_url !== 'skip') ? data.github_url : '—' },
      { label: 'Live Demo', value: (data.live_demo_url && data.live_demo_url !== 'skip') ? data.live_demo_url : '—' },
    ];
  },
  successMessage(data) {
    return `Your project ${data.title} has been added successfully.`;
  },
};

// ── ADD_INTERNSHIP ───────────────────────────────────────────────────────────
export const ADD_INTERNSHIP_WORKFLOW = {
  id: 'ADD_INTERNSHIP',
  title: 'Add an Internship',
  apiPath: '/api/students/internships',
  method: 'POST',
  steps: [
    {
      key: 'company_name',
      prompt: "What's the company name?",
      optional: false,
      validator: (v) => v.trim().length >= 2,
      errorMsg: "Please provide a company name.",
      hint: 'e.g. Google, Amazon, Infosys',
    },
    {
      key: 'role',
      prompt: "What was your role or position?",
      optional: false,
      validator: (v) => v.trim().length >= 2,
      errorMsg: "Please provide your role.",
      hint: 'e.g. Software Engineer Intern, Data Science Intern',
    },
    {
      key: 'domain',
      prompt: "What domain or field was the internship in?",
      optional: false,
      validator: (v) => v.trim().length >= 2,
      errorMsg: "Please provide the domain.",
      hint: 'e.g. Backend Development, Machine Learning, DevOps',
    },
    {
      key: 'start_date',
      prompt: "When did you start? Give the month and year.",
      optional: false,
      validator: (v) => v.trim().length >= 4,
      errorMsg: "Please provide a start date.",
      hint: 'e.g. January 2024 or 2024-01',
    },
    {
      key: 'end_date',
      prompt: "When did it end? Say ongoing if it's still active.",
      optional: true,
      validator: (v) => !v || v.trim().length >= 4,
      errorMsg: "Please provide an end date or say ongoing.",
      hint: 'e.g. June 2024, ongoing, or skip',
    },
    {
      key: 'description',
      prompt: "Give a brief description of what you did. Say skip to leave blank.",
      optional: true,
      validator: () => true,
      errorMsg: '',
      hint: 'e.g. Built REST APIs, worked on data pipelines',
    },
  ],
  buildPayload(data) {
    // Parse start date string → ISO datetime
    const parseDate = (s) => {
      if (!s || s.toLowerCase() === 'ongoing' || s.toLowerCase() === 'skip') return null;
      const d = new Date(s);
      if (!isNaN(d)) return d.toISOString();
      // Try "January 2024" format
      const d2 = new Date(`1 ${s}`);
      if (!isNaN(d2)) return d2.toISOString();
      return new Date().toISOString(); // fallback
    };

    const isOngoing = data.end_date?.toLowerCase() === 'ongoing';
    return {
      company_name: data.company_name?.trim(),
      role: data.role?.trim(),
      domain: data.domain?.trim(),
      start_date: parseDate(data.start_date),
      end_date: isOngoing ? null : parseDate(data.end_date),
      is_current: isOngoing ? 1 : 0,
      description: (data.description && data.description !== 'skip') ? data.description.trim() : null,
    };
  },
  previewLines(data) {
    const isOngoing = data.end_date?.toLowerCase() === 'ongoing';
    return [
      { label: 'Company', value: data.company_name },
      { label: 'Role', value: data.role },
      { label: 'Domain', value: data.domain },
      { label: 'Start', value: data.start_date },
      { label: 'End', value: isOngoing ? 'Ongoing' : (data.end_date || '—') },
      { label: 'Description', value: (data.description && data.description !== 'skip') ? data.description : '—' },
    ];
  },
  successMessage(data) {
    return `Your internship at ${data.company_name} has been added successfully.`;
  },
};

// ── EDIT_PROFILE ─────────────────────────────────────────────────────────────
// Dynamic: steps are generated at runtime based on which field(s) to update.
// Pre-extracted field and value from intentDetector are injected.

export const PROFILE_FIELD_LABELS = {
  name:                 'Full Name',
  branch:               'Branch',
  semester:             'Semester',
  cgpa:                 'CGPA',
  college_tier:         'College Tier',
  backlog_count:        'Backlog Count',
  career_interest:      'Career Interest',
  work_style_pref:      'Work Style',
  communication_rating: 'Communication Rating',
};

export const PROFILE_FIELD_VALIDATORS = {
  cgpa:                 (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 10,
  semester:             (v) => !isNaN(parseInt(v)) && parseInt(v) >= 1 && parseInt(v) <= 8,
  backlog_count:        (v) => !isNaN(parseInt(v)) && parseInt(v) >= 0,
  communication_rating: (v) => !isNaN(parseInt(v)) && parseInt(v) >= 1 && parseInt(v) <= 10,
};

export const PROFILE_FIELD_COERCERS = {
  cgpa:                 (v) => parseFloat(v),
  semester:             (v) => parseInt(v),
  backlog_count:        (v) => parseInt(v),
  communication_rating: (v) => parseInt(v),
};

export function buildEditProfileWorkflow(field, prefilledValue, currentProfile) {
  const label = PROFILE_FIELD_LABELS[field] || field;
  const currentVal = currentProfile?.[field];
  const validator = PROFILE_FIELD_VALIDATORS[field] || ((v) => v.trim().length > 0);

  return {
    id: 'EDIT_PROFILE',
    title: `Update ${label}`,
    apiPath: '/api/students/profile/update',
    method: 'PATCH',
    steps: [
      {
        key: field,
        prompt: prefilledValue
          ? `You want to change your ${label} to "${prefilledValue}". Is that correct?`
          : `What would you like to change your ${label} to?${currentVal !== undefined ? ` (current: ${currentVal})` : ''}`,
        optional: false,
        prefilled: prefilledValue || null,
        validator,
        errorMsg: `Please provide a valid ${label}.`,
        hint: `Current: ${currentVal ?? 'not set'}`,
      },
    ],
    buildPayload(data) {
      const coerce = PROFILE_FIELD_COERCERS[field];
      return { [field]: coerce ? coerce(data[field]) : data[field]?.trim() };
    },
    previewLines(data) {
      return [
        { label: 'Field', value: label },
        { label: 'Current value', value: String(currentVal ?? '—') },
        { label: 'New value', value: String(data[field] ?? '—') },
      ];
    },
    successMessage(data) {
      return `Your ${label} has been updated to ${data[field]}.`;
    },
  };
}

// ── OPEN_DOCUMENT ────────────────────────────────────────────────────────────
export const OPEN_DOCUMENT_WORKFLOW = {
  id: 'OPEN_DOCUMENT',
  title: 'Open Document',
  // No apiPath or method, handled locally via handler function in useActionEngine
  steps: [],
  buildPayload(data) {
    return { query: data.query };
  },
  previewLines(data) {
    return [
      { label: 'Document', value: data.query || 'Resume' }
    ];
  },
  successMessage(data) {
    return `Opening ${data.query || 'document'}...`;
  },
  previewPrompt(data) {
    return `I'll open your ${data.query || 'document'}. Shall I proceed?`;
  }
};

// ── NAVIGATE ─────────────────────────────────────────────────────────────────
export const NAVIGATE_WORKFLOW = {
  id: 'NAVIGATE',
  title: 'Navigate',
  steps: [],
  buildPayload(data) {
    return { path: data.path };
  },
  previewLines(data) {
    return [
      { label: 'Destination', value: data.path }
    ];
  },
  successMessage(data) {
    return `Navigating to ${data.path}...`;
  },
  previewPrompt(data) {
    return `I'll take you to ${data.path}. Shall I proceed?`;
  }
};

// ── Workflow registry ────────────────────────────────────────────────────────
export const WORKFLOWS = {
  ADD_PROJECT:    ADD_PROJECT_WORKFLOW,
  ADD_INTERNSHIP: ADD_INTERNSHIP_WORKFLOW,
  OPEN_DOCUMENT:  OPEN_DOCUMENT_WORKFLOW,
  NAVIGATE:       NAVIGATE_WORKFLOW,
  // EDIT_PROFILE is built dynamically via buildEditProfileWorkflow()
};

// ── Confirmation word lists ──────────────────────────────────────────────────
export const CONFIRM_WORDS = ['yes', 'yeah', 'yep', 'yup', 'proceed', 'save', 'save it', 'confirm', 'go ahead', 'do it', 'correct', 'open', 'open it', 'ok', 'okay'];
export const NO_WORDS = ['no', "don't save", 'dont save', 'not now', "don't", 'dont'];
export const CANCEL_WORDS  = ['cancel', 'stop', 'abort', 'discard', 'forget it', 'discard this', 'never mind', 'nevermind'];

