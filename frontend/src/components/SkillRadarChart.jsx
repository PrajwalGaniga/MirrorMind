import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

const AXIS_LABELS = {
  technical_depth: 'Tech Depth',
  breadth: 'Breadth',
  project_exp: 'Projects',
  industry_exp: 'Industry',
  academic: 'Academic',
  soft_skills: 'Soft Skills',
};

export default function SkillRadarChart({ skillRadar }) {
  if (!skillRadar) return null;

  const data = Object.entries(skillRadar).map(([key, value]) => ({
    subject: AXIS_LABELS[key] || key,
    value,
    fullMark: 100,
  }));

  return (
    <div className="card">
      <div className="section-title">Skill Radar</div>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Skills"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: '#141d35', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '10px', color: '#f1f5f9', fontSize: '13px'
            }}
            formatter={(v) => [`${v}`, 'Score']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
