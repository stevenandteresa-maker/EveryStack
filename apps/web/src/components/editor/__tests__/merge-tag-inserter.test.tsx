// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MergeTagInserter } from '../sidebar/MergeTagInserter';
import type { Editor } from '@tiptap/core';
import type { MergeTagFieldGroup } from '../hooks/use-merge-tag-fields';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Merge Tags',
      searchPlaceholder: 'Search fields…',
      noFields: 'No fields available',
      insert: 'Insert',
    };
    return translations[key] ?? key;
  },
}));

// Mock shadcn components
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="search-input" {...props} />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="scroll-area" {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => <div data-testid="skeleton" {...(props as React.HTMLAttributes<HTMLDivElement>)} />,
}));

function createMockEditor(): Editor {
  const chain = {
    focus: vi.fn().mockReturnThis(),
    insertMergeTag: vi.fn().mockReturnThis(),
    run: vi.fn(),
  };
  return {
    chain: () => chain,
    _chain: chain,
  } as unknown as Editor & { _chain: typeof chain };
}

const SAMPLE_GROUPS: MergeTagFieldGroup[] = [
  {
    tableId: 'table-1',
    tableName: 'Contacts',
    isLinked: false,
    fields: [
      { fieldId: 'f1', tableId: 'table-1', fieldName: 'Name', fieldType: 'text', isLinked: false },
      { fieldId: 'f2', tableId: 'table-1', fieldName: 'Email', fieldType: 'email', isLinked: false },
      { fieldId: 'f3', tableId: 'table-1', fieldName: 'Phone', fieldType: 'phone', isLinked: false },
    ],
  },
  {
    tableId: 'table-2',
    tableName: 'Companies',
    isLinked: true,
    crossLinkId: 'cl-1',
    fields: [
      { fieldId: 'f4', tableId: 'table-2', fieldName: 'Company Name', fieldType: 'text', isLinked: true, crossLinkId: 'cl-1' },
      { fieldId: 'f5', tableId: 'table-2', fieldName: 'Revenue', fieldType: 'currency', isLinked: true, crossLinkId: 'cl-1' },
    ],
  },
];

describe('MergeTagInserter', () => {
  it('shows skeleton loading state', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={[]} isLoading={true} />,
    );

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders field groups with table names', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    expect(screen.getByText('Contacts')).toBeDefined();
    expect(screen.getByText('Companies')).toBeDefined();
  });

  it('renders fields within groups', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Email')).toBeDefined();
    expect(screen.getByText('Company Name')).toBeDefined();
    expect(screen.getByText('Revenue')).toBeDefined();
  });

  it('inserts merge tag on field click', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    fireEvent.click(screen.getByText('Name'));

    const chain = (editor as unknown as { _chain: Record<string, ReturnType<typeof vi.fn>> })._chain;
    expect(chain.focus).toHaveBeenCalled();
    expect(chain.insertMergeTag).toHaveBeenCalledWith({
      tableId: 'table-1',
      fieldId: 'f1',
      fallback: 'Name',
    });
    expect(chain.run).toHaveBeenCalled();
  });

  it('filters fields by search query', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'email' } });

    expect(screen.getByText('Email')).toBeDefined();
    expect(screen.queryByText('Name')).toBeNull();
    expect(screen.queryByText('Company Name')).toBeNull();
  });

  it('shows no-fields message when search has no results', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'zzzzzznonexistent' } });

    expect(screen.getByText('No fields available')).toBeDefined();
  });

  it('collapses and expands groups on header click', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    // Fields visible initially
    expect(screen.getByText('Name')).toBeDefined();

    // Click group header to collapse
    fireEvent.click(screen.getByText('Contacts'));

    // Fields should be hidden
    expect(screen.queryByText('Name')).toBeNull();
    expect(screen.queryByText('Email')).toBeNull();

    // Click again to expand
    fireEvent.click(screen.getByText('Contacts'));
    expect(screen.getByText('Name')).toBeDefined();
  });

  it('shows field count in group header', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    // Contacts has 3 fields, Companies has 2
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renders title text', () => {
    const editor = createMockEditor();
    render(
      <MergeTagInserter editor={editor} groups={SAMPLE_GROUPS} isLoading={false} />,
    );

    expect(screen.getByText('Merge Tags')).toBeDefined();
  });
});
