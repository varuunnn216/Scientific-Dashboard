import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { Compound } from '../types';

interface ScatterPlotProps {
  data: Compound[];
  onPointClick?: (compound: Compound) => void;
  selectedId?: number | null;
}

const MARGIN = { top: 20, right: 30, bottom: 50, left: 60 };
const WIDTH = 600;
const HEIGHT = 400;
const GRID_COLOR = '#e2e8f0';
const AXIS_COLOR = '#64748b';

export default function ScatterPlot({ data, onPointClick, selectedId }: ScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.molecular_weight) ?? 800])
      .nice()
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.toxicity_score) ?? 10])
      .nice()
      .range([innerHeight, 0]);

    const categories = Array.from(new Set(data.map((d) => d.category)));
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(categories)
      .range(['#2563eb', '#14b8a6', '#f97316', '#8b5cf6', '#ef4444', '#84cc16', '#06b6d4']);

    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ''))
      .call((selection) => selection.select('.domain').remove())
      .call((selection) =>
        selection.selectAll('line').attr('stroke', GRID_COLOR).attr('stroke-dasharray', '4 5')
      );

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .call((selection) => selection.selectAll('path,line').attr('stroke', AXIS_COLOR))
      .call((selection) => selection.selectAll('text').attr('fill', '#334155').style('font-size', '11px'))
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 38)
      .attr('fill', '#334155')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Molecular Weight (g/mol)');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .call((selection) => selection.selectAll('path,line').attr('stroke', AXIS_COLOR))
      .call((selection) => selection.selectAll('text').attr('fill', '#334155').style('font-size', '11px'))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('fill', '#334155')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Toxicity Score');

    const tooltip = d3
      .select(svgRef.current.parentElement)
      .selectAll<HTMLDivElement, unknown>('.d3-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(15, 23, 42, 0.94)')
      .style('border', '1px solid rgba(255,255,255,0.18)')
      .style('border-radius', '8px')
      .style('color', '#e2e8f0')
      .style('padding', '8px 10px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('box-shadow', '0 18px 34px rgba(15,23,42,0.24)');

    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (d) => xScale(d.molecular_weight))
      .attr('cy', (d) => yScale(d.toxicity_score))
      .attr('r', (d) => (d.id === selectedId ? 7 : 4.5))
      .attr('fill', (d) => colorScale(d.category))
      .attr('stroke', (d) => (d.id === selectedId ? '#0f172a' : '#ffffff'))
      .attr('stroke-width', (d) => (d.id === selectedId ? 2.5 : 1.5))
      .attr('opacity', 0.82)
      .style('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('opacity', 1).attr('r', 7);
        tooltip
          .style('opacity', 1)
          .html(
            `<strong>${d.name}</strong><br/>${d.category}<br/>MW: ${d.molecular_weight} g/mol<br/>Toxicity: ${d.toxicity_score}`
          );
      })
      .on('mousemove', (event) => {
        const [x, y] = d3.pointer(event, svgRef.current?.parentElement);
        tooltip.style('left', `${x + 12}px`).style('top', `${y - 12}px`);
      })
      .on('mouseout', function (_, d) {
        d3.select(this)
          .attr('opacity', 0.82)
          .attr('r', d.id === selectedId ? 7 : 4.5);
        tooltip.style('opacity', 0);
      })
      .on('click', (_, d) => onPointClick?.(d));
  }, [data, selectedId, onPointClick]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} width="100%" height={HEIGHT} />
    </div>
  );
}
