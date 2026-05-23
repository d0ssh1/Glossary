// ============================================================
// APP — Lexicon Weaver
// ============================================================
import { AppProvider, useApp } from '@/store/AppContext';
import Dashboard from '@/components/Dashboard';
import Editor from '@/components/Editor';
import Modals from '@/components/modals';

function AppContent() {
  const { state } = useApp();

  return (
    <>
      {state.screen === 'dashboard' ? <Dashboard /> : <Editor />}
      <Modals />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
