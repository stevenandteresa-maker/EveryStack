// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformBadge } from '../PlatformBadge';

describe('PlatformBadge', () => {
  it('renders Airtable badge with correct test ID', () => {
    render(<PlatformBadge platform="airtable" />);
    expect(screen.getByTestId('platform-badge-airtable')).toBeInTheDocument();
  });

  it('renders Notion badge with correct test ID', () => {
    render(<PlatformBadge platform="notion" />);
    expect(screen.getByTestId('platform-badge-notion')).toBeInTheDocument();
  });

  it('renders SmartSuite badge with correct test ID', () => {
    render(<PlatformBadge platform="smartsuite" />);
    expect(screen.getByTestId('platform-badge-smartsuite')).toBeInTheDocument();
  });

  it('renders nothing for null platform (native table)', () => {
    const { container } = render(<PlatformBadge platform={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('has white border for visual separation', () => {
    render(<PlatformBadge platform="airtable" />);
    const badge = screen.getByTestId('platform-badge-airtable');
    expect(badge.className).toContain('border-white');
  });

  it('is positioned absolute for overlay placement', () => {
    render(<PlatformBadge platform="notion" />);
    const badge = screen.getByTestId('platform-badge-notion');
    expect(badge.className).toContain('absolute');
  });

  it('contains an SVG element', () => {
    render(<PlatformBadge platform="airtable" />);
    const badge = screen.getByTestId('platform-badge-airtable');
    const svg = badge.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('SVGs have aria-hidden for accessibility', () => {
    render(<PlatformBadge platform="airtable" />);
    const badge = screen.getByTestId('platform-badge-airtable');
    const svg = badge.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
