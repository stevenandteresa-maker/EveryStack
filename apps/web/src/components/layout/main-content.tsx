interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  return (
    <main
      data-testid="main-content"
      className="flex-1 overflow-auto bg-[var(--content-bg)]"
    >
      {children}
    </main>
  );
}
