// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './header';
import { IntlWrapper } from '../../test-utils/intl-wrapper';

describe('Header', () => {
  it('renders with shell accent color background', () => {
    render(<IntlWrapper><Header /></IntlWrapper>);
    const header = screen.getByTestId('header');
    expect(header).toBeInTheDocument();
    expect(header.style.backgroundColor).toBe('var(--shell-accent)');
  });

  it('has CSS transition for smooth accent repainting', () => {
    render(<IntlWrapper><Header /></IntlWrapper>);
    const header = screen.getByTestId('header');
    expect(header.style.transition).toBe('background-color 150ms ease-in-out');
  });

  it('renders at 52px height', () => {
    render(<IntlWrapper><Header /></IntlWrapper>);
    const header = screen.getByTestId('header');
    expect(header.style.height).toBe('var(--header-height)');
  });

  it('shows Command Bar compact placeholder', () => {
    render(<IntlWrapper><Header /></IntlWrapper>);
    const commandBar = screen.getByTestId('command-bar-placeholder');
    expect(commandBar).toBeInTheDocument();
    expect(commandBar).toHaveTextContent('Search...');
    expect(commandBar).toHaveTextContent('⌘K');
  });
});
