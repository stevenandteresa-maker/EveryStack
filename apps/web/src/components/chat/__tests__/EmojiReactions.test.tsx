// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import { EmojiReactions, type ReactionsMap } from '../EmojiReactions';

// Mock EmojiPicker to avoid loading emoji-mart in tests
vi.mock('../EmojiPicker', () => ({
  EmojiPicker: ({
    children,
    onSelect,
    open,
  }: {
    children: React.ReactNode;
    onSelect: (emoji: string) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="mock-emoji-picker" data-open={open}>
      {children}
      {open && (
        <button
          data-testid="mock-emoji-select"
          onClick={() => onSelect('🎉')}
        >
          select emoji
        </button>
      )}
    </div>
  ),
}));

const CURRENT_USER = 'user-1';

function renderReactions(
  reactions: ReactionsMap,
  overrides?: Partial<React.ComponentProps<typeof EmojiReactions>>,
) {
  const onToggle = vi.fn();
  const result = render(
    <IntlWrapper>
      <EmojiReactions
        reactions={reactions}
        currentUserId={CURRENT_USER}
        onToggle={onToggle}
        {...overrides}
      />
    </IntlWrapper>,
  );
  return { ...result, onToggle };
}

describe('EmojiReactions', () => {
  it('renders reaction chips with emoji and count', () => {
    renderReactions({ '👍': ['user-1', 'user-2'], '❤️': ['user-3'] });
    const thumbs = screen.getByTestId('reaction-chip-👍');
    expect(thumbs).toHaveTextContent('👍');
    expect(thumbs).toHaveTextContent('2');
    const heart = screen.getByTestId('reaction-chip-❤️');
    expect(heart).toHaveTextContent('❤️');
    expect(heart).toHaveTextContent('1');
  });

  it('highlights chip when current user has reacted', () => {
    renderReactions({ '👍': ['user-1'] });
    const chip = screen.getByTestId('reaction-chip-👍');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip.className).toContain('bg-teal-50');
  });

  it('does not highlight chip when current user has not reacted', () => {
    renderReactions({ '👍': ['user-2'] });
    const chip = screen.getByTestId('reaction-chip-👍');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onToggle when chip is clicked', () => {
    const { onToggle } = renderReactions({ '👍': ['user-1'] });
    fireEvent.click(screen.getByTestId('reaction-chip-👍'));
    expect(onToggle).toHaveBeenCalledWith('👍');
  });

  it('renders add reaction button', () => {
    renderReactions({ '👍': ['user-1'] });
    expect(screen.getByTestId('add-reaction-button')).toBeInTheDocument();
  });

  it('returns null when no reactions', () => {
    const { container } = renderReactions({});
    expect(container.firstChild).toBeNull();
  });

  it('filters out reactions with empty user arrays', () => {
    renderReactions({ '👍': [], '❤️': ['user-1'] });
    expect(screen.queryByTestId('reaction-chip-👍')).not.toBeInTheDocument();
    expect(screen.getByTestId('reaction-chip-❤️')).toBeInTheDocument();
  });

  it('renders picker component for add reaction', () => {
    renderReactions({ '👍': ['user-1'] });
    expect(screen.getByTestId('mock-emoji-picker')).toBeInTheDocument();
  });
});
