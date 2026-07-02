import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it.each(['primary', 'secondary', 'danger'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>{variant} action</Button>);

    expect(screen.getByRole('button', { name: `${variant} action` })).toBeInTheDocument();
  });

  it('shows a loading spinner and disables the button while loading', () => {
    render(<Button loading>Save compound</Button>);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save compound/i })).toBeDisabled();
  });

  it('is disabled when disabled is true', () => {
    render(<Button disabled>Delete compound</Button>);

    expect(screen.getByRole('button', { name: /delete compound/i })).toBeDisabled();
  });
});
