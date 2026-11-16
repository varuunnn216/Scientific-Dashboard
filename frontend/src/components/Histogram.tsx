import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { MolecularWeightBucket } from '../types';
import { useContainerWidth } from './useContainerWidth';
import styles from './Charts.module.css';

interface HistogramProps {
  data: MolecularWeightBucket[];
}

const MARGIN = { top: 20, right: 20, bottom: 72, left: 56 };
const HEIGHT = 320;
const GRID_COLOR = '#e2e8f0';
const AXIS_COLOR = '#64748b';

export default function Histogram({ data }: HistogramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerWidth = useContainerWidth(containerRef, 600);

  const hasData = data.length > 0 && data.some((d) => d.count > 0);

  useEffect(() => {
    if (!svgRef.current || !hasData) return;

    const width = Math.max(containerWidth, 300);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 160);
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const gradient = svg
      .attr('viewBox', `0 0 ${width} ${HEIGHT}`)
      .append('defs')
      .append('linearGradient')
      .attr('id', 'mw-gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#34d399');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981');

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xScale = d3
      .scaleBand()
      .domain(data.map((d) => d.bucket))
      .range([0, innerWidth])
      .padding(0.15);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 0])
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
      .attr('transform', width < 480 ? 'rotate(-35)' : 'rotate(0)')
      .style('text-anchor', width < 480 ? 'end' : 'middle')
      .attr('fill', '#334155')
      .style('font-size', width < 480 ? '10px' : '11px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .call((selection) => selection.selectAll('path,line').attr('stroke', AXIS_COLOR))
      .call((selection) => selection.selectAll('text').attr('fill', '#334155').style('font-size', '11px'));

    const tooltip = d3
      .select(containerRef.current)
      .selectAll<HTMLDivElement, unknown>('.d3-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('z-index', '10')
      .style('background', 'rgba(15, 23, 42, 0.95)')
      .style('border', '1px solid rgba(255,255,255,0.18)')
      .style('border-radius', '8px')
      .style('color', '#f8fafc')
      .style('padding', '8px 10px')
      .style('font-size', '12px')
      .style('line-height', '1.45')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('box-shadow', '0 18px 34px rgba(15,23,42,0.24)');

    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => xScale(d.bucket) ?? 0)
      .attr('y', (d) => yScale(d.count))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.count))
      .attr('fill', 'url(#mw-gradient)')
      .attr('rx', 5)
      .style('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('opacity', 0.84);
        tooltip
          .style('opacity', 1)
          .html(`<strong>${d.bucket} g/mol</strong><br/>Compounds: ${d.count}`);
      })
      .on('mousemove', (event) => {
        if (!containerRef.current) return;
        const [x, y] = d3.pointer(event, containerRef.current);
        const clampedX = Math.min(x + 12, Math.max(12, containerWidth - 160));
        const clampedY = Math.max(8, y - 16);
        tooltip.style('left', `${clampedX}px`).style('top', `${clampedY}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        tooltip.style('opacity', 0);
      });

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -42)
      .attr('fill', '#334155')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Number of Compounds');

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 52)
      .attr('fill', '#334155')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Molecular Weight Range (g/mol)');
  }, [data, hasData, containerWidth]);

  return (
    <div ref={containerRef} className={styles.chartContainer}>
      {!hasData ? (
        <div className={styles.emptyState}>No weight distribution data for the current filters.</div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Histogram of molecular weight distribution"
        />
      )}
    </div>
  );
}
