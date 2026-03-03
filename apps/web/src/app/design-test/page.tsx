import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function DesignTestPage() {
  return (
    <div className="min-h-screen bg-[var(--content-bg)] p-8">
      <h1 className="text-page-title text-[var(--text-primary)] mb-8">
        Design System Verification
      </h1>

      {/* ── Section 1: Typography Scale ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">Typography Scale (9 levels)</h2>
        <div className="space-y-2">
          <p className="text-page-title">page-title — 28px / 700</p>
          <p className="text-h1">h1 — 24px / 700</p>
          <p className="text-h2">h2 — 20px / 600</p>
          <p className="text-h3">h3 — 18px / 600</p>
          <p className="text-body-lg">body-lg — 16px / 400</p>
          <p className="text-body">body — 14px / 400</p>
          <p className="text-body-sm">body-sm — 13px / 400</p>
          <p className="text-caption">caption — 12px / 400</p>
          <p className="text-timestamp">timestamp — 11px / 400</p>
        </div>
        <div className="mt-4 p-4 bg-[var(--panel-bg)] rounded">
          <p className="font-mono text-body-sm text-[var(--text-secondary)]">
            This line uses JetBrains Mono (font-mono)
          </p>
        </div>
      </section>

      {/* ── Section 2: Buttons ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">Buttons (3 core variants)</h2>
        <div className="flex gap-4 items-center">
          <Button variant="primary">Primary (dark)</Button>
          <Button variant="default">Default (outlined)</Button>
          <Button variant="ghost">Ghost (transparent)</Button>
        </div>
        <div className="flex gap-4 items-center mt-4">
          <Button variant="primary" size="sm">Primary sm</Button>
          <Button variant="default" size="sm">Default sm</Button>
          <Button variant="ghost" size="sm">Ghost sm</Button>
        </div>
        <div className="flex gap-4 items-center mt-4">
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link variant</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      {/* ── Section 3: Card ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">Card</h2>
        <div className="max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>
                Card with rounded corners and subtle border. Hover for elevated shadow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-body text-[var(--text-secondary)]">
                Cards use --card-bg (white), --border-default, and the --shadow-elevated
                on hover. Padding is 20px (card-padding token).
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Section 4: Badges ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">Badges</h2>
        <div className="flex gap-3 items-center flex-wrap">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      {/* ── Section 5: Input ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">Input</h2>
        <div className="max-w-sm space-y-4">
          <Input placeholder="Click to see blue focus ring..." />
          <Input placeholder="Disabled input" disabled />
        </div>
      </section>

      {/* ── Section 6: Color Tokens ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">Color Tokens</h2>

        <h3 className="text-h3 text-[var(--text-primary)] mb-3">Surface Colors</h3>
        <div className="flex gap-3 flex-wrap mb-6">
          <div className="w-24 h-24 rounded bg-[var(--sidebar-bg)] flex items-center justify-center">
            <span className="text-caption text-white">sidebar-bg</span>
          </div>
          <div className="w-24 h-24 rounded bg-[var(--content-bg)] border border-[var(--border-default)] flex items-center justify-center">
            <span className="text-caption">content-bg</span>
          </div>
          <div className="w-24 h-24 rounded bg-[var(--panel-bg)] flex items-center justify-center">
            <span className="text-caption">panel-bg</span>
          </div>
          <div className="w-24 h-24 rounded bg-[var(--card-bg)] border border-[var(--border-default)] flex items-center justify-center">
            <span className="text-caption">card-bg</span>
          </div>
        </div>

        <h3 className="text-h3 text-[var(--text-primary)] mb-3">Text Colors</h3>
        <div className="space-y-1 mb-6">
          <p className="text-body text-[var(--text-primary)]">text-primary — #0F172A</p>
          <p className="text-body text-[var(--text-secondary)]">text-secondary — #475569</p>
          <p className="text-body text-[var(--text-tertiary)]">text-tertiary — #94A3B8</p>
        </div>

        <h3 className="text-h3 text-[var(--text-primary)] mb-3">State Colors</h3>
        <div className="flex gap-3 mb-6">
          <div className="px-4 py-2 rounded bg-[var(--success)] text-white text-caption font-semibold">Success</div>
          <div className="px-4 py-2 rounded bg-[var(--warning)] text-white text-caption font-semibold">Warning</div>
          <div className="px-4 py-2 rounded bg-[var(--error)] text-white text-caption font-semibold">Error</div>
        </div>

        <h3 className="text-h3 text-[var(--text-primary)] mb-3">Accent (Teal default)</h3>
        <div className="flex gap-3">
          <div className="px-6 py-3 rounded bg-[var(--workspace-accent)] text-white text-body font-semibold">
            Accent Header Bar
          </div>
        </div>
      </section>

      {/* ── Section 7: Spacing & Border Radius ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">Spacing & Border Radius</h2>
        <div className="flex gap-4 items-end mb-6">
          <div className="w-8 h-8 bg-[var(--text-tertiary)] rounded-sm" title="rounded-sm (4px)" />
          <div className="w-8 h-8 bg-[var(--text-tertiary)] rounded" title="rounded (8px)" />
          <div className="w-8 h-8 bg-[var(--text-tertiary)] rounded-lg" title="rounded-lg (12px)" />
          <div className="w-8 h-8 bg-[var(--text-tertiary)] rounded-xl" title="rounded-xl" />
          <div className="w-8 h-8 bg-[var(--text-tertiary)] rounded-full" title="rounded-full" />
        </div>
        <p className="text-body-sm text-[var(--text-secondary)]">
          sm=4px, DEFAULT=8px, lg=12px, xl=calc(0.5rem+4px), full
        </p>
      </section>

      {/* ── Section 8: CSS Custom Properties Check ── */}
      <section className="mb-12">
        <h2 className="text-h2 text-[var(--text-primary)] mb-4">CSS Custom Properties</h2>
        <p className="text-body text-[var(--text-secondary)] mb-2">
          Open DevTools → Elements → select :root → check Styles panel for these variables:
        </p>
        <div className="p-4 bg-[var(--panel-bg)] rounded font-mono text-body-sm space-y-1">
          <p>--sidebar-bg, --content-bg, --panel-bg, --card-bg</p>
          <p>--border-default, --border-subtle, --bg-elevated</p>
          <p>--text-primary, --text-secondary, --text-tertiary</p>
          <p>--success, --warning, --error</p>
          <p>--workspace-accent</p>
          <p>--shadow-elevated</p>
          <p>--sidebar-width-collapsed, --sidebar-width-expanded</p>
          <p>--header-height</p>
          <p>--font-sans (DM Sans), --font-mono (JetBrains Mono)</p>
        </div>
      </section>
    </div>
  );
}
