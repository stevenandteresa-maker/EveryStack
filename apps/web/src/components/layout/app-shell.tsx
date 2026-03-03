import { Sidebar } from './sidebar';
import { Header } from './header';
import { MainContent } from './main-content';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div data-testid="app-shell" className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
