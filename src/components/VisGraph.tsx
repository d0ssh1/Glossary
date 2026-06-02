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

  // Navigation hierarchy: modules → lessons → steps → terms. Each breadcrumb's
  // `level` is the level it leads INTO, and its id is the parent we're inside.
  const drillModuleId = breadcrumbs.find(b => b.level === 'lessons')?.id;
  const drillLessonId = breadcrumbs.find(b => b.level === 'steps')?.id;
  const drillStepId   = breadcrumbs.find(b => b.level === 'terms')?.id;

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
      drillStepId,
      hierFilterIds,
      filters: graphFilters,
      selectedTermIds,
    });

    setNodeCount(nodes.length);
    setLinkCount(links.length);

    const positionsKey = contextKey(graphLevel, drillModuleId, drillStepId ?? drillLessonId);
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
        // Brightness scales with the number of shared terms: heavier edge =
        // more opaque (and thus visually "ярче"), lighter edge = more faded.
        const weight = l.weight || 1;
        const opacity = isActive ? 1 : Math.min(1, 0.45 + weight * 0.14);

        return {
          id: l.id,
          from: srcId,
          to: tgtId,
          width: isActive ? w + 2 : w,
          color: {
            color:     isActive ? '#D4A056' : linkHex[l.type],
            highlight: '#D4A056',
            hover:     '#D4A056',
            opacity,
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
      const name = d.name.replace('\n', ' ');
      if (graphLevel === 'modules' && d.type === 'module') {
        dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: name, level: 'lessons' });
      } else if (graphLevel === 'lessons' && d.type === 'lesson') {
        dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: name, level: 'steps' });
      } else if (graphLevel === 'steps' && d.type === 'step') {
        dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: name, level: 'terms' });
      }
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphLevel, activeCourse, activeGlossary, allTerms, drillModuleId, drillLessonId, drillStepId, hierFilterIds, graphFilters, selectedTermIds, dispatch]);

  // ── Light effect: update selection highlight without full rebuild ───────────
  useEffect(() => {
    const net = networkRef.current;
    if (!net) return;
    // vis-network throws a RangeError if you select an id that isn't in the
    // current graph. After a drill-down the active node/edge id usually belongs
    // to the PREVIOUS level (e.g. selected module "m2" then drilled into it),
    // so we must guard against ids that no longer exist — otherwise the throw
    // bubbles out of the effect and unmounts the whole app (white screen).
    // `body` is internal and not in vis-network's public typings.
    const body = (net as unknown as { body?: { nodes: Record<string, unknown>; edges: Record<string, unknown> } }).body;
    try {
      net.unselectAll();
      const nodeIds = body?.nodes ?? {};
      const edgeIds = body?.edges ?? {};
      if (activeNodeId && nodeIds[activeNodeId]) {
        net.selectNodes([activeNodeId], false);
      } else if (activeLinkId && edgeIds[activeLinkId]) {
        net.selectEdges([activeLinkId]);
      }
    } catch {
      /* stale selection id — ignore */
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
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div
            className="flex max-w-md items-center gap-2 rounded-full border px-4 py-2 text-xs shadow-sm"
            style={{
              backgroundColor: 'var(--lw-bg-panel)',
              borderColor: 'var(--lw-border-primary)',
              color: 'var(--lw-text-secondary)',
              opacity: 0.95,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--lw-accent-amber)' }}
            />
            {showNoDataHint ? (
              <span>Откройте курс с импортированной структурой модулей и уроков.</span>
            ) : allTerms.length === 0 ? (
              <span>Добавьте термины на вкладке «+ Добавить» — связи появятся после сбора данных.</span>
            ) : (
              <span>Отметьте термины и нажмите «Собрать данные» — связи появятся автоматически.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
