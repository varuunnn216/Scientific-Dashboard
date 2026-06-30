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

export default function ScatterPlot({ data, onPointClick, selectedId }: ScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // clear previous render before redrawing

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
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
    const colorScale = d3.scaleOrdinal<string>().domain(categories).range(d3.schemeTableau10);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 38)
      .attr('fill', '#374151')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Molecular Weight (g/mol)');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('fill', '#374151')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Toxicity Score');

    // Tooltip
    const tooltip = d3
      .select(svgRef.current.parentElement)
      .selectAll<HTMLDivElement, unknown>('.d3-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', 'white')
      .style('border', '1px solid #d1d5db')
      .style('border-radius', '6px')
      .style('padding', '6px 10px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.1)');

    // Points
    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (d) => xScale(d.molecular_weight))
      .attr('cy', (d) => yScale(d.toxicity_score))
      .attr('r', (d) => (d.id === selectedId ? 7 : 4.5))
      .attr('fill', (d) => colorScale(d.category))
      .attr('stroke', (d) => (d.id === selectedId ? '#111827' : 'none'))
      .attr('stroke-width', 2)
      .attr('opacity', 0.75)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
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
          .attr('opacity', 0.75)
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
