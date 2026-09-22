import { useCase } from '../../hooks/useCase.jsx';
import { CASE_ID } from '../../services/api.js';
import { Stamp, SoundToggle } from '../ui/ui.jsx';
import ProgressIndicator from '../ProgressIndicator/ProgressIndicator.jsx';
import './CaseHeader.css';

export default function CaseHeader() {
  const { caseInfo, progress } = useCase();
  return (
    <header className="case-header">
      <Stamp variant="alert">CASE #{caseInfo?.id ?? CASE_ID}</Stamp>
      <h2 className="t-h2 case-header__title">{caseInfo?.title}</h2>
      <span className="case-header__spacer" />
      {caseInfo && <Stamp className="case-header__class">{caseInfo.classification}</Stamp>}
      <ProgressIndicator value={progress.percent} />
      <SoundToggle className="case-header__sound" />
    </header>
  );
}
