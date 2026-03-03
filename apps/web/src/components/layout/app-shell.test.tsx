// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('renders without crashing', () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('contains sidebar, header, and main content areas', () => {
    render(<AppShell>Test content</AppShell>);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('renders children inside main content', () => {
    render(<AppShell><div data-testid="child">Hello</div></AppShell>);
    const main = screen.getByTestId('main-content');
    expect(main).toContainElement(screen.getByTestId('child'));
  });
});
