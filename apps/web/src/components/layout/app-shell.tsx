import { Sidebar } from './sidebar';
import { Header } from './header';
import { MainContent } from './main-content';
import type { SidebarNavigation } from '@/data/sidebar-navigation';

interface AppShellProps {
  children: React.ReactNode;
  navData?: SidebarNavigation | null;
}

export function AppShell({ children, navData }: AppShellProps) {
  return (
    <div data-testid="app-shell" className="flex h-dvh overflow-hidden">
      <Sidebar navData={navData} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
