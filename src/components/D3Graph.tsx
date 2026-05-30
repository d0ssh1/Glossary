// ============================================================
// D3 FORCE-DIRECTED GRAPH
// ============================================================
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useApp } from '@/store/AppContext';
import { buildGraphData } from '@/lib/graphData';
import { statusHex, linkHex } from '@/lib/constants';
import { contextKey, loadPositions, savePositions } from '@/lib/nodePositions';
import type { GraphNode, GraphLink, GraphLevel } from '@/types';

/** A link object after d3.forceLink() has resolved source/target into nodes. */
type SimLink = GraphLink & d3.SimulationLinkDatum<GraphNode>;

/** Edge thickness scales with weight, with a per-level floor so terms-level
 *  palki never get lost under the surrounding nodes. */
function edgeWidthFor(level: GraphLevel, d: GraphLink): number {
  const floor = level === 'terms' ? 2.5 : 2;
  return Math.max(floor, 1 + (d.weight || 1) * 0.6);
}

/** Capitalize the first letter (terms are sentence-cased regardless of input). */
function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export default function D3Graph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useApp();
  const { graphLevel, activeNodeId, activeLinkId, activeGlossaryId, activeCourseId, breadcrumbs, courses, hierFilterIds, graphFilters, selectedTermIds } = state;

  // Active course + glossary
  const activeCourse = courses.find(c => c.id === activeCourseId);
  const activeGlossary = courses
    .flatMap(c => c.glossaries)
    .find(g => g.id === activeGlossaryId);
  const allTerms = activeGlossary?.terms || [];

  // Current parent for drill-down (lessons-level → moduleId, terms-level → lessonId)
  const drillModuleId = breadcrumbs.find(b => b.level === 'lessons')?.id;
  const drillLessonId = breadcrumbs.find(b => b.level === 'terms')?.id;

  // Selections + live "active" values are kept in refs so that selecting a node
  // or edge only restyles the existing SVG (a cheap, second effect) instead of
  // tearing down and rebuilding the whole simulation — which is what made the
  // graph "jump" on every click.
  const linkSelRef = useRef<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const activeNodeIdRef = useRef(activeNodeId);
  const activeLinkIdRef = useRef(activeLinkId);
  activeNodeIdRef.current = activeNodeId;
  activeLinkIdRef.current = activeLinkId;

  // ---- Heavy effect: build graph + run force simulation. Re-runs ONLY when the
  //      graph's structure can change (level, data, filters) — never on a mere
  //      selection change.
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    const { nodes, links } = buildGraphData(graphLevel, {
      course: activeCourse,
      allTerms,
      drillModuleId,
      drillLessonId,
      hierFilterIds,
      filters: graphFilters,
      selectedTermIds,
    });

    // Restore saved positions for this drill-down context.
    const positionsKey = contextKey(graphLevel, drillModuleId, drillLessonId);
    const savedPositions = loadPositions(positionsKey);
    nodes.forEach(n => {
      const saved = savedPositions[n.id];
      if (saved) { n.x = saved.x; n.y = saved.y; n.fx = saved.x; n.fy = saved.y; }
    });

    // ONE array for both the force-link and the rendered <line> selection. The
    // simulation mutates source/target on these same objects, so the tick
    // handler reads real node coordinates (binding `links` separately left the
    // string source/target untouched → every line collapsed to (0,0) and was
    // invisible — that was the missing-palki bug).
    const simLinks: SimLink[] = links.map(l => ({ ...l })) as unknown as SimLink[];

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, SimLink>(simLinks).id((d: GraphNode) => d.id).distance(graphLevel === 'terms' ? 100 : 160))
      .force('charge', d3.forceManyBody().strength(graphLevel === 'terms' ? -300 : -500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.type === 'term' ? 25 : 40));

    // Draw links (no arrowheads — per spec the edges are plain palki).
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', (d) => linkHex[d.type])
      .attr('stroke-width', (d) => edgeWidthFor(graphLevel, d))
      .attr('stroke-opacity', 0.85)
      .style('cursor', 'pointer');
    linkSelRef.current = link;

    // Draw nodes
    const nodeGroup = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer');
    nodeSelRef.current = nodeGroup;

    // Node shapes
    nodeGroup.each(function (d: GraphNode) {
      const el = d3.select(this);
      if (d.type === 'term') {
        const status = d.status || 'no-trait';
        const color = statusHex[status];
        el.append('circle')
          .attr('r', 22)
          .attr('fill', '#FFFFFF')
          .attr('stroke', color)
          .attr('stroke-width', 2.5)
          .attr('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))');
      } else if (graphLevel === 'terms' && d.id.startsWith('center-')) {
        // Center node for terms view — the lesson hub.
        el.append('rect')
          .attr('width', 180)
          .attr('height', 48)
          .attr('x', -90)
          .attr('y', -24)
          .attr('rx', 6)
          .attr('fill', '#F6F5F2')
          .attr('stroke', '#D4A056')
          .attr('stroke-width', 2)
          .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
      } else {
        el.append('rect')
          .attr('class', 'node-box')
          .attr('width', 180)
          .attr('height', 54)
          .attr('x', -90)
          .attr('y', -27)
          .attr('rx', 6)
          .attr('fill', '#FFFFFF')
          .attr('stroke', d.id === activeNodeId ? '#D4A056' : '#E0DFDA')
          .attr('stroke-width', d.id === activeNodeId ? 2.5 : 1.5)
          .attr('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.06))');
      }
      // Native SVG tooltip with the full name — guarantees the user can
      // always see what the truncated label says.
      el.append('title').text(d.name);
    });

    // Node labels
    nodeGroup.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => d.type === 'term' ? '10px' : '11px')
      .attr('font-weight', d => d.type === 'term' ? '500' : '600')
      .attr('fill', '#1A1A1A')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .each(function (d: GraphNode) {
        const text = d3.select(this);
        // Sentence-case term labels regardless of how the user typed them.
        const display = d.type === 'term' ? capitalize(d.name) : d.name;
        // Wrap to fit the ~26-char per-line budget of the wider 180px box.
        // Two lines max; if it still overflows we ellipsize the second line.
        const MAX_CHARS = 26;
        let lines: string[];
        if (display.includes('\n')) {
          lines = display.split('\n');
        } else if (display.length <= MAX_CHARS) {
          lines = [display];
        } else {
          const words = display.split(/\s+/);
          const out: string[] = [];
          let cur = '';
          for (const w of words) {
            const next = (cur ? cur + ' ' : '') + w;
            if (next.length > MAX_CHARS) {
              if (cur) out.push(cur);
              cur = w;
            } else {
              cur = next;
            }
          }
          if (cur) out.push(cur);
          lines = out.slice(0, 2);
          if (out.length > 2 || (lines[1] && lines[1].length > MAX_CHARS)) {
            lines[1] = lines[1].slice(0, MAX_CHARS - 1) + '…';
          }
        }
        text.text('');
        lines.forEach((word, i) => {
          text.append('tspan')
            .attr('x', 0)
            .attr('dy', i === 0 ? (lines.length > 1 ? '-0.45em' : '0.35em') : '1.2em')
            .text(word);
        });
      });

    // Status dots for term nodes
    nodeGroup.filter((d: GraphNode) => d.type === 'term')
      .append('circle')
      .attr('r', 4)
      .attr('cx', 16)
      .attr('cy', -16)
      .attr('fill', (d: GraphNode) => statusHex[d.status || 'no-trait'])
      .style('pointer-events', 'none');

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0);

      nodeGroup.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // Pin in place so the layout is stable, and persist for next session.
        const x = d.x ?? 0;
        const y = d.y ?? 0;
        d.fx = x;
        d.fy = y;
        const current = loadPositions(positionsKey);
        current[d.id] = { x, y };
        savePositions(positionsKey, current);
      });

    nodeGroup.call(drag as unknown as d3.DragBehavior<SVGGElement, GraphNode, unknown>);

    // Helper to restore a link to its resting style (honouring current selection).
    const restLink = () => {
      link
        .attr('stroke', (d) => activeLinkIdRef.current && d.id === activeLinkIdRef.current ? '#D4A056' : linkHex[d.type])
        .attr('stroke-width', (d) => activeLinkIdRef.current && d.id === activeLinkIdRef.current
          ? 2 + (d.weight || 1)
          : edgeWidthFor(graphLevel, d))
        .style('opacity', 0.85);
    };

    // Hover effects
    let lastClickTime = 0;

    nodeGroup
      .on('mouseenter', function (_event: unknown, hovered: GraphNode) {
        nodeGroup.style('opacity', 0.2);
        link.style('opacity', 0.1);

        const connectedNodeIds = new Set<string>();
        connectedNodeIds.add(hovered.id);
        simLinks.forEach((l) => {
          const sId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          if (sId === hovered.id) connectedNodeIds.add(tId);
          if (tId === hovered.id) connectedNodeIds.add(sId);
        });

        nodeGroup.filter((d: GraphNode) => connectedNodeIds.has(d.id))
          .style('opacity', 1);

        link.filter((d) => {
          const sId = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
          const tId = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
          return sId === hovered.id || tId === hovered.id;
        })
          .style('opacity', 1)
          .attr('stroke', '#D4A056')
          .attr('stroke-width', (d) => 2 + (d.weight || 1));

        d3.select(this).style('opacity', 1);
      })
      .on('mouseleave', function () {
        nodeGroup.style('opacity', 1);
        restLink();
      })
      .on('click', function (_event: unknown, d: GraphNode) {
        const now = Date.now();
        const isDoubleClick = now - lastClickTime < 300;
        lastClickTime = now;
        if (isDoubleClick) return; // Let dblclick handle it
        dispatch({ type: 'SET_ACTIVE_NODE', nodeId: d.id });
      })
      .on('dblclick', function (_event: unknown, d: GraphNode) {
        if (graphLevel === 'modules' && d.type === 'module') {
          dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: d.name.replace('\n', ' '), level: 'lessons' });
        } else if (graphLevel === 'lessons' && d.type === 'lesson') {
          dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: d.name.replace('\n', ' '), level: 'terms' });
        }
      });

    // Link interactions
    link
      .on('click', function (event: Event, d) {
        event.stopPropagation();
        dispatch({ type: 'SET_ACTIVE_LINK', linkId: d.id });
      })
      .on('mouseenter', function (_event: unknown, hovered) {
        link.style('opacity', 0.1);
        nodeGroup.style('opacity', 0.2);
        d3.select(this).style('opacity', 1).attr('stroke', '#D4A056').attr('stroke-width', 3);

        const sId = typeof hovered.source === 'string' ? hovered.source : (hovered.source as GraphNode).id;
        const tId = typeof hovered.target === 'string' ? hovered.target : (hovered.target as GraphNode).id;
        nodeGroup.filter((d: GraphNode) => d.id === sId || d.id === tId).style('opacity', 1);
      })
      .on('mouseleave', function () {
        nodeGroup.style('opacity', 1);
        restLink();
      });

    // Apply the current selection styling once on (re)build.
    restLink();
    if (activeNodeId) {
      nodeGroup.select<SVGRectElement>('rect.node-box')
        .attr('stroke', (d) => d.id === activeNodeId ? '#D4A056' : '#E0DFDA')
        .attr('stroke-width', (d) => d.id === activeNodeId ? 2.5 : 1.5);
    }

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphLevel, activeCourse, activeGlossary, allTerms, drillModuleId, drillLessonId, hierFilterIds, graphFilters, selectedTermIds, dispatch]);

  // ---- Light effect: re-style the existing graph when the selected node/edge
  //      changes. No rebuild, no simulation restart → no "jump".
  useEffect(() => {
    const link = linkSelRef.current;
    const nodeGroup = nodeSelRef.current;
    if (link) {
      link
        .attr('stroke', (d) => activeLinkId && d.id === activeLinkId ? '#D4A056' : linkHex[d.type])
        .attr('stroke-width', (d) => activeLinkId && d.id === activeLinkId
          ? 2 + (d.weight || 1)
          : edgeWidthFor(graphLevel, d))
        .style('opacity', 0.85);
    }
    if (nodeGroup) {
      nodeGroup.select<SVGRectElement>('rect.node-box')
        .attr('stroke', (d) => d.id === activeNodeId ? '#D4A056' : '#E0DFDA')
        .attr('stroke-width', (d) => d.id === activeNodeId ? 2.5 : 1.5);
    }
  }, [activeNodeId, activeLinkId, graphLevel]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div className="graph-grid absolute inset-0" />
      <svg ref={svgRef} className="relative z-10 h-full w-full" />
    </div>
  );
}
