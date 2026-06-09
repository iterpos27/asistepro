export default function MetricCard({ label, value, icon: Icon, tone = 'primary', detail }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={22} />
      </div>
      <div className="metric-body">
        <p>{label}</p>
        <strong>{value}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}
