// ============================================================
// SCREEN 2 — Editor (Main Workspace)
//
// Layout strategy:
// - Desktop (>= MOBILE_BREAKPOINT): side panels are resizable rails next to canvas.
// - Mobile (< MOBILE_BREAKPOINT): panels become full-height drawers overlaying canvas,
//   only one open at a time, dismissible by tap on backdrop.
// ============================================================
import { useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MOBILE_BREAKPOINT, PANEL_WIDTH } from '@/lib/constants';
import Toolbar from './Toolbar';
import LeftPanel from './left-panel';
import RightPanel from './right-panel';
import D3Graph from './D3Graph';

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

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: 'var(--lw-bg-primary)' }}>
      <Toolbar />

      <div className="relative flex flex-1 overflow-hidden">
        {/* ---------- Desktop layout ---------- */}
        {!isMobile && (
          <>
            <div
              className="shrink-0 overflow-hidden transition-all duration-300"
              style={{
                width: leftPanelOpen ? PANEL_WIDTH.left : 0,
                opacity: leftPanelOpen ? 1 : 0,
              }}
            >
              {leftPanelOpen && (
                <div style={{ width: PANEL_WIDTH.left, height: '100%' }}>
                  <LeftPanel />
                </div>
              )}
            </div>

            <div className="relative min-w-0 flex-1">
              <D3Graph />
            </div>

            <div
              className="shrink-0 overflow-hidden transition-all duration-300"
              style={{
                width: rightPanelOpen ? PANEL_WIDTH.right : 0,
                opacity: rightPanelOpen ? 1 : 0,
              }}
            >
              {rightPanelOpen && (
                <div style={{ width: PANEL_WIDTH.right, height: '100%' }}>
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
              <D3Graph />
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
