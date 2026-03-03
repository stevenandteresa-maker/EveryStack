// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './header';

describe('Header', () => {
  it('renders with accent color background', () => {
    render(<Header />);
    const header = screen.getByTestId('header');
    expect(header).toBeInTheDocument();
    expect(header.style.backgroundColor).toBe('var(--workspace-accent)');
  });

  it('renders at 52px height', () => {
    render(<Header />);
    const header = screen.getByTestId('header');
    expect(header.style.height).toBe('var(--header-height)');
  });

  it('shows Command Bar compact placeholder', () => {
    render(<Header />);
    const commandBar = screen.getByTestId('command-bar-placeholder');
    expect(commandBar).toBeInTheDocument();
    expect(commandBar).toHaveTextContent('Search...');
    expect(commandBar).toHaveTextContent('⌘K');
  });
});
