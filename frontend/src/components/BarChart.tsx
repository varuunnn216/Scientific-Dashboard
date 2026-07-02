import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { CategoryStat } from '../types';

interface BarChartProps {
  data: CategoryStat[];
}

const MARGIN = { top: 20, right: 20, bottom: 80, left: 60 };
const WIDTH = 600;
const HEIGHT = 350;
const GRID_COLOR = '#e2e8f0';
const AXIS_COLOR = '#64748b';

export default function BarChart({ data }: BarChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const gradient = svg
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .append('defs')
      .append('linearGradient')
      .attr('id', 'binding-gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#2563eb');

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xScale = d3
      .scaleBand()
      .domain(data.map((d) => d.category))
      .range([0, innerWidth])
      .padding(0.25);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.avg_binding_affinity) ?? 100])
      .nice()
      .range([innerHeight, 0]);

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
      .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end')
      .attr('fill', '#334155')
      .style('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .call((selection) => selection.selectAll('path,line').attr('stroke', AXIS_COLOR))
      .call((selection) => selection.selectAll('text').attr('fill', '#334155').style('font-size', '11px'));

    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => xScale(d.category) ?? 0)
      .attr('y', (d) => yScale(d.avg_binding_affinity))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.avg_binding_affinity))
      .attr('fill', 'url(#binding-gradient)')
      .attr('rx', 5)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 10px 14px rgba(37, 99, 235, 0.18))')
      .on('mouseover', function () {
        d3.select(this).attr('opacity', 0.84);
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
      });

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('fill', '#334155')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Avg Binding Affinity (nM)');
  }, [data]);

  return <svg ref={svgRef} width="100%" height={HEIGHT} />;
}
