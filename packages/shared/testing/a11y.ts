import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

interface CheckAccessibilityOptions {
  /** CSS selectors to exclude from the accessibility check. */
  excludeSelectors?: string[];
  /** axe-core rule tags to check. Defaults to WCAG 2.1 AA. */
  tags?: string[];
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

/**
 * Runs an axe-core accessibility check on the given Playwright page.
 *
 * Defaults to WCAG 2.1 AA compliance tags. Throws with a formatted
 * violation report if any violations are found.
 *
 * Usage:
 * ```ts
 * test('page passes a11y', async ({ page }) => {
 *   await page.goto('/dashboard');
 *   await checkAccessibility(page);
 * });
 * ```
 */
export async function checkAccessibility(
  page: Page,
  options?: CheckAccessibilityOptions,
): Promise<void> {
  const tags = options?.tags ?? DEFAULT_TAGS;

  let builder = new AxeBuilder({ page }).withTags(tags);

  if (options?.excludeSelectors) {
    for (const selector of options.excludeSelectors) {
      builder = builder.exclude(selector);
    }
  }

  const results = await builder.analyze();

  if (results.violations.length > 0) {
    const report = results.violations
      .map((v) => {
        const nodes = v.nodes
          .map((n) => `    - ${n.html}\n      ${n.failureSummary}`)
          .join('\n');
        return `[${v.impact}] ${v.id}: ${v.description}\n  Help: ${v.helpUrl}\n  Nodes:\n${nodes}`;
      })
      .join('\n\n');

    expect(
      results.violations,
      `Accessibility violations found:\n\n${report}`,
    ).toEqual([]);
  }
}
