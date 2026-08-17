import { expect, test } from '@playwright/test';
import type AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

/** `rule (impact) — n node(s): help`, then one line per affected target. */
function summarize(results: Result[]): string {
    return results
        .map(
            (r) =>
                `• ${r.id} (${r.impact}) — ${r.nodes.length} node(s): ${r.help}\n` +
                r.nodes.map((n) => `    ${n.target.join(' ')}`).join('\n')
        )
        .join('\n');
}

/**
 * Run an axe scan and assert there are no violations. On failure the message is
 * a compact summary (rule id, impact, affected nodes, help) so the report is
 * readable without digging into the raw axe JSON.
 *
 * **`incomplete` is not a pass.** `analyze()` returns four buckets and this
 * helper used to destructure `violations` and drop the rest on the floor.
 * `incomplete` is axe's "I could not decide" bucket, and `color-contrast` is by
 * far its largest contributor: text over a gradient, over an image, over a
 * semi-transparent overlay, or over a background axe cannot resolve lands there
 * rather than in `violations`. Every such element was reported as clean — which
 * is how a `text-sidebar-foreground/70` over `bg-sidebar-accent/40` shipped
 * under a green suite (`ORT-117`).
 *
 * It cannot simply *fail*: the bucket is genuinely undecidable and the honest
 * answer needs a human (the painted-pixel measurement in
 * `host/platform-preferences.spec.ts` is what that looks like). So it is
 * **recorded** instead — as a test annotation, which lands in the HTML report
 * next to the case, and folded into the failure message when there is one. A
 * discarded result no longer looks like a pass.
 *
 * Automated scans catch only a fraction of WCAG issues — a green result is a
 * regression guard, not a conformance claim.
 */
export async function expectNoA11yViolations(axe: AxeBuilder): Promise<void> {
    const { violations, incomplete } = await axe.analyze();

    if (incomplete.length > 0) {
        test.info().annotations.push({
            type: 'axe-incomplete',
            description: summarize(incomplete)
        });
    }

    const summary = summarize(violations);
    const message = summary
        ? incomplete.length > 0
            ? `${summary}\n\naxe could not decide about (not counted as failures):\n${summarize(
                  incomplete
              )}`
            : summary
        : 'no violations';

    expect(summary, message).toBe('');
}
