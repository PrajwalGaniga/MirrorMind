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
          <PolarGrid stroke="#D8D2CE" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#111111', fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Skills"
            dataKey="value"
            stroke="#000000"
            fill="#CFF3B2"
            fillOpacity={1}
            strokeWidth={2.5}
          />
          <Tooltip
            contentStyle={{
              background: '#FFFFFF', border: '3px solid #000000',
              borderRadius: '12px', color: '#111111', fontSize: '14px', fontWeight: 700,
              boxShadow: '4px 4px 0px rgba(0,0,0,0.12)'
            }}
            formatter={(v) => [`${v}`, 'Score']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
