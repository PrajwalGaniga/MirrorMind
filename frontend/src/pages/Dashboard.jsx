import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowUpRight,
  Mic,
  FolderGit2,
  BrainCircuit,
  Calendar,
  Briefcase,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  FileText,
  Activity,
  Layers,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useNova } from '../context/NovaContext';
import api from '../api/axios';
import NovaAvatar3D from '../components/NovaAvatar3D';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [error, setError] = useState('');
  const { openNova, handsFree, toggleHandsFree, assistantState, wakeStatus } = useNova();
  const navigate = useNavigate();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/students/profile');
      setProfile(data);
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/onboarding');
      } else {
        setError(err.response?.data?.detail || 'Failed to load profile.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Auto-refresh profile when Nova performs a voice tool action (project added, profile updated)
  useEffect(() => {
    const handleVoiceUpdate = () => {
      console.log('[DASHBOARD] Detected Nova voice update event. Refreshing dashboard data...');
      fetchProfile();
    };

    window.addEventListener('mirrormind:project-added', handleVoiceUpdate);
    window.addEventListener('mirrormind:internship-added', handleVoiceUpdate);
    window.addEventListener('mirrormind:profile-updated', handleVoiceUpdate);

    return () => {
      window.removeEventListener('mirrormind:project-added', handleVoiceUpdate);
      window.removeEventListener('mirrormind:internship-added', handleVoiceUpdate);
      window.removeEventListener('mirrormind:profile-updated', handleVoiceUpdate);
    };
  }, [fetchProfile]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.name ? profile.name.split(' ')[0] : (user?.name?.split(' ')[0] || 'Student');

  // Prediction data formatting for Recharts bar chart
  const predictions = profile?.predictions || [];
  const topRole = predictions.length > 0 ? predictions[0].label : 'Full Stack Developer';
  const topConfidence = predictions.length > 0 ? Math.round(predictions[0].confidence * 100) : 100;

  const barChartData = predictions.length > 0
    ? predictions.slice(0, 5).map((p, idx) => ({
        name: ['FS', 'BE', 'FE', 'Data', 'PM'][idx] || p.label.slice(0, 4),
        fullName: p.label,
        confidence: Math.round(p.confidence * 100) || (idx === 0 ? 100 : 0),
      }))
    : [
        { name: 'FS', fullName: 'Full Stack Developer', confidence: 100 },
        { name: 'BE', fullName: 'Backend Developer', confidence: 25 },
        { name: 'FE', fullName: 'Frontend Developer', confidence: 15 },
        { name: 'Data', fullName: 'Data Engineer', confidence: 10 },
        { name: 'PM', fullName: 'Product Manager', confidence: 5 },
      ];

  // Projects list
  const projectsList = (profile?.projects || []).slice(0, 4);

  // Readiness Donut Data
  const readinessDonutData = [
    { name: 'Completed', value: 74, color: '#2563EB' },
    { name: 'In Progress', value: 18, color: '#93C5FD' },
    { name: 'Pending', value: 8, color: '#E2E8F0' },
  ];

  if (loading) {
    return (
      <div className="nova-loading-state">
        <div className="nova-spinner" />
        <div className="nova-loading-text">Preparing your career command center...</div>
      </div>
    );
  }

  return (
    <div className="nova-dashboard">
      {/* ── Top Header Section ────────────────────────────────────────── */}
      <div className="nova-dashboard-header">
        <div className="nova-greeting-col">
          <h1 className="nova-greeting-title">
            {getGreeting()}, {displayName}!
          </h1>
          <p className="nova-greeting-subtitle">
            Here's an overview of your career readiness and interview intelligence today.
          </p>

          {/* Horizontal KPI Pills */}
          <div className="nova-kpi-row">
            <div className="nova-kpi-pill">
              <span className="nova-kpi-pill-badge blue">82%</span>
              <span className="nova-kpi-pill-label">Career Readiness</span>
              <span className="nova-trend-badge">↑ +8%</span>
            </div>
            <div className="nova-kpi-pill">
              <span className="nova-kpi-pill-badge">
                {profile?.projects?.length || profile?.projects_count || 4}
              </span>
              <span className="nova-kpi-pill-label">Projects</span>
            </div>
            <div className="nova-kpi-pill">
              <span className="nova-kpi-pill-badge">
                {profile?.skills?.length || 21}
              </span>
              <span className="nova-kpi-pill-label">Skills</span>
            </div>
            <div className="nova-kpi-pill">
              <span className="nova-kpi-pill-badge green">
                {profile?.cgpa || '9.0'}
              </span>
              <span className="nova-kpi-pill-label">CGPA</span>
            </div>
          </div>
        </div>

        {/* Right Metric Quick Counters */}
        <div className="nova-metric-counters">
          <div className="nova-counter-block">
            <div className="nova-counter-num">{profile?.projects?.length || 7}</div>
            <div className="nova-counter-lbl">Active Projects</div>
          </div>
          <div className="nova-counter-divider" />
          <div className="nova-counter-block">
            <div className="nova-counter-num">12</div>
            <div className="nova-counter-lbl">Mock Interviews</div>
          </div>
          <div className="nova-counter-divider" />
          <div className="nova-counter-block">
            <div className="nova-counter-num primary-color">100%</div>
            <div className="nova-counter-lbl">Target Match</div>
          </div>
        </div>
      </div>

      {/* ── 3-Column Velora-Style Main Grid ───────────────────────────── */}
      <div className="nova-main-grid">
        {/* ── Column 1: Left (Nova Hero + Quick Access) ───────────────── */}
        <div className="nova-grid-col col-left">
          {/* Nova 3D AI Assistant Hero Card */}
          <div className="nova-assistant-hero-card">
            <div className="nova-card-top-tag">
              <Sparkles size={13} color="#2563EB" />
              <span>AI Career Co-Pilot</span>
            </div>

            <div className="nova-avatar-display" onClick={() => openNova()} title="Click to open Nova">
              <NovaAvatar3D state={assistantState} size={170} />
            </div>

            <div className="nova-hero-card-meta">
              <h3 className="nova-hero-assistant-name">Nova</h3>
              <p className="nova-hero-assistant-desc">
                Your living career co-pilot & mentor. Always ready to practice technical questions or automate portfolio updates.
              </p>
              <div className="nova-hero-action-row">
                <button className="nova-talk-btn" onClick={() => openNova()}>
                  <span>Talk to Nova</span>
                  <ArrowUpRight size={16} />
                </button>
                <div
                  className="nova-hero-online-status"
                  onClick={toggleHandsFree}
                  style={{ cursor: 'pointer' }}
                  title="Click to toggle 'Hey Nova' hands-free listening"
                >
                  <span
                    className="pulse-green-dot"
                    style={{
                      backgroundColor:
                        wakeStatus === 'DETECTED'
                          ? '#2563EB'
                          : handsFree
                          ? '#10B981'
                          : '#94A3B8',
                    }}
                  />
                  <span>{wakeStatus === 'DETECTED' ? 'Wake Heard!' : handsFree ? 'Wake: "Hey Nova"' : 'Wake: OFF'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access Card */}
          <div className="nova-card nova-quick-access-card">
            <h4 className="nova-card-heading">Quick Access</h4>
            <div className="nova-quick-access-list">
              <div
                className="nova-quick-item"
                onClick={() => navigate('/interview')}
              >
                <div className="nova-quick-icon-box blue">
                  <Mic size={17} />
                </div>
                <div className="nova-quick-text">
                  <div className="nova-quick-title">Live AI Interview</div>
                  <div className="nova-quick-desc">Practice with Alex</div>
                </div>
                <ChevronRight size={16} className="nova-quick-arrow" />
              </div>

              <div
                className="nova-quick-item"
                onClick={() => navigate('/predict')}
              >
                <div className="nova-quick-icon-box purple">
                  <BrainCircuit size={17} />
                </div>
                <div className="nova-quick-text">
                  <div className="nova-quick-title">Career Predictions</div>
                  <div className="nova-quick-desc">ML Neural Network Model</div>
                </div>
                <ChevronRight size={16} className="nova-quick-arrow" />
              </div>

              <div
                className="nova-quick-item"
                onClick={() => navigate('/projects')}
              >
                <div className="nova-quick-icon-box mint">
                  <FolderGit2 size={17} />
                </div>
                <div className="nova-quick-text">
                  <div className="nova-quick-title">Portfolio Projects</div>
                  <div className="nova-quick-desc">{profile?.projects?.length || 4} verified items</div>
                </div>
                <ChevronRight size={16} className="nova-quick-arrow" />
              </div>

              <div
                className="nova-quick-item"
                onClick={() => navigate('/internships')}
              >
                <div className="nova-quick-icon-box amber">
                  <Briefcase size={17} />
                </div>
                <div className="nova-quick-text">
                  <div className="nova-quick-title">Internships & Work</div>
                  <div className="nova-quick-desc">Experience records</div>
                </div>
                <ChevronRight size={16} className="nova-quick-arrow" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Center (Prediction Overview + Projects Table) ─── */}
        <div className="nova-grid-col col-center">
          {/* Career Predictions Chart Card */}
          <div className="nova-card">
            <div className="nova-card-header-flex">
              <div>
                <h4 className="nova-card-heading">Career Prediction Overview</h4>
                <div className="nova-card-stat-large">
                  {topConfidence}% <span className="nova-stat-sublabel">{topRole}</span>
                </div>
                <div className="nova-stat-trend">
                  <TrendingUp size={13} />
                  <span>+12.6% vs previous profile assessment</span>
                </div>
              </div>
              <button
                className="nova-icon-action-btn"
                onClick={() => navigate('/predict')}
                title="View full predictions"
              >
                <ArrowUpRight size={18} />
              </button>
            </div>

            {/* Bar Chart */}
            <div style={{ width: '100%', height: 160, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} barSize={22} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(238, 242, 246, 0.6)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="nova-chart-tooltip">
                            <div className="tt-title">{payload[0].payload.fullName}</div>
                            <div className="tt-val">{payload[0].value}% confidence</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="confidence"
                    radius={[6, 6, 0, 0]}
                    fill="#2563EB"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Projects Overview List / Table */}
          <div className="nova-card nova-projects-overview-card">
            <div className="nova-card-header-flex">
              <h4 className="nova-card-heading">Projects Overview</h4>
              <button
                className="nova-link-btn"
                onClick={() => navigate('/projects')}
              >
                View All
              </button>
            </div>

            <div className="nova-projects-table">
              {projectsList.length > 0 ? (
                projectsList.map((p, idx) => {
                  const techList = p.tech_stack || [];
                  const progressPct = [85, 60, 100, 75][idx % 4];
                  const statusLabel = progressPct === 100 ? 'Completed' : 'In Progress';
                  const statusClass = progressPct === 100 ? 'status-completed' : 'status-progress';

                  return (
                    <div key={idx} className="nova-project-row">
                      <div className="nova-proj-info">
                        <div className="nova-proj-icon">
                          <FolderGit2 size={16} color="#2563EB" />
                        </div>
                        <div>
                          <div className="nova-proj-title">{p.title}</div>
                          <div className="nova-proj-tech">
                            {techList.slice(0, 3).join(', ') || 'Python, React'}
                          </div>
                        </div>
                      </div>

                      <div className="nova-proj-progress-col">
                        <div className="nova-proj-progress-bar">
                          <div
                            className="nova-proj-progress-fill"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="nova-proj-pct">{progressPct}%</span>
                      </div>

                      <div className="nova-proj-date">
                        {p.semester ? `Sem ${p.semester}` : '2026'}
                      </div>

                      <div className="nova-proj-status">
                        <span className={`nova-status-badge ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="nova-empty-projects">
                  <p>No projects recorded yet.</p>
                  <button className="nova-outline-btn" onClick={() => navigate('/projects')}>
                    + Add First Project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Column 3: Right (Upcoming Tasks + Readiness Donut) ───────── */}
        <div className="nova-grid-col col-right">
          {/* Upcoming Tasks Card */}
          <div className="nova-card nova-tasks-card">
            <div className="nova-card-header-flex">
              <h4 className="nova-card-heading">Upcoming Tasks</h4>
              <span className="nova-sub-caption">Prioritized</span>
            </div>

            <div className="nova-tasks-list">
              <div className="nova-task-item" onClick={() => navigate('/interview')}>
                <div className="nova-task-icon-box blue">
                  <Mic size={15} />
                </div>
                <div className="nova-task-details">
                  <div className="nova-task-title">Mock Interview with Alex</div>
                  <div className="nova-task-meta">Today · Full Stack Role</div>
                </div>
                <span className="nova-priority-pill high">High</span>
              </div>

              <div className="nova-task-item" onClick={() => navigate('/projects')}>
                <div className="nova-task-icon-box cyan">
                  <Layers size={15} />
                </div>
                <div className="nova-task-details">
                  <div className="nova-task-title">Add System Architecture to Resume</div>
                  <div className="nova-task-meta">Skills Gap Analysis</div>
                </div>
                <span className="nova-priority-pill medium">Medium</span>
              </div>

              <div className="nova-task-item" onClick={() => navigate('/predict')}>
                <div className="nova-task-icon-box purple">
                  <Activity size={15} />
                </div>
                <div className="nova-task-details">
                  <div className="nova-task-title">Review Prediction Report</div>
                  <div className="nova-task-meta">Updated Softmax Weights</div>
                </div>
                <span className="nova-priority-pill high">High</span>
              </div>

              <div className="nova-task-item" onClick={openNova}>
                <div className="nova-task-icon-box green">
                  <Sparkles size={15} />
                </div>
                <div className="nova-task-details">
                  <div className="nova-task-title">Weekly Career Co-Pilot Sync</div>
                  <div className="nova-task-meta">Hands-Free with Nova</div>
                </div>
                <span className="nova-priority-pill low">Low</span>
              </div>
            </div>
          </div>

          {/* Interview Readiness Donut Card */}
          <div className="nova-card nova-donut-card">
            <div className="nova-card-header-flex">
              <h4 className="nova-card-heading">Interview Readiness</h4>
              <span className="nova-sub-caption">Overall</span>
            </div>

            <div className="nova-donut-wrapper">
              <div className="nova-donut-chart-box">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={readinessDonutData}
                      dataKey="value"
                      innerRadius={38}
                      outerRadius={54}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {readinessDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="nova-donut-center-text">
                  <span className="donut-num">74%</span>
                  <span className="donut-label">Ready</span>
                </div>
              </div>

              <div className="nova-donut-legend">
                <div className="nova-legend-item">
                  <span className="legend-dot blue" />
                  <span className="legend-name">Completed</span>
                  <span className="legend-pct">74%</span>
                </div>
                <div className="nova-legend-item">
                  <span className="legend-dot light-blue" />
                  <span className="legend-name">In Progress</span>
                  <span className="legend-pct">18%</span>
                </div>
                <div className="nova-legend-item">
                  <span className="legend-dot gray" />
                  <span className="legend-name">Pending</span>
                  <span className="legend-pct">8%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
