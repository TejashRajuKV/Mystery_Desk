import { Outlet } from 'react-router-dom';
import { useCase } from '../../hooks/useCase.jsx';
import CommandBar from '../CommandBar/CommandBar.jsx';
import { Loading, ErrorState } from '../ui/ui.jsx';
import './Layout.css';

export default function Layout() {
  const { status, error, reload } = useCase();
  return (
    <div className="shell">
      <CommandBar />
      <main className="shell__content">
        {status === 'loading' && <Loading />}
        {status === 'error' && <ErrorState error={error} onRetry={reload} />}
        {status === 'ready' && <Outlet />}
      </main>
    </div>
  );
}
