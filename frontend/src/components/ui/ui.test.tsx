import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState, RiskBadge, SeverityBadge } from './index';

describe('RiskBadge', () => {
  it('renders the score and low level for a small score', () => {
    render(<RiskBadge score={10} />);
    const badge = screen.getByTestId('risk-badge');
    expect(badge).toHaveAttribute('data-level', 'low');
    expect(badge).toHaveTextContent('10');
    expect(badge).toHaveTextContent('Low');
  });

  it('renders high level for a large score', () => {
    render(<RiskBadge score={90} />);
    expect(screen.getByTestId('risk-badge')).toHaveAttribute('data-level', 'high');
  });
});

describe('SeverityBadge', () => {
  it('renders the severity label', () => {
    render(<SeverityBadge severity="medium" />);
    expect(screen.getByTestId('severity-badge')).toHaveTextContent('medium');
  });
});

describe('EmptyState', () => {
  it('renders title and message', () => {
    render(<EmptyState title="Nothing here" message="No data yet" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });
});
