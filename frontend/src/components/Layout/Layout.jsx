import { Outlet } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import Sidebar from '../Sidebar/Sidebar.jsx';
import CaseHeader from '../CaseHeader/CaseHeader.jsx';
import { Loading, ErrorState } from '../ui/ui.jsx';
import './Layout.css';

export default function Layout() {
  const { status, error, reload } = useCase();
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">
        <CaseHeader />
        <main className="shell__content">
          {status === 'loading' && <Loading />}
          {status === 'error' && <ErrorState error={error} onRetry={reload} />}
          {status === 'ready' && <Outlet />}
        </main>
      </div>
    </div>
  );
}
