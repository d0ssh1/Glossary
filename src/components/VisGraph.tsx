// ============================================================
// VIS-NETWORK FORCE-DIRECTED GRAPH
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { useApp } from '@/store/AppContext';
import { buildGraphData } from '@/lib/graphData';
import { statusHex, linkHex } from '@/lib/constants';
import { contextKey, loadPositions, savePositions } from '@/lib/nodePositions';
import type { GraphNode, GraphLink, GraphLevel } from '@/types';

function edgeWidthFor(level: GraphLevel, d: GraphLink): number {
  const floor = level === 'terms' ? 2.5 : 2;
  return Math.max(floor, 1 + (d.weight || 1) * 0.6);
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export default function VisGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const { state, dispatch } = useApp();
  const {
    graphLevel, activeNodeId, activeLinkId,
    activeGlossaryId, activeCourseId, breadcrumbs,
    courses, hierFilterIds, graphFilters, selectedTermIds,
  } = state;

  const activeCourse = courses.find(c => c.id === activeCourseId);
  const activeGlossary = courses
    .flatMap(c => c.glossaries)
    .find(g => g.id === activeGlossaryId);
  const allTerms = activeGlossary?.terms || [];

  const drillModuleId = breadcrumbs.find(b => b.level === 'lessons')?.id;
  const drillLessonId = breadcrumbs.find(b => b.level === 'terms')?.id;

  const [linkCount, setLinkCount] = useState(0);
  const [nodeCount, setNodeCount] = useState(0);

  // ── Heavy effect: rebuild the network when data/level changes ──────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous instance to free canvas memory.
    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }

    const { nodes, links } = buildGraphData(graphLevel, {
      course: activeCourse,
      allTerms,
      drillModuleId,
      drillLessonId,
      hierFilterIds,
      filters: graphFilters,
      selectedTermIds,
    });

    setNodeCount(nodes.length);
    setLinkCount(links.length);

    const positionsKey = contextKey(graphLevel, drillModuleId, drillLessonId);
    const savedPositions = loadPositions(positionsKey);

    // Build vis-network node dataset.
    const visNodes = new DataSet(
      nodes.map((n: GraphNode) => {
        const saved = savedPositions[n.id];
        const isTerm   = n.type === 'term';
        const isCenter = n.id.startsWith('center-');
        const isActive = n.id === activeNodeId;

        const bgColor     = isCenter ? '#F6F5F2' : '#FFFFFF';
        const borderColor = isActive
          ? '#D4A056'
          : isTerm
            ? statusHex[n.status || 'no-trait']
            : isCenter ? '#D4A056' : '#E0DFDA';

        return {
          id: n.id,
          label: isTerm ? capitalize(n.name) : n.name,
          title: n.name,
          x: saved?.x,
          y: saved?.y,
          fixed: saved ? { x: true, y: true } : false,
          shape: isTerm ? 'dot' : 'box',
          size: isTerm ? 18 : undefined,
          font: {
            size: isTerm ? 11 : 13,
            face: 'Inter, sans-serif',
            color: '#1A1A1A',
            multi: true,
          },
          color: {
            background: bgColor,
            border: borderColor,
            highlight: { background: bgColor, border: '#D4A056' },
            hover:     { background: bgColor, border: '#D4A056' },
          },
          borderWidth: isActive ? 2.5 : isTerm ? 2.5 : isCenter ? 2 : 1.5,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.08)', size: 4, x: 0, y: 2 },
          _raw: n,
        };
      }),
    );

    // Build vis-network edge dataset.
    const visEdges = new DataSet(
      links.map((l: GraphLink) => {
        const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        const isActive = l.id === activeLinkId;
        const w = edgeWidthFor(graphLevel, l);

        return {
          id: l.id,
          from: srcId,
          to: tgtId,
          width: isActive ? w + 2 : w,
          color: {
            color:     isActive ? '#D4A056' : linkHex[l.type],
            highlight: '#D4A056',
            hover:     '#D4A056',
            opacity:   0.85,
          },
          smooth: { enabled: false, type: 'continuous', roundness: 0 },
          _raw: l,
        };
      }),
    );

    const options = {
      nodes: { margin: { top: 8, bottom: 8, left: 12, right: 12 }, widthConstraint: { maximum: 180 } },
      edges: { smooth: { enabled: false, type: 'continuous', roundness: 0, forceDirection: 'none' } },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: graphLevel === 'terms' ? -120 : -250,
          centralGravity: 0.015,
          springLength: graphLevel === 'terms' ? 100 : 160,
          springConstant: 0.06,
          damping: 0.4,
        },
        stabilization: { iterations: 150, updateInterval: 20 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true,
        multiselect: false,
      },
      layout: { randomSeed: 42 },
    };

    const network = new Network(
      containerRef.current,
      { nodes: visNodes, edges: visEdges },
      options,
    );
    networkRef.current = network;

    // Stop physics once stabilised, persist positions.
    network.once('stabilizationIterationsDone', () => {
      network.setOptions({ physics: { enabled: false } });
      const positions = network.getPositions();
      const current = loadPositions(positionsKey);
      nodes.forEach((n: GraphNode) => {
        if (!savedPositions[n.id]) {
          const p = positions[n.id];
          if (p) current[n.id] = { x: p.x, y: p.y };
        }
      });
      savePositions(positionsKey, current);
    });

    // Persist node position after manual drag.
    network.on('dragEnd', (params: { nodes: unknown[] }) => {
      if (params.nodes.length > 0) {
        const nid = params.nodes[0] as string;
        const pos = network.getPositions([nid])[nid];
        if (pos) {
          const current = loadPositions(positionsKey);
          current[nid] = { x: pos.x, y: pos.y };
          savePositions(positionsKey, current);
        }
      }
    });

    // Single click → select node or edge.
    network.on('click', (params: { nodes: unknown[]; edges: unknown[] }) => {
      if (params.nodes.length > 0) {
        dispatch({ type: 'SET_ACTIVE_NODE', nodeId: params.nodes[0] as string });
      } else if (params.edges.length > 0) {
        dispatch({ type: 'SET_ACTIVE_LINK', linkId: params.edges[0] as string });
      } else {
        dispatch({ type: 'SET_ACTIVE_NODE', nodeId: null });
      }
    });

    // Double click → drill down.
    network.on('doubleClick', (params: { nodes: unknown[] }) => {
      if (params.nodes.length === 0) return;
      const nid = params.nodes[0] as string;
      const nodeData = visNodes.get(nid) as ({ _raw: GraphNode } & Record<string, unknown>) | null;
      if (!nodeData?._raw) return;
      const d = nodeData._raw;
      if (graphLevel === 'modules' && d.type === 'module') {
        dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: d.name.replace('\n', ' '), level: 'lessons' });
      } else if (graphLevel === 'lessons' && d.type === 'lesson') {
        dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: d.name.replace('\n', ' '), level: 'terms' });
      }
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphLevel, activeCourse, activeGlossary, allTerms, drillModuleId, drillLessonId, hierFilterIds, graphFilters, selectedTermIds, dispatch]);

  // ── Light effect: update selection highlight without full rebuild ───────────
  useEffect(() => {
    if (!networkRef.current) return;
    networkRef.current.unselectAll();
    if (activeNodeId) {
      networkRef.current.selectNodes([activeNodeId], false);
    } else if (activeLinkId) {
      networkRef.current.selectEdges([activeLinkId]);
    }
  }, [activeNodeId, activeLinkId]);

  const showNoLinksHint = graphLevel !== 'terms' && nodeCount > 0 && linkCount === 0;
  const showNoDataHint  = nodeCount === 0 && !!activeCourse;

  return (
    <div className="relative h-full w-full">
      <div className="graph-grid absolute inset-0" />
      <div
        ref={containerRef}
        className="relative z-10 h-full w-full"
        style={{ outline: 'none' }}
      />

      {(showNoLinksHint || showNoDataHint) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            className="mx-auto max-w-sm rounded border px-6 py-5 text-center shadow-sm"
            style={{
              backgroundColor: 'var(--lw-bg-panel)',
              borderColor: 'var(--lw-border-primary)',
              opacity: 0.97,
            }}
          >
            {showNoDataHint ? (
              <>
                <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--lw-text-primary)' }}>
                  Нет данных для отображения
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--lw-text-muted)' }}>
                  Откройте курс с импортированной структурой модулей и уроков.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--lw-text-primary)' }}>
                  Связи не отображаются
                </p>
                <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--lw-text-secondary)' }}>
                  Рёбра строятся по общим терминам между{' '}
                  {graphLevel === 'modules' ? 'модулями' : 'уроками'}.
                  {allTerms.length === 0
                    ? ' Глоссарий пуст — добавьте термины.'
                    : ' Нет привязок — запустите «Собрать данные».'}
                </p>
                <div className="rounded px-3 py-2.5 text-left" style={{ backgroundColor: 'var(--lw-bg-hover)' }}>
                  <p className="mb-1.5 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
                    Как получить связи:
                  </p>
                  <ol className="list-inside list-decimal space-y-1 text-xs" style={{ color: 'var(--lw-text-muted)' }}>
                    {allTerms.length === 0 && (
                      <li>Перейдите на вкладку <strong style={{ color: 'var(--lw-text-secondary)' }}>«+ Добавить»</strong> и введите термины</li>
                    )}
                    <li>Отметьте термины <strong style={{ color: 'var(--lw-text-secondary)' }}>чекбоксами</strong></li>
                    <li>Нажмите <strong style={{ color: 'var(--lw-accent-amber)' }}>«Собрать данные для глоссария»</strong></li>
                    <li>Связи появятся автоматически</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
