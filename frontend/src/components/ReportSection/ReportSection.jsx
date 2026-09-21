import './ReportSection.css';

export default function ReportSection({ label, heading, children, className = '' }) {
  return (
    <section className={`report-section ${className}`}>
      <div className="report-section__head t-label">
        <span>{label}</span>
        <span className="report-section__class">CLASSIFIED</span>
      </div>
      <h2 className="t-h1 report-section__heading">{heading}</h2>
      <hr className="rule" />
      <div className="report-section__body t-body">{children}</div>
    </section>
  );
}
