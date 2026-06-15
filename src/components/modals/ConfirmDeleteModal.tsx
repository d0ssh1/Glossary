import { useApp, useApi } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function ConfirmDeleteModal() {
  const { state, dispatch } = useApp();
  const { apiDeleteTerm, apiDeleteCourse, apiDeleteGlossary } = useApi();
  const { modalData } = state;
  const linkCount = (modalData?.linkCount as number) || 0;
  const courseId = modalData?.courseId as string | undefined;
  const courseName = (modalData?.courseName as string | undefined) || 'курс';
  const glossaryId = modalData?.glossaryId as string | undefined;
  const glossaryName = (modalData?.glossaryName as string | undefined) || 'глоссарий';

  const handleConfirm = async () => {
    if (courseId) {
      await apiDeleteCourse(courseId);
    } else if (glossaryId) {
      await apiDeleteGlossary(glossaryId);
    } else {
      const termId = modalData?.termId as string | undefined;
      if (termId) await apiDeleteTerm(termId);
    }
    dispatch({ type: 'CLOSE_MODAL' });
  };

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-3 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Вы уверены?</h3>
      <p className="mb-5 text-sm" style={{ color: 'var(--lw-text-secondary)' }}>
        {courseId
          ? `Это удалит курс «${courseName}» со всеми глоссариями, терминами и связями. Действие необратимо.`
          : glossaryId
          ? `Это удалит глоссарий «${glossaryName}» со всеми его терминами и связями. Действие необратимо.`
          : `Это удалит термин и все его ${linkCount} связей на графе`}
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          className="flex-1 rounded py-2 text-sm font-medium transition-all duration-200"
          style={{ backgroundColor: 'var(--lw-error)', color: '#fff' }}
        >
          Да
        </button>
        <button
          onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
          className="flex-1 rounded py-2 text-sm font-medium transition-all duration-200"
          style={{ backgroundColor: 'var(--lw-success)', color: '#fff' }}
        >
          Нет
        </button>
      </div>
    </div>
  );
}
