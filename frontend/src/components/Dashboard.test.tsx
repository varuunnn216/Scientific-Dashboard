import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { getCategories, getCompounds, getStats } from '../api/compounds';
import type { Compound, PaginatedCompounds, StatsResponse } from '../types';

vi.mock('../api/compounds', () => ({
  getCategories: vi.fn(),
  getCompounds: vi.fn(),
  getStats: vi.fn(),
}));

function makeCompounds(count: number): Compound[] {
  const categories = ['Antiviral', 'Kinase Inhibitor', 'Antibiotic'];
  return Array.from({ length: count }, (_, idx) => ({
    id: idx + 1,
    name: `CMP-${String(idx + 1).padStart(4, '0')}`,
    molecular_formula: 'C12H14N2O2',
    molecular_weight: 150 + idx * 10,
    solubility: 12.5,
    toxicity_score: Number(((idx % 10) + 0.5).toFixed(2)),
    binding_affinity: Number((50 + idx * 5).toFixed(2)),
    category: categories[idx % categories.length],
    created_at: '2026-01-01T00:00:00Z',
  }));
}

const emptyCompoundsResponse: PaginatedCompounds = {
  total: 0,
  page: 1,
  page_size: 100,
  results: [],
};

const emptyStatsResponse: StatsResponse = {
  total_compounds: 0,
  categories: [],
  molecular_weight_distribution: [],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompounds).mockResolvedValue(emptyCompoundsResponse);
    vi.mocked(getStats).mockResolvedValue(emptyStatsResponse);
    vi.mocked(getCategories).mockResolvedValue(['Antiviral', 'Kinase Inhibitor', 'Antibiotic']);
  });

  it('renders categories returned by the API in the filter dropdown and shows synthetic demo badge', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Antiviral' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Kinase Inhibitor' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Antibiotic' })).toBeInTheDocument();
    });
    expect(screen.getByText('Synthetic demo data')).toBeInTheDocument();
  });

  it('supports table sorting on columns and pagination at 25 rows per page', async () => {
    const items = makeCompounds(30);
    vi.mocked(getCompounds).mockResolvedValue({
      total: 30,
      page: 1,
      page_size: 100,
      results: items,
    });
    vi.mocked(getStats).mockResolvedValue({
      total_compounds: 30,
      categories: [
        {
          category: 'Antiviral',
          avg_molecular_weight: 250,
          avg_toxicity_score: 4.5,
          avg_binding_affinity: 120,
          count: 10,
        },
      ],
      molecular_weight_distribution: [{ bucket: '100-200', count: 10 }],
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Showing 1-25 of 30')).toBeInTheDocument();
    });

    // First page contains CMP-0001 and not CMP-0030
    expect(screen.getByText('CMP-0001')).toBeInTheDocument();
    expect(screen.queryByText('CMP-0030')).not.toBeInTheDocument();

    // Navigate to page 2
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Showing 26-30 of 30')).toBeInTheDocument();
    expect(screen.getByText('CMP-0030')).toBeInTheDocument();

    // Sort by MW descending -> CMP-0030 (highest MW: 440) moves to page 1
    fireEvent.click(screen.getByRole('button', { name: /MW \(g\/mol\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /MW \(g\/mol\)/i }));
    expect(screen.getByText('Showing 1-25 of 30')).toBeInTheDocument();
    expect(screen.getByText('CMP-0030')).toBeInTheDocument();
  });

  it('validates min weight <= max weight and displays an inline error message', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByLabelText('Min weight')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Min weight'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Max weight'), { target: { value: '200' } });

    expect(await screen.findByText('Min weight cannot exceed max weight.')).toBeInTheDocument();
  });

  it('renders empty state messages when no compounds match filters', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Showing 0 of 0')).toBeInTheDocument();
    });

    expect(screen.getByText('No compounds match the current filters.')).toBeInTheDocument();
    expect(screen.getByText('No category data matches the current filters.')).toBeInTheDocument();
    expect(
      screen.getByText('No weight distribution data for the current filters.')
    ).toBeInTheDocument();
  });

  it('renders an error banner with a Retry button and recovers when retried', async () => {
    vi.mocked(getCompounds).mockRejectedValueOnce(new Error('Network error'));

    render(<Dashboard />);

    const retryBtn = await screen.findByRole('button', { name: 'Retry' });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(getCompounds).mockResolvedValueOnce({
      total: 1,
      page: 1,
      page_size: 100,
      results: makeCompounds(1),
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('CMP-0001')).toBeInTheDocument();
    });
  });
});
