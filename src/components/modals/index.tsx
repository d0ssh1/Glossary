// ============================================================
// MODALS — Root dispatcher
// ============================================================
import { useApp } from '@/store/AppContext';
import AddCourseModal from './AddCourseModal';
import CreateGlossaryModal from './CreateGlossaryModal';
import ConnectionSettingsModal from './ConnectionSettingsModal';
import SyncProcessModal from './SyncProcessModal';
import SyncReportModal from './SyncReportModal';
import ExportSettingsModal from './ExportSettingsModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import UnsavedChangesModal from './UnsavedChangesModal';
import OccurrencesModal from './OccurrencesModal';
import RenameModal from './RenameModal';

export default function Modals() {
  const { state } = useApp();
  const { modal } = state;

  if (!modal) return null;

  const isWide = modal === 'occurrences';

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`w-full overflow-hidden rounded border shadow-lg ${isWide ? 'max-w-2xl' : 'max-w-md'}`}
        style={{
          backgroundColor: 'var(--lw-bg-panel)',
          borderColor: 'var(--lw-border-primary)',
          animation: 'modalIn 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        {modal === 'add-course' && <AddCourseModal />}
        {modal === 'create-glossary' && <CreateGlossaryModal />}
        {modal === 'connection-settings' && <ConnectionSettingsModal />}
        {modal === 'sync-process' && <SyncProcessModal />}
        {modal === 'sync-report' && <SyncReportModal />}
        {modal === 'export-settings' && <ExportSettingsModal />}
        {modal === 'confirm-delete' && <ConfirmDeleteModal />}
        {modal === 'unsaved-changes' && <UnsavedChangesModal />}
        {modal === 'occurrences' && <OccurrencesModal />}
        {modal === 'rename' && <RenameModal />}
      </div>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
