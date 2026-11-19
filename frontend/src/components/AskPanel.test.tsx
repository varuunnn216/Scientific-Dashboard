import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AskPanel from './AskPanel';
import api from '../api/compounds';

vi.mock('../api/compounds', () => ({ default: { post: vi.fn() } }));

const success = {
  status: 'ok',
  sql: 'SELECT category, count(*) FROM public.compounds GROUP BY category',
  explanation: 'Counts compounds by category.',
  columns: ['category', 'count'],
  rows: [['Antiviral', 40], ['Anticancer', 36]],
  row_count: 2,
  truncated: false,
  latency_ms: 120,
  model: 'fixture-model',
};

function submit() {
  render(<AskPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'How many compounds are in each category?' }));
  expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
}

describe('Ask the Data', () => {
  beforeEach(() => vi.resetAllMocks());

  it('disables Run during a request and renders a successful result', async () => {
    let resolve: (value: { data: typeof success }) => void = () => {};
    vi.mocked(api.post).mockReturnValue(new Promise(done => { resolve = done; }));
    submit();
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Generating');
    await act(async () => resolve({ data: success }));
    expect(screen.getByText(success.sql)).toBeVisible();
    expect(screen.getByText('Showing 2 rows')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Bar chart' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'count' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Anticancer');
    expect(screen.getByRole('columnheader', { name: 'count' })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('renders a friendly refusal', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'refuse', reason: 'Pick a compound metric.' } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Why was this refused? Pick a compound metric.');
  });

  it('hides raw errors', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('private connection details'));
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't run your question.");
    expect(screen.queryByText(/private connection details/)).not.toBeInTheDocument();
  });

  it('identifies truncated results', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...success, truncated: true } });
    submit();
    expect(await screen.findByText('Results truncated to 200 rows.')).toBeVisible();
  });

  it('shows the capacity state', async () => {
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { status: 'capacity', reason: 'Please try again later.' } },
    });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Demo capacity used up');
  });
});
