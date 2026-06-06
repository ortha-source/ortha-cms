import { expect } from '@playwright/test';
import type AxeBuilder from '@axe-core/playwright';

/**
 * Run an axe scan and assert there are no violations. On failure the message is
 * a compact summary (rule id, impact, affected nodes, help) so the report is
 * readable without digging into the raw axe JSON.
 *
 * Automated scans catch only a fraction of WCAG issues — a green result is a
 * regression guard, not a conformance claim.
 */
export async function expectNoA11yViolations(axe: AxeBuilder): Promise<void> {
    const { violations } = await axe.analyze();

    const summary = violations
        .map(
            (v) =>
                `• ${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.help}\n` +
                v.nodes.map((n) => `    ${n.target.join(' ')}`).join('\n')
        )
        .join('\n');

    expect(summary, summary || 'no violations').toBe('');
}
