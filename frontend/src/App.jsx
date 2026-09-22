import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import EvidenceRoom from './pages/EvidenceRoom/EvidenceRoom.jsx';
import Suspects from './pages/Suspects/Suspects.jsx';
import Timeline from './pages/Timeline/Timeline.jsx';
import InvestigationBoard from './pages/InvestigationBoard/InvestigationBoard.jsx';
import Assistant from './pages/Assistant/Assistant.jsx';
import FinalReport from './pages/FinalReport/FinalReport.jsx';
import { CaseProvider } from './hooks/useCase.jsx';
import { unlockAudio } from './utils/sound.js';

// The 3D/scroll stack (three, @react-three/fiber, gsap) is real bundle weight — only the
// landing page needs it, so it's a separate chunk the rest of the app never downloads.
const LandingPage = lazy(() => import('./pages/LandingPage/LandingPage.jsx'));

export default function App() {
  // Browsers require a user gesture before audio can play; this catches the first one,
  // wherever it happens, so ambience and SFX are ready without a dedicated "start" click.
  useEffect(() => {
    const unlock = () => unlockAudio();
    const opts = { once: true, passive: true };
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    window.addEventListener('wheel', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
      window.removeEventListener('wheel', unlock, opts);
    };
  }, []);

  return (
    <CaseProvider>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<div style={{ background: '#050403', minHeight: '100vh' }} />}>
              <LandingPage />
            </Suspense>
          }
        />
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
