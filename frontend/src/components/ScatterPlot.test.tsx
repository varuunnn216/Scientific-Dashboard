import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ScatterPlot from './ScatterPlot';
import type { Compound } from '../types';

it('keeps seven distinctive swatches and marker shapes consistent when filters change', () => {
  const categories = ['Antiviral', 'Kinase Inhibitor', 'Antibiotic', 'Antifungal',
    'Anticancer', 'Anti-inflammatory', 'CNS Agent'];
  const data: Compound[] = categories.map((category, index) => ({
    id: index + 1, category, name: `CMP-${index + 1}`, molecular_formula: 'C1',
    molecular_weight: 100 + index, toxicity_score: index, binding_affinity: 10,
    solubility: 20, created_at: '2026-01-01T00:00:00Z',
  }));
  const { container, rerender } = render(<ScatterPlot data={data} />);
  const colors = new Set();
  const shapes = new Set();
  for (const category of categories) {
    const swatch = screen.getByRole('button', { name: category }).querySelector('path');
    const dot = container.querySelector(`path.compound-marker[data-category="${category}"]`);
    expect(dot?.getAttribute('fill')).toBe(swatch?.getAttribute('fill'));
    expect(dot?.getAttribute('d')).toBe(swatch?.getAttribute('d'));
    colors.add(dot?.getAttribute('fill'));
    shapes.add(dot?.getAttribute('d'));
  }
  expect(colors.size).toBe(7);
  expect(shapes.size).toBe(7);

  const antiviral = screen.getByRole('button', { name: 'Antiviral' });
  const original = antiviral.querySelector('path')?.getAttribute('fill');
  fireEvent.click(antiviral);
  expect(container.querySelector('path.compound-marker[data-category="Antiviral"]')).toBeNull();
  fireEvent.click(antiviral);
  rerender(<ScatterPlot data={[data[0]]} />);
  expect(container.querySelector('path.compound-marker')?.getAttribute('fill')).toBe(original);
});
