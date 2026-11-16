import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { Compound } from '../types';
import { useContainerWidth } from './useContainerWidth';
import styles from './Charts.module.css';

interface ScatterPlotProps {
  data: Compound[];
  totalCount?: number;
  onPointClick?: (compound: Compound) => void;
  selectedId?: number | null;
}

const MARGIN = { top: 18, right: 24, bottom: 48, left: 56 };
const HEIGHT = 340;
const GRID_COLOR = '#27272a';
const AXIS_COLOR = '#52525b';
const TEXT_COLOR = '#d4d4d8';

const PALETTE = ['#fafafa', '#d4d4d8', '#a1a1aa', '#71717a', '#e4e4e7', '#52525b', '#f4f4f5'];

export default function ScatterPlot({
  data,
  totalCount,
  onPointClick,
  selectedId,
}: ScatterPlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerWidth = useContainerWidth(containerRef, 600);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const categories = useMemo(
    () => Array.from(new Set(data.map((d) => d.category))).sort(),
    [data]
  );

  const colorScale = useMemo(
    () => d3.scaleOrdinal<string>().domain(categories).range(PALETTE),
    [categories]
  );

  const visibleData = useMemo(
    () => data.filter((d) => !hiddenCategories.has(d.category)),
    [data, hiddenCategories]
  );

  const toggleCategory = (category: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!svgRef.current || visibleData.length === 0) return;

    const width = Math.max(containerWidth, 300);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 160);
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${HEIGHT}`)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(visibleData, (d) => d.molecular_weight) ?? 800])
      .nice()
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(10, d3.max(visibleData, (d) => d.toxicity_score) ?? 10)])
      .nice()
      .range([innerHeight, 0]);

    const tickCountX = width < 440 ? 5 : 8;

    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ''))
      .call((selection) => selection.select('.domain').remove())
      .call((selection) =>
        selection.selectAll('line').attr('stroke', GRID_COLOR).attr('stroke-dasharray', '4 5')
      );

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(tickCountX))
      .call((selection) => selection.selectAll('path,line').attr('stroke', AXIS_COLOR))
      .call((selection) => selection.selectAll('text').attr('fill', TEXT_COLOR).style('font-size', '11px'))
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 38)
      .attr('fill', TEXT_COLOR)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Molecular Weight (g/mol)');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .call((selection) => selection.selectAll('path,line').attr('stroke', AXIS_COLOR))
      .call((selection) => selection.selectAll('text').attr('fill', TEXT_COLOR).style('font-size', '11px'))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -42)
      .attr('fill', TEXT_COLOR)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text('Toxicity Score');

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

    g.selectAll('circle')
      .data(visibleData, (d) => String((d as Compound).id))
      .join('circle')
      .attr('cx', (d) => xScale(d.molecular_weight))
      .attr('cy', (d) => yScale(d.toxicity_score))
      .attr('r', (d) => (d.id === selectedId ? 7 : 4.5))
      .attr('fill', (d) => colorScale(d.category))
      .attr('stroke', (d) => (d.id === selectedId ? '#ffffff' : '#09090b'))
      .attr('stroke-width', (d) => (d.id === selectedId ? 2.5 : 1.2))
      .attr('opacity', 0.84)
      .style('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('opacity', 1).attr('r', 7);
        tooltip
          .style('opacity', 1)
          .html(
            `<strong>${d.name}</strong><br/>Category: ${d.category}<br/>Weight: ${d.molecular_weight} g/mol<br/>Toxicity: ${d.toxicity_score}<br/>Affinity: ${d.binding_affinity} nM`
          );
      })
      .on('mousemove', (event) => {
        if (!containerRef.current) return;
        const [x, y] = d3.pointer(event, containerRef.current);
        const clampedX = Math.min(x + 12, Math.max(12, containerWidth - 190));
        const clampedY = Math.max(8, y - 16);
        tooltip.style('left', `${clampedX}px`).style('top', `${clampedY}px`);
      })
      .on('mouseout', function (_, d) {
        d3.select(this)
          .attr('opacity', 0.84)
          .attr('r', d.id === selectedId ? 7 : 4.5);
        tooltip.style('opacity', 0);
      })
      .on('click', (_, d) => onPointClick?.(d));
  }, [visibleData, selectedId, onPointClick, containerWidth, colorScale]);

  const totalAvailable = totalCount ?? data.length;

  return (
    <div ref={containerRef} className={styles.chartContainer}>
      {categories.length > 0 && (
        <div className={styles.legendRow} role="group" aria-label="Toggle compound categories">
          {categories.map((cat) => {
            const isHidden = hiddenCategories.has(cat);
            return (
              <button
                key={cat}
                type="button"
                className={`${styles.legendItem} ${isHidden ? styles.legendItemInactive : ''}`}
                aria-pressed={!isHidden}
                onClick={() => toggleCategory(cat)}
              >
                <span
                  className={styles.legendSwatch}
                  style={{ backgroundColor: colorScale(cat) }}
                  aria-hidden="true"
                />
                <span>{cat}</span>
              </button>
            );
          })}
          {hiddenCategories.size > 0 && (
            <button
              type="button"
              className={styles.legendReset}
              onClick={() => setHiddenCategories(new Set())}
            >
              Show all
            </button>
          )}
        </div>
      )}

      {visibleData.length === 0 ? (
        <div className={styles.emptyState}>
          {data.length === 0
            ? 'No compounds match the current filters.'
            : 'All categories are hidden. Click a category above or "Show all" to display points.'}
        </div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Scatter plot of molecular weight versus toxicity score"
        />
      )}

      <p className={styles.chartCaption}>
        Showing {visibleData.length} of {totalAvailable} compounds
      </p>
    </div>
  );
}
