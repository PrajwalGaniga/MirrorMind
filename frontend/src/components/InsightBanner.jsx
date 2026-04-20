export default function InsightBanner({ insight }) {
  if (!insight) return null;
  return (
    <div className="insight-banner">
      <div className="insight-icon">💡</div>
      <div className="insight-content">
        <div className="insight-title">Career Insight</div>
        <div className="insight-text">{insight}</div>
      </div>
    </div>
  );
}
