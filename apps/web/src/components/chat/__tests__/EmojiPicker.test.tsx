// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';

// Mock emoji-mart since it requires browser APIs not available in JSDOM
vi.mock('@emoji-mart/react', () => ({
  default: ({
    onEmojiSelect,
    title,
    searchPosition,
    skinTonePosition,
  }: {
    onEmojiSelect: (emoji: { native: string; id: string }) => void;
    title: string;
    searchPosition: string;
    skinTonePosition: string;
  }) => (
    <div
      data-testid="emoji-mart-picker"
      data-title={title}
      data-search-position={searchPosition}
      data-skin-tone-position={skinTonePosition}
    >
      <button
        data-testid="emoji-mart-select"
        onClick={() =>
          onEmojiSelect({ native: '👍', id: '+1' })
        }
      >
        select
      </button>
    </div>
  ),
}));

vi.mock('@emoji-mart/data', () => ({
  default: {},
}));

const { EmojiPicker } = await import('../EmojiPicker');

describe('EmojiPicker', () => {
  it('renders emoji-mart picker inside popover when open', () => {
    render(
      <IntlWrapper>
        <EmojiPicker onSelect={vi.fn()} open onOpenChange={vi.fn()}>
          <button>trigger</button>
        </EmojiPicker>
      </IntlWrapper>,
    );
    expect(screen.getByTestId('emoji-mart-picker')).toBeInTheDocument();
  });

  it('passes search and skin tone configuration', () => {
    render(
      <IntlWrapper>
        <EmojiPicker onSelect={vi.fn()} open onOpenChange={vi.fn()}>
          <button>trigger</button>
        </EmojiPicker>
      </IntlWrapper>,
    );
    const picker = screen.getByTestId('emoji-mart-picker');
    expect(picker).toHaveAttribute('data-search-position', 'sticky');
    expect(picker).toHaveAttribute('data-skin-tone-position', 'search');
  });

  it('calls onSelect with native emoji on selection', () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <IntlWrapper>
        <EmojiPicker onSelect={onSelect} open onOpenChange={onOpenChange}>
          <button>trigger</button>
        </EmojiPicker>
      </IntlWrapper>,
    );
    screen.getByTestId('emoji-mart-select').click();
    expect(onSelect).toHaveBeenCalledWith('👍');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders trigger as child', () => {
    render(
      <IntlWrapper>
        <EmojiPicker onSelect={vi.fn()}>
          <button data-testid="trigger-btn">Pick emoji</button>
        </EmojiPicker>
      </IntlWrapper>,
    );
    expect(screen.getByTestId('trigger-btn')).toBeInTheDocument();
  });
});
