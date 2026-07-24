import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

export default function PrimaryRoleCard({ prediction }) {
  if (!prediction) return null;
  const pct = Math.round(prediction.confidence * 100);
  const data = [{ value: pct }];

  return (
    <div className="primary-role-card">
      <div className="primary-role-label">🏆 Top Career Match</div>
      <div className="primary-role-name">{prediction.label}</div>
      <div className="primary-role-subtitle">Based on your skills, experience & academic profile</div>
      <div className="primary-role-gauge">
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <RadialBarChart
            width={200} height={200}
            cx={100} cy={100}
            innerRadius={65} outerRadius={90}
            startAngle={90} endAngle={-270}
            data={data}
            barSize={18}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: 'rgba(0,0,0,0.06)' }}
              dataKey="value"
              angleAxisId={0}
              fill="#111111"
              cornerRadius={8}
            />
          </RadialBarChart>
          <div className="conf-pct-center">
            <div className="conf-pct-number">{pct}%</div>
            <div className="conf-pct-label">Confidence</div>
          </div>
        </div>
      </div>
    </div>
  );
}
