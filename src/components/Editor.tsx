// ============================================================
// SCREEN 2 — Editor (Main Workspace)
//
// Layout strategy:
// - Desktop (>= MOBILE_BREAKPOINT): side panels are resizable rails next to canvas.
// - Mobile (< MOBILE_BREAKPOINT): panels become full-height drawers overlaying canvas,
//   only one open at a time, dismissible by tap on backdrop.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MOBILE_BREAKPOINT, PANEL_WIDTH, PANEL_MIN, PANEL_MAX } from '@/lib/constants';
import Toolbar from './Toolbar';
import LeftPanel from './left-panel';
import RightPanel from './right-panel';
import VisGraph from './VisGraph';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function loadWidth(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return Number(raw) || fallback;
  } catch { /* ignore */ }
  return fallback;
}

export default function Editor() {
  const { state, dispatch } = useApp();
  const { leftPanelOpen, rightPanelOpen } = state;
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const closedOnMobile = useRef(false);

  // On first switch to mobile, collapse both drawers so the canvas is visible.
  useEffect(() => {
    if (isMobile && !closedOnMobile.current) {
      closedOnMobile.current = true;
      if (leftPanelOpen) dispatch({ type: 'TOGGLE_LEFT_PANEL' });
      if (rightPanelOpen) dispatch({ type: 'TOGGLE_RIGHT_PANEL' });
    }
    if (!isMobile) closedOnMobile.current = false;
  }, [isMobile, leftPanelOpen, rightPanelOpen, dispatch]);

  // Mobile mutex: only one drawer can be open at a time.
  const prevLeft = useRef(leftPanelOpen);
  const prevRight = useRef(rightPanelOpen);
  useEffect(() => {
    if (!isMobile) {
      prevLeft.current = leftPanelOpen;
      prevRight.current = rightPanelOpen;
      return;
    }
    // Left just opened → close right.
    if (leftPanelOpen && !prevLeft.current && rightPanelOpen) {
      dispatch({ type: 'TOGGLE_RIGHT_PANEL' });
    }
    // Right just opened → close left.
    if (rightPanelOpen && !prevRight.current && leftPanelOpen) {
      dispatch({ type: 'TOGGLE_LEFT_PANEL' });
    }
    prevLeft.current = leftPanelOpen;
    prevRight.current = rightPanelOpen;
  }, [isMobile, leftPanelOpen, rightPanelOpen, dispatch]);

  const closeLeft = () => leftPanelOpen && dispatch({ type: 'TOGGLE_LEFT_PANEL' });
  const closeRight = () => rightPanelOpen && dispatch({ type: 'TOGGLE_RIGHT_PANEL' });

  // ---- Resizable side panels (desktop only) -------------------------------
  // Drag the divider between a panel and the canvas to widen/narrow it. Widths
  // persist across sessions; vis-network is nudged with a resize event so the
  // canvas keeps filling the space mid-drag.
  const [leftWidth, setLeftWidth] = useState(() => loadWidth('lw:leftPanelW', PANEL_WIDTH.left));
  const [rightWidth, setRightWidth] = useState(() => loadWidth('lw:rightPanelW', PANEL_WIDTH.right));
  const [dragging, setDragging] = useState<null | 'left' | 'right'>(null);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (dragging === 'left') {
        setLeftWidth(clamp(e.clientX, PANEL_MIN.left, PANEL_MAX.left));
      } else {
        setRightWidth(clamp(window.innerWidth - e.clientX, PANEL_MIN.right, PANEL_MAX.right));
      }
      // Keep the vis-network canvas in step with the shrinking/growing column.
      window.dispatchEvent(new Event('resize'));
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging]);

  useEffect(() => { try { localStorage.setItem('lw:leftPanelW', String(leftWidth)); } catch { /* ignore */ } }, [leftWidth]);
  useEffect(() => { try { localStorage.setItem('lw:rightPanelW', String(rightWidth)); } catch { /* ignore */ } }, [rightWidth]);

  // A thin grabbable divider. `side` decides which width it controls.
  const ResizeHandle = ({ side }: { side: 'left' | 'right' }) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Изменить ширину левой панели' : 'Изменить ширину правой панели'}
      onMouseDown={e => { e.preventDefault(); setDragging(side); }}
      onDoubleClick={() => side === 'left' ? setLeftWidth(PANEL_WIDTH.left) : setRightWidth(PANEL_WIDTH.right)}
      className="group relative z-10 w-1.5 shrink-0 cursor-col-resize"
      style={{ backgroundColor: dragging === side ? 'var(--lw-accent-amber)' : 'var(--lw-border-primary)' }}
      title="Потяните, чтобы изменить ширину (двойной клик — сбросить)"
    >
      {/* Wider invisible hit area so the 1.5px line is easy to grab. */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: 'var(--lw-bg-primary)' }}>
      <Toolbar />

      <div className="relative flex flex-1 overflow-hidden">
        {/* ---------- Desktop layout ---------- */}
        {!isMobile && (
          <>
            <div
              className="shrink-0 overflow-hidden"
              style={{
                width: leftPanelOpen ? leftWidth : 0,
                opacity: leftPanelOpen ? 1 : 0,
                transition: dragging ? 'none' : 'width 0.3s, opacity 0.3s',
              }}
            >
              {leftPanelOpen && (
                <div style={{ width: leftWidth, height: '100%' }}>
                  <LeftPanel />
                </div>
              )}
            </div>
            {leftPanelOpen && <ResizeHandle side="left" />}

            <div className="flex-1 min-h-0 bg-[#F5F5F5] relative overflow-hidden">
              <VisGraph />
            </div>

            {rightPanelOpen && <ResizeHandle side="right" />}
            <div
              className="shrink-0 overflow-hidden"
              style={{
                width: rightPanelOpen ? rightWidth : 0,
                opacity: rightPanelOpen ? 1 : 0,
                transition: dragging ? 'none' : 'width 0.3s, opacity 0.3s',
              }}
            >
              {rightPanelOpen && (
                <div style={{ width: rightWidth, height: '100%' }}>
                  <RightPanel />
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- Mobile layout ---------- */}
        {isMobile && (
          <>
            <div className="relative h-full w-full min-w-0">
              <VisGraph />
            </div>

            {/* Backdrop for any open drawer */}
            {(leftPanelOpen || rightPanelOpen) && (
              <button
                aria-label="Закрыть панель"
                onClick={() => { closeLeft(); closeRight(); }}
                className="absolute inset-0 z-30"
                style={{
                  backgroundColor: 'rgba(26, 26, 26, 0.25)',
                  animation: 'fadeIn 0.2s ease',
                }}
              />
            )}

            {/* Left drawer */}
            <aside
              className="absolute inset-y-0 left-0 z-40 transition-transform duration-300 ease-out"
              style={{
                width: 'min(86vw, 360px)',
                transform: leftPanelOpen ? 'translateX(0)' : 'translateX(-101%)',
                boxShadow: leftPanelOpen ? '4px 0 12px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <LeftPanel />
            </aside>

            {/* Right drawer */}
            <aside
              className="absolute inset-y-0 right-0 z-40 transition-transform duration-300 ease-out"
              style={{
                width: 'min(92vw, 420px)',
                transform: rightPanelOpen ? 'translateX(0)' : 'translateX(101%)',
                boxShadow: rightPanelOpen ? '-4px 0 12px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <RightPanel />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
