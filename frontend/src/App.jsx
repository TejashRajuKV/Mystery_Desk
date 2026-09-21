import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import CaseEntry from './pages/CaseEntry/CaseEntry.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import EvidenceRoom from './pages/EvidenceRoom/EvidenceRoom.jsx';
import Suspects from './pages/Suspects/Suspects.jsx';
import Timeline from './pages/Timeline/Timeline.jsx';
import InvestigationBoard from './pages/InvestigationBoard/InvestigationBoard.jsx';
import Assistant from './pages/Assistant/Assistant.jsx';
import FinalReport from './pages/FinalReport/FinalReport.jsx';
import { CaseProvider } from './hooks/useCase.jsx';

export default function App() {
  return (
    <CaseProvider>
      <Routes>
        <Route path="/" element={<CaseEntry />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/evidence" element={<EvidenceRoom />} />
          <Route path="/suspects" element={<Suspects />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/board" element={<InvestigationBoard />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/report" element={<FinalReport />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CaseProvider>
  );
}
