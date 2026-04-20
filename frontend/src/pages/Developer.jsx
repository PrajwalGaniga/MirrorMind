import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine
} from 'recharts';

// ── Helpers ────────────────────────────────────────────────────────────────────
const PipelineStep = ({ num, label, desc, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="pipeline-step">
      <div className="pipeline-step-node">{num}</div>
      <div className="pipeline-step-body">
        <div className="pipeline-step-card">
          <div className="pipeline-step-header" onClick={() => setOpen(o => !o)}>
            <div className="pipeline-step-header-left">
              <div>
                <div className="pipeline-step-label">{label}</div>
                <div className="pipeline-step-desc">{desc}</div>
              </div>
            </div>
            <span className={`pipeline-step-toggle ${open ? 'open' : ''}`}>⌃</span>
          </div>
          {open && <div className="pipeline-step-content">{children}</div>}
        </div>
      </div>
    </div>
  );
};

const ttStyle = {
  contentStyle: { background: '#141d35', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, color: '#f1f5f9', fontSize: 12 },
  cursor: { fill: 'rgba(99,102,241,0.05)' }
};

// ── Embedding mini-bar chart ────────────────────────────────────────────────────
function EmbedChart({ values }) {
  const data = values.map((v, i) => ({ name: `d${i}`, value: parseFloat(v.toFixed(4)) }));
  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip {...ttStyle} formatter={v => [v, 'Value']} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? '#6366f1' : '#f43f5e'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Horizontal score/prob chart ────────────────────────────────────────────────
function HorizChart({ data, colorMode = 'sign' }) {
  // colorMode: 'sign' = pos blue/neg red, 'rank' = top gold rest purple
  const max = Math.max(...data.map(d => Math.abs(d.value)));
  return (
    <ResponsiveContainer width="100%" height={data.length * 28 + 20}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 60, bottom: 4, left: 110 }}
      >
        <XAxis type="number" domain={colorMode === 'sign' ? ['auto', 'auto'] : [0, 1]}
          tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={100}
          tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        {colorMode === 'sign' && <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />}
        <Tooltip {...ttStyle} formatter={v => [
          colorMode === 'rank' ? `${(v * 100).toFixed(1)}%` : v.toFixed(3), ''
        ]} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {data.map((d, i) => {
            let fill;
            if (colorMode === 'rank') fill = i === 0 ? '#f59e0b' : '#8b5cf6';
            else fill = d.value >= 0 ? '#6366f1' : '#ef4444';
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main Developer Page ────────────────────────────────────────────────────────
export default function Developer() {
  const [allData, setAllData] = useState(null);
  const [selected, setSelected] = useState(0);
  const [myPipeline, setMyPipeline] = useState(null);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/developer/demo')
      .then(({ data }) => { setAllData(data.students); })
      .catch(() => setAllData([]))
      .finally(() => setLoading(false));
  }, []);

  const runMyProfile = async () => {
    setMyLoading(true); setMyError('');
    try {
      const { data } = await api.get('/api/developer/my-pipeline');
      setMyPipeline(data);
      setSelected(-1); // -1 = showing my profile
    } catch (err) {
      setMyError(err.response?.data?.detail || 'Failed to load your pipeline.');
    } finally { setMyLoading(false); }
  };

  const activeData = selected === -1 ? myPipeline : allData?.[selected];

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <div className="loading-text">Loading demo pipeline…</div>
      </div>
    );
  }

  const pipeline = activeData?.pipeline;
  const studentInfo = activeData?.student;

  // Prep chart data
  const rawScoresChart = pipeline
    ? Object.entries(pipeline.step4_classifier.raw_scores)
        .sort((a, b) => b[1] - a[1])
        .map(([role, value]) => ({ label: role.replace(/_/g, ' '), value }))
    : [];

  const probsChart = pipeline
    ? Object.entries(pipeline.step5_softmax.probabilities)
        .sort((a, b) => b[1] - a[1])
        .map(([role, value]) => ({ label: role.replace(/_/g, ' '), value }))
    : [];

  const top5 = pipeline?.step6_output?.top_5 || [];
  const profileText = pipeline?.step2_profile_text?.output || '';
  const embedPreview = pipeline?.step3_embedding?.embedding_preview || [];
  const classifierType = pipeline?.step4_classifier?.classifier_type || '—';

  return (
    <div className="dev-page">
      {/* Nav */}
      <nav className="dev-nav">
        <div className="dev-nav-title">
          ⚡ Developer Mode
          <span className="dev-nav-badge">LIVE PIPELINE TRACE</span>
        </div>
        <div className="dev-nav-right">
          {isAuthenticated ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={runMyProfile}
              disabled={myLoading}
            >
              {myLoading ? '⏳ Running…' : '🔬 Run on My Profile'}
            </button>
          ) : (
            <span className="dev-login-note">Login to run on your real profile</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </nav>

      <div className="dev-layout">
        {/* ── Left Panel ── */}
        <div className="dev-left">
          <div className="dev-panel-title">Demo Students</div>

          {myError && <div className="alert alert-error" style={{ fontSize: 12, padding: '8px 12px', marginBottom: 12 }}>{myError}</div>}

          {selected === -1 && myPipeline && (
            <div
              className="dev-student-card active"
              style={{ borderColor: '#06b6d4', background: 'rgba(6,182,212,0.06)' }}
            >
              <div className="dev-student-name">🔬 My Profile</div>
              <div className="dev-student-meta">{myPipeline.student?.branch} · CGPA {myPipeline.student?.cgpa}</div>
              <div className="dev-student-skills">
                {(myPipeline.student?.skills || []).slice(0, 4).map(s => (
                  <span key={s} className="dev-skill-mini">{s}</span>
                ))}
              </div>
            </div>
          )}

          {(allData || []).map((item, i) => {
            const top = item.pipeline?.step6_output?.top_5?.[0];
            const skills = item.student?.skills || [];
            return (
              <div
                key={i}
                className={`dev-student-card ${selected === i ? 'active' : ''}`}
                onClick={() => { setSelected(i); setMyPipeline(null); }}
                id={`student-card-${i}`}
              >
                <div className="dev-student-name">{item.student?.name}</div>
                <div className="dev-student-meta">{item.student?.branch} · CGPA {item.student?.cgpa}</div>
                <div className="dev-student-skills">
                  {skills.slice(0, 4).map(s => <span key={s} className="dev-skill-mini">{s}</span>)}
                  {skills.length > 4 && <span className="dev-skill-mini">+{skills.length - 4} more</span>}
                </div>
                {top && (
                  <div className="dev-prediction-badge">🏆 {top.label}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Right Panel ── */}
        <div className="dev-right">
          {!pipeline ? (
            <div className="loading-page" style={{ height: '100%', minHeight: 400 }}>
              <div className="spinner" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="dev-right-header">
                <div className="dev-right-title">
                  ML Pipeline — {studentInfo?.name}
                </div>
              </div>

              {/* Summary Strip */}
              <div className="dev-summary-strip">
                <div className="dev-summary-item">
                  <span className="dev-summary-label">Skills</span>
                  <span className="dev-summary-value">{studentInfo?.skills?.length}</span>
                </div>
                <div className="dev-summary-item">
                  <span className="dev-summary-label">Profile Text</span>
                  <span className="dev-summary-value">{profileText.length} chars</span>
                </div>
                <div className="dev-summary-item">
                  <span className="dev-summary-label">Embedding</span>
                  <span className="dev-summary-value">{pipeline.step3_embedding.embedding_dim}-dim</span>
                </div>
                <div className="dev-summary-item">
                  <span className="dev-summary-label">Model</span>
                  <span className="dev-summary-value">{classifierType}</span>
                </div>
                <div className="dev-summary-item">
                  <span className="dev-summary-label">Top Result</span>
                  <span className="dev-summary-value" style={{ color: '#f59e0b' }}>
                    {top5[0]?.label} ({Math.round((top5[0]?.confidence || 0) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Pipeline Steps */}
              <div className="pipeline-timeline">

                {/* Step 1 */}
                <PipelineStep num="1"
                  label={pipeline.step1_raw_input.label}
                  desc={pipeline.step1_raw_input.description}
                >
                  <div className="code-block">
                    {JSON.stringify(pipeline.step1_raw_input.data, null, 2)}
                  </div>
                </PipelineStep>

                {/* Step 2 */}
                <PipelineStep num="2"
                  label={pipeline.step2_profile_text.label}
                  desc={pipeline.step2_profile_text.description}
                >
                  <div className="template-text">{pipeline.step2_profile_text.template}</div>
                  <div className="profile-text-output">"{pipeline.step2_profile_text.output}"</div>
                  <div className="step-callout">
                    ⚠️ This is the <strong>ONLY</strong> thing the model reads. No raw numbers, no arrays — just this sentence.
                  </div>
                </PipelineStep>

                {/* Step 3 */}
                <PipelineStep num="3"
                  label={pipeline.step3_embedding.label}
                  desc={pipeline.step3_embedding.description}
                >
                  <div className="embed-model-badge">
                    🤖 {pipeline.step3_embedding.model_used} · {pipeline.step3_embedding.embedding_dim}-dim output
                  </div>
                  <div className="chart-title">First 8 embedding dimensions (positive=blue, negative=red)</div>
                  <EmbedChart values={embedPreview} />
                  <div className="embed-preview-array">
                    [{embedPreview.map(v => v.toFixed(3)).join(', ')}, … {pipeline.step3_embedding.embedding_dim - 8} more values]
                  </div>
                  <div className="step-note">💡 {pipeline.step3_embedding.note}</div>
                </PipelineStep>

                {/* Step 4 */}
                <PipelineStep num="4"
                  label={pipeline.step4_classifier.label}
                  desc={pipeline.step4_classifier.description}
                >
                  <div className="classifier-badge">
                    🧠 Classifier: {classifierType}
                  </div>
                  <div className="chart-title">Raw logit scores (before softmax) — positive=blue, negative=red</div>
                  <HorizChart data={rawScoresChart} colorMode="sign" />
                </PipelineStep>

                {/* Step 5 */}
                <PipelineStep num="5"
                  label={pipeline.step5_softmax.label}
                  desc={pipeline.step5_softmax.description}
                >
                  <div className="chart-title">Softmax probabilities — sorted descending (top prediction in gold)</div>
                  <HorizChart data={probsChart} colorMode="rank" />
                  <div className="chart-note">
                    ✓ All bars sum to {(pipeline.step5_softmax.sum_check * 100).toFixed(0)}%
                  </div>
                </PipelineStep>

                {/* Step 6 */}
                <PipelineStep num="6"
                  label={pipeline.step6_output.label}
                  desc={pipeline.step6_output.description}
                >
                  <div className="dev-top5">
                    {top5.map((p) => {
                      const pct = Math.round(p.confidence * 100);
                      return (
                        <div key={p.rank} className={`dev-pred-card ${p.rank === 1 ? 'top' : ''}`}>
                          <div className={`dev-pred-rank ${p.rank === 1 ? 'r1' : ''}`}>{p.rank}</div>
                          <div className="dev-pred-info">
                            <div className="dev-pred-label">{p.label}</div>
                            <div className="dev-pred-bar-bg">
                              <div className="dev-pred-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="dev-pred-pct">{pct}%</div>
                          {p.rank === 1 && <span className="dev-pred-check">✅</span>}
                        </div>
                      );
                    })}
                  </div>
                </PipelineStep>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
