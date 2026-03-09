// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceTree } from '../WorkspaceTree';
import type { BoardNavGroup, WorkspaceNavEntry } from '../../../data/sidebar-navigation';

const boards: BoardNavGroup[] = [
  {
    boardId: 'board-1',
    boardName: 'Marketing',
    workspaces: [
      { workspaceId: 'ws-1', workspaceName: 'Campaigns', icon: null },
      { workspaceId: 'ws-2', workspaceName: 'Social', icon: null },
    ],
  },
];

const ungrouped: WorkspaceNavEntry[] = [
  { workspaceId: 'ws-3', workspaceName: 'General', icon: null },
];

describe('WorkspaceTree', () => {
  it('renders board groups with workspace items', () => {
    render(<WorkspaceTree boards={boards} workspaces={[]} />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
  });

  it('renders ungrouped workspaces', () => {
    render(<WorkspaceTree boards={[]} workspaces={ungrouped} />);
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('renders both board groups and ungrouped workspaces', () => {
    render(<WorkspaceTree boards={boards} workspaces={ungrouped} />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('collapses and expands board groups', async () => {
    const user = userEvent.setup();
    render(<WorkspaceTree boards={boards} workspaces={[]} />);

    // Initially expanded
    expect(screen.getByText('Campaigns')).toBeInTheDocument();

    // Click board header to collapse
    await user.click(screen.getByTestId('board-group-board-1'));
    expect(screen.queryByText('Campaigns')).not.toBeInTheDocument();

    // Click again to expand
    await user.click(screen.getByTestId('board-group-board-1'));
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
  });

  it('highlights active workspace', () => {
    render(
      <WorkspaceTree boards={[]} workspaces={ungrouped} activeWorkspaceId="ws-3" />,
    );

    const item = screen.getByTestId('workspace-item-ws-3');
    expect(item.className).toContain('font-semibold');
  });

  it('does not highlight inactive workspace', () => {
    render(
      <WorkspaceTree boards={[]} workspaces={ungrouped} activeWorkspaceId="ws-other" />,
    );

    const item = screen.getByTestId('workspace-item-ws-3');
    expect(item.className).not.toContain('font-semibold');
  });
});
