import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { CategoryStat } from '../types';

interface BarChartProps {
  data: CategoryStat[];
}

const MARGIN = { top: 20, right: 20, bottom: 80, left: 60 };
const WIDTH = 600;
const HEIGHT = 350;

export default function BarChart({ data }: BarChartProps) {
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
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end')
      .style('font-size', '10px');

    g.append('g').call(d3.axisLeft(yScale));

    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => xScale(d.category) ?? 0)
      .attr('y', (d) => yScale(d.avg_binding_affinity))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.avg_binding_affinity))
      .attr('fill', '#2563eb')
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseover', function () {
        d3.select(this).attr('fill', '#1d4ed8');
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', '#2563eb');
      });

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('fill', '#374151')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Avg Binding Affinity (nM)');
  }, [data]);

  return <svg ref={svgRef} width="100%" height={HEIGHT} />;
}