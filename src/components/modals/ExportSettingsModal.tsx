import { useState } from 'react';
import { useApp, useApi } from '@/store/AppContext';
import { apiEnabled } from '@/lib/api';
import { ModalClose } from './ModalShell';
import type { ScormVersion } from '@/types';

export default function ExportSettingsModal() {
  const { state, dispatch } = useApp();
  const { apiDownloadScorm } = useApi();
  const [version, setVersion] = useState<ScormVersion>('1.2');
  const [scormId, setScormId] = useState('course_sql_01');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    setDoneMsg(null);
    setBusy(true);
    try {
      let blob: Blob | null = null;
      let isRealZip = false;
      if (apiEnabled() && state.activeGlossaryId) {
        blob = await apiDownloadScorm(state.activeGlossaryId, scormId, version);
        isRealZip = true;
      }
      // The backend returns a valid SCORM zip. Mock mode produces a placeholder
      // XML so the download flow still works — but we name it .xml then to
      // avoid confusing the user with a non-functional .zip on disk.
      if (!blob) {
        blob = new Blob(
          [`<?xml version="1.0" encoding="UTF-8"?><scorm version="${version}"><course id="${scormId}"/></scorm>`],
          { type: 'application/xml' },
        );
      }
      const filename = isRealZip
        ? `${scormId}_scorm_${version}.zip`
        : `${scormId}_scorm_${version}_demo.xml`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a tick to start the download before we revoke.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDoneMsg(
        isRealZip
          ? `Файл сохранён: «${filename}» (папка «Загрузки» вашего браузера).`
          : `Демо-режим: создан XML-плейсхолдер «${filename}». Полноценный SCORM-пакет собирается только при VITE_USE_API=1.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось собрать SCORM-пакет');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-5 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Настройка экспорта</h3>
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Версия SCORM:</label>
          <div className="flex gap-4">
            {(['1.2', '2004'] as ScormVersion[]).map(v => (
              <label key={v} className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--lw-text-primary)' }}>
                <input
                  type="radio"
                  name="scorm-version"
                  checked={version === v}
                  onChange={() => setVersion(v)}
                  className="accent-[var(--lw-accent-graphite)]"
                />
                SCORM {v}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Идентификатор курса</label>
          <input
            value={scormId}
            onChange={e => setScormId(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-panel)', color: 'var(--lw-text-primary)' }}
          />
        </div>
        {error && (
          <p className="text-xs" style={{ color: 'var(--lw-error)' }}>{error}</p>
        )}
        {doneMsg && (
          <div className="rounded border p-2 text-xs leading-relaxed"
            style={{ borderColor: 'var(--lw-success)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}>
            {doneMsg}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={busy}
            className="mt-2 flex-1 rounded py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50"
            style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
          >
            {busy ? 'Сборка...' : 'Скомпилировать и скачать'}
          </button>
          {doneMsg && (
            <button
              onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
              className="mt-2 rounded border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
