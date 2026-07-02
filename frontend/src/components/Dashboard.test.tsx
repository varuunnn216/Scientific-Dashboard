import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { getCategories, getCompounds, getStats } from '../api/compounds';
import type { PaginatedCompounds, StatsResponse } from '../types';

vi.mock('../api/compounds', () => ({
  getCategories: vi.fn(),
  getCompounds: vi.fn(),
  getStats: vi.fn(),
}));

const compoundsResponse: PaginatedCompounds = {
  total: 0,
  page: 1,
  page_size: 100,
  results: [],
};

const statsResponse: StatsResponse = {
  total_compounds: 0,
  categories: [],
  molecular_weight_distribution: [],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(getCompounds).mockResolvedValue(compoundsResponse);
    vi.mocked(getStats).mockResolvedValue(statsResponse);
    vi.mocked(getCategories).mockResolvedValue(['Antiviral', 'Kinase Inhibitor', 'Antibiotic']);
  });

  it('renders categories returned by the API in the filter dropdown', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Antiviral' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Kinase Inhibitor' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Antibiotic' })).toBeInTheDocument();
    });
  });
});
