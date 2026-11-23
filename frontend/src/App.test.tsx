import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import api from './api/compounds';

vi.mock('./api/compounds', () => ({ default: { get: vi.fn() } }));
vi.mock('./components/Dashboard', () => ({
  default: ({ askEnabled }: { askEnabled: boolean }) => <main>{askEnabled && <a href="#ask">Ask the Data</a>}</main>,
}));
vi.mock('./components/AskPanel', () => ({ default: () => <main>Interactive Ask</main> }));

const status = vi.mocked(api.get);

describe('Ask availability', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('shows the entry only after the API confirms true', async () => {
    status.mockResolvedValue({ data: { enabled: true } });
    render(<App />);
    expect(screen.queryByRole('link', { name: 'Ask the Data' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Ask the Data' })).toBeVisible();
    expect(status).toHaveBeenCalledWith('/api/ask/status', expect.anything());
  });

  it.each([404, 503])('shows the paused card if status fails with %s', async (code) => {
    window.history.replaceState(null, '', '/#ask');
    status.mockRejectedValue({ response: { status: code } });
    render(<App />);
    await waitFor(() => expect(status).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: 'Ask the Data is paused' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Back to the explorer/ })).toHaveAttribute('href', '#');
    expect(screen.queryByText('Interactive Ask')).not.toBeInTheDocument();
  });

  it('fails closed for a non-boolean response', async () => {
    status.mockResolvedValue({ data: { enabled: 'true' } });
    render(<App />);
    await waitFor(() => expect(status).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Ask the Data' })).not.toBeInTheDocument();
  });
});
