import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SceneProvider } from './components/Scene/Scene.jsx';
import Layout from './components/Layout/Layout.jsx';
import MainMenu from './pages/MainMenu/MainMenu.jsx';
import CaseSelect from './pages/CaseSelect/CaseSelect.jsx';
import CaseStart from './pages/CaseStart/CaseStart.jsx';
import CaseFile from './pages/CaseFile/CaseFile.jsx';
import CityMap from './pages/CityMap/CityMap.jsx';
import Place from './pages/Place/Place.jsx';
import Suspects from './pages/Suspects/Suspects.jsx';
import EvidenceRoom from './pages/EvidenceRoom/EvidenceRoom.jsx';
import Timeline from './pages/Timeline/Timeline.jsx';
import InvestigationBoard from './pages/InvestigationBoard/InvestigationBoard.jsx';
import Assistant from './pages/Assistant/Assistant.jsx';
import FinalReport from './pages/FinalReport/FinalReport.jsx';
import gsap from 'gsap';
import { unlockAudio } from './utils/sound.js';
import { keepAnimationsMoving } from './utils/motion.js';

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

  useEffect(() => keepAnimationsMoving(gsap), []);

  return (
    <SceneProvider>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/cases" element={<CaseSelect />} />
        <Route path="/case/:caseId" element={<Layout />}>
          <Route index element={<CaseStart />} />
          <Route path="file" element={<CaseFile />} />
          <Route path="map" element={<CityMap />} />
          <Route path="place/:locationId" element={<Place />} />
          <Route path="people" element={<Suspects />} />
          <Route path="evidence" element={<EvidenceRoom />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="board" element={<InvestigationBoard />} />
          <Route path="notes" element={<Assistant />} />
          <Route path="accuse" element={<FinalReport />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SceneProvider>
  );
}
