export default function PredictionCards({ predictions }) {
  if (!predictions?.length) return null;

  return (
    <div>
      <div className="section-title">Top 5 Career Predictions</div>
      <div className="prediction-list">
        {predictions.map((p) => {
          const pct = Math.round(p.confidence * 100);
          return (
            <div key={p.rank} className="pred-card">
              <div className={`pred-rank rank-${p.rank}`}>{p.rank}</div>
              <div className="pred-info">
                <div className="pred-role">{p.label}</div>
                <div className="pred-bar-bg">
                  <div className="pred-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="pred-pct">{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
