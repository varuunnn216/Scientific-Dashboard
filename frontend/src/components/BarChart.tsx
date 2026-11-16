import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { CategoryStat } from '../types';
import { useContainerWidth } from './useContainerWidth';
import styles from './Charts.module.css';

interface BarChartProps {
  data: CategoryStat[];
}

const MARGIN = { top: 28, right: 20, bottom: 88, left: 56 };
const HEIGHT = 360;
const GRID_COLOR = '#27272a';
const AXIS_COLOR = '#52525b';
const TEXT_COLOR = '#d4d4d8';

export default function BarChart({ data }: BarChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerWidth = useContainerWidth(containerRef, 600);

  const sortedData = useMemo(
    () => [...data].sort((a, b) => b.avg_binding_affinity - a.avg_binding_affinity),
    [data]
  );

  useEffect(() => {
    if (!svgRef.current || sortedData.length === 0) return;

    const width = Math.max(containerWidth, 300);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 160);
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const gradient = svg
      .attr('viewBox', `0 0 ${width} ${HEIGHT}`)
      .append('defs')
      .append('linearGradient')
      .attr('id', 'binding-gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#fafafa');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#71717a');

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xScale = d3
      .scaleBand()
      .domain(sortedData.map((d) => d.category))
      .range([0, innerWidth])
      .padding(0.25);

    const maxVal = d3.max(sortedData, (d) => d.avg_binding_affinity) ?? 100;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxVal * 1.12])
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
      .attr('transform', 'rotate(-32)')
      .style('text-anchor', 'end')
      .attr('fill', TEXT_COLOR)
      .style('font-size', width < 420 ? '9px' : '11px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .call((selection) => selection.selectAll('path,line').attr('stroke', AXIS_COLOR))
      .call((selection) => selection.selectAll('text').attr('fill', TEXT_COLOR).style('font-size', '11px'));

    const tooltip = d3
      .select(containerRef.current)
      .selectAll<HTMLDivElement, unknown>('.d3-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('z-index', '10')
      .style('background', '#18181b')
      .style('border', '1px solid #3f3f46')
      .style('border-radius', '8px')
      .style('color', '#fafafa')
      .style('padding', '8px 10px')
      .style('font-size', '12px')
      .style('line-height', '1.45')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('box-shadow', '0 18px 34px rgba(0,0,0,0.55)');

    g.selectAll('rect')
      .data(sortedData)
      .join('rect')
      .attr('x', (d) => xScale(d.category) ?? 0)
      .attr('y', (d) => yScale(d.avg_binding_affinity))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.avg_binding_affinity))
      .attr('fill', 'url(#binding-gradient)')
      .attr('rx', 5)
      .style('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('opacity', 0.84);
        tooltip
          .style('opacity', 1)
          .html(
            `<strong>${d.category}</strong><br/>Mean affinity: ${d.avg_binding_affinity.toFixed(2)} nM<br/>Compounds: ${d.count}`
          );
      })
      .on('mousemove', (event) => {
        if (!containerRef.current) return;
        const [x, y] = d3.pointer(event, containerRef.current);
        const clampedX = Math.min(x + 12, Math.max(12, containerWidth - 180));
        const clampedY = Math.max(8, y - 16);
        tooltip.style('left', `${clampedX}px`).style('top', `${clampedY}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        tooltip.style('opacity', 0);
      });

    g.selectAll('.bar-label')
      .data(sortedData)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', (d) => (xScale(d.category) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.avg_binding_affinity) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fafafa')
      .style('font-size', width < 420 ? '9px' : '11px')
      .style('font-weight', '700')
      .text((d) => d.avg_binding_affinity.toFixed(1));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -42)
      .attr('fill', TEXT_COLOR)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Avg Binding Affinity (nM)');
  }, [sortedData, containerWidth]);

  return (
    <div ref={containerRef} className={styles.chartContainer}>
      {sortedData.length === 0 ? (
        <div className={styles.emptyState}>No category data matches the current filters.</div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Bar chart of average binding affinity by category"
        />
      )}
    </div>
  );
}
