// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';
import { IntlWrapper } from '@/test-utils/intl-wrapper';

// Mock Clerk (required by SidebarHeader + TenantSwitcher via Sidebar)
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { fullName: 'Test User', imageUrl: null }, isLoaded: true }),
  useClerk: () => ({ setActive: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

describe('AppShell', () => {
  it('renders without crashing', () => {
    render(<IntlWrapper><AppShell>Content</AppShell></IntlWrapper>);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('contains sidebar, header, and main content areas', () => {
    render(<IntlWrapper><AppShell>Test content</AppShell></IntlWrapper>);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('renders children inside main content', () => {
    render(<IntlWrapper><AppShell><div data-testid="child">Hello</div></AppShell></IntlWrapper>);
    const main = screen.getByTestId('main-content');
    expect(main).toContainElement(screen.getByTestId('child'));
  });
});
