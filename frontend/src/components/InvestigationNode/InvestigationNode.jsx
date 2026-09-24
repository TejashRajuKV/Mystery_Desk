import './InvestigationNode.css';

const KIND_LABEL = { evidence: 'EVIDENCE', suspect: 'SUSPECT', location: 'LOCATION', event: 'EVENT', statement: 'STATEMENT' };

/** Pinned card. Evidence is paper; suspects are outlined in white. Used on the board and inline in assistant answers. */
export default function InvestigationNode({ kind, id, title, selected, dragging, className = '', style, as: Tag = 'div', ...rest }) {
  const cls = ['inode', `inode--${kind}`, selected && 'inode--selected', dragging && 'inode--dragging', className]
    .filter(Boolean).join(' ');
  return (
    <Tag className={cls} style={style} {...rest}>
      <span className="inode__pin" aria-hidden="true" />
      <span className="inode__head t-label">
        <span>{id}</span>
        <span className="inode__kind">{KIND_LABEL[kind]}</span>
      </span>
      <span className="t-h3 inode__title">{title}</span>
    </Tag>
  );
}
