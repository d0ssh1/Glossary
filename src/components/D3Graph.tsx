// ============================================================
// D3 FORCE-DIRECTED GRAPH
// ============================================================
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useApp } from '@/store/AppContext';
import { buildGraphData } from '@/lib/graphData';
import { statusHex, linkHex } from '@/lib/constants';
import { contextKey, loadPositions, savePositions } from '@/lib/nodePositions';
import type { GraphNode, GraphLink } from '@/types';

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


  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    // No arrowheads — per spec edges are plain palki (lines), the colour /
    // thickness encodes everything we need.
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
    // Cast links for D3 force simulation
    const d3Links = links.map(l => ({ ...l })) as unknown as d3.SimulationLinkDatum<GraphNode>[];

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(d3Links).id((d: GraphNode) => d.id).distance(graphLevel === 'terms' ? 100 : 160))
      .force('charge', d3.forceManyBody().strength(graphLevel === 'terms' ? -300 : -500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.type === 'term' ? 25 : 40));

    // Edge styling — palka thickness scales with weight, with a per-level floor
    // so terms-level edges never get lost under the surrounding nodes.
    const edgeWidth = (d: GraphLink): number => {
      const floor = graphLevel === 'terms' ? 2.5 : 2;
      return Math.max(floor, 1 + (d.weight || 1) * 0.6);
    };

    // Draw links (no arrowheads — per spec the edges are plain palki).
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d: GraphLink) => linkHex[d.type])
      .attr('stroke-width', edgeWidth)
      .attr('stroke-opacity', 0.85);

    // Draw nodes
    const nodeGroup = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer');

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
        // Capitalize the first letter for term nodes — spec shows them sentence-cased
        // regardless of how the user typed them in the bulk-add textarea.
        const display = d.type === 'term' && d.name.length > 0
          ? d.name[0].toUpperCase() + d.name.slice(1)
          : d.name;
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
        .attr('x1', (d: unknown) => ((d as GraphLink).source as GraphNode).x || 0)
        .attr('y1', (d: unknown) => ((d as GraphLink).source as GraphNode).y || 0)
        .attr('x2', (d: unknown) => ((d as GraphLink).target as GraphNode).x || 0)
        .attr('y2', (d: unknown) => ((d as GraphLink).target as GraphNode).y || 0);

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

    // Hover effects
    let lastClickTime = 0;

    nodeGroup
      .on('mouseenter', function (_event: unknown, hovered: GraphNode) {
        // Dim all
        nodeGroup.style('opacity', 0.2);
        link.style('opacity', 0.1);

        // Find connected
        const connectedNodeIds = new Set<string>();
        connectedNodeIds.add(hovered.id);
        links.forEach((l: GraphLink) => {
          const sId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          if (sId === hovered.id) connectedNodeIds.add(tId);
          if (tId === hovered.id) connectedNodeIds.add(sId);
        });

        // Highlight connected
        nodeGroup.filter((d: GraphNode) => connectedNodeIds.has(d.id))
          .style('opacity', 1);

        link.filter((d: GraphLink) => {
          const sId = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
          const tId = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
          return sId === hovered.id || tId === hovered.id;
        })
          .style('opacity', 1)
          .attr('stroke', '#D4A056')
          .attr('stroke-width', (d: GraphLink) => 2 + (d.weight || 1));

        d3.select(this).style('opacity', 1);
      })
      .on('mouseleave', function () {
        nodeGroup.style('opacity', 1);
        link.style('opacity', 0.85)
          .attr('stroke', (d: GraphLink) => activeLinkId && d.id === activeLinkId ? '#D4A056' : linkHex[d.type])
          .attr('stroke-width', (d: GraphLink) => activeLinkId && d.id === activeLinkId
            ? 2 + (d.weight || 1)
            : edgeWidth(d));
      })
      .on('click', function (_event: unknown, d: GraphNode) {
        const now = Date.now();
        const isDoubleClick = now - lastClickTime < 300;
        lastClickTime = now;

        if (isDoubleClick) return; // Let dblclick handle it

        // Single click: select node, show in right panel
        dispatch({ type: 'SET_ACTIVE_NODE', nodeId: d.id });
      })
      .on('dblclick', function (_event: unknown, d: GraphNode) {
        if (graphLevel === 'modules' && d.type === 'module') {
          dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: d.name.replace('\n', ' '), level: 'lessons' });
        } else if (graphLevel === 'lessons' && d.type === 'lesson') {
          dispatch({ type: 'DRILL_DOWN', nodeId: d.id, nodeName: d.name.replace('\n', ' '), level: 'terms' });
        }
      });

    // Link click — open "Смежные термины X и Y" panel.
    link
      .style('cursor', 'pointer')
      .on('click', function (event: Event, d: GraphLink) {
        event.stopPropagation();
        dispatch({ type: 'SET_ACTIVE_LINK', linkId: d.id });
      });

    // Visually mark the active link (selected via click).
    if (activeLinkId) {
      link
        .filter((d: GraphLink) => d.id === activeLinkId)
        .attr('stroke', '#D4A056')
        .attr('stroke-width', (d: GraphLink) => 2 + (d.weight || 1));
    }

    // Link hover
    link
      .on('mouseenter', function (_event: unknown, hovered: GraphLink) {
        link.style('opacity', 0.1);
        nodeGroup.style('opacity', 0.2);
        d3.select(this).style('opacity', 1).attr('stroke', '#D4A056').attr('stroke-width', 3);

        const sId = typeof hovered.source === 'string' ? hovered.source : (hovered.source as GraphNode).id;
        const tId = typeof hovered.target === 'string' ? hovered.target : (hovered.target as GraphNode).id;
        nodeGroup.filter((d: GraphNode) => d.id === sId || d.id === tId).style('opacity', 1);
      })
      .on('mouseleave', function () {
        link.style('opacity', 0.7)
          .attr('stroke', (d: GraphLink) => activeLinkId && d.id === activeLinkId ? '#D4A056' : linkHex[d.type])
          .attr('stroke-width', (d: GraphLink) => activeLinkId && d.id === activeLinkId
            ? 2 + (d.weight || 1)
            : edgeWidth(d));
        nodeGroup.style('opacity', 1);
      });

    return () => {
      simulation.stop();
    };
  }, [graphLevel, activeNodeId, activeLinkId, activeCourse, activeGlossary, allTerms, drillModuleId, drillLessonId, hierFilterIds, graphFilters, selectedTermIds, dispatch]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div className="graph-grid absolute inset-0" />
      <svg ref={svgRef} className="relative z-10 h-full w-full" />
    </div>
  );
}
