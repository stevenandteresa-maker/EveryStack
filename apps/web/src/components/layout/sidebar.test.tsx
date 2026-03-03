// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './sidebar';
import { useSidebarStore } from '@/stores/sidebar-store';
import { IntlWrapper } from '@/test-utils/intl-wrapper';

describe('Sidebar', () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: true });
    localStorage.clear();
  });

  it('renders in collapsed state by default', () => {
    render(<IntlWrapper><Sidebar /></IntlWrapper>);
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar.style.width).toBe('var(--sidebar-width-collapsed)');
  });

  it('expands to 280px when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<IntlWrapper><Sidebar /></IntlWrapper>);

    const toggle = screen.getByTestId('sidebar-toggle');
    await user.click(toggle);

    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar.style.width).toBe('var(--sidebar-width-expanded)');
  });

  it('collapses back when toggle is clicked again', async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ collapsed: false });
    render(<IntlWrapper><Sidebar /></IntlWrapper>);

    const toggle = screen.getByTestId('sidebar-toggle');
    await user.click(toggle);

    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar.style.width).toBe('var(--sidebar-width-collapsed)');
  });

  it('shows navigation items with accessible labels', () => {
    render(<IntlWrapper><Sidebar /></IntlWrapper>);
    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspaces')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('shows labels when expanded', () => {
    useSidebarStore.setState({ collapsed: false });
    render(<IntlWrapper><Sidebar /></IntlWrapper>);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getAllByText('Workspaces').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });

  it('persists state to localStorage via Zustand', async () => {
    const user = userEvent.setup();
    render(<IntlWrapper><Sidebar /></IntlWrapper>);

    const toggle = screen.getByTestId('sidebar-toggle');
    await user.click(toggle);

    const stored = localStorage.getItem('everystack-sidebar');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string);
    expect(parsed.state.collapsed).toBe(false);
  });
});
