import { test, expect, AXE_TAGS, AXE_KNOWN_GAPS } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';

/**
 * The scanner itself, under test.
 *
 * Every other `a11y.spec.ts` in this project trusts `makeAxe()` to be looking at
 * the whole page. For the life of the suite it was not: `withTags` is a
 * whitelist, the four WCAG tags omitted `best-practice`, and **30 of axe-core's
 * 105 rules — 29% of the catalogue — never executed anywhere.** Nothing said so,
 * because nothing had been *disabled*; the hole was in what was never switched
 * on. A green scan of a route with no `<h1>`, no `<main>` and a nameless dialog
 * was the documented outcome (`ORT-117`).
 *
 * The two cases below are the guard that could have caught it. They assert the
 * scanner's own configuration and the fact that structural rules really run —
 * the one thing no product-facing a11y spec can observe about itself.
 */
test.describe('axe harness', () => {
    test.beforeEach(async ({ page, membersPage }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();
    });

    test('runs the structural ruleset, and excludes exactly the tracked debt', async ({
        makeAxe
    }) => {
        const results = await makeAxe().analyze();

        // What axe was *told*. Pinned rather than inferred, because the failure
        // this guards against is a tag silently going missing again.
        expect(results.toolOptions.runOnly).toEqual({
            type: 'tag',
            values: [...AXE_TAGS]
        });
        expect(Object.keys(results.toolOptions.rules ?? {}).sort()).toEqual(
            [...AXE_KNOWN_GAPS].sort()
        );
        for (const rule of AXE_KNOWN_GAPS) {
            expect(results.toolOptions.rules?.[rule]).toEqual({
                enabled: false
            });
        }

        // And what axe actually *did*. A rule appears in one of the four buckets
        // if and only if it executed, so this is the behavioural half: these six
        // are `best-practice`-only and every one of them was dead before.
        const evaluated = new Set(
            [
                ...results.passes,
                ...results.violations,
                ...results.incomplete,
                ...results.inapplicable
            ].map((r) => r.id)
        );
        for (const rule of [
            'skip-link',
            'tabindex',
            'landmark-unique',
            'landmark-no-duplicate-main',
            'presentation-role-conflict',
            'empty-heading'
        ]) {
            expect(evaluated, `${rule} did not run`).toContain(rule);
        }

        // The excluded five must be genuinely off, not merely quiet.
        for (const rule of AXE_KNOWN_GAPS) {
            expect(evaluated, `${rule} is excluded but ran`).not.toContain(
                rule
            );
        }
    });

    test('records what axe could not decide instead of discarding it', async ({
        page,
        makeAxe
    }) => {
        // A deterministic `incomplete`: text over a gradient is the canonical
        // case axe cannot resolve a background colour for. Injected rather than
        // found in the product, so this measures the harness and not whichever
        // page happens to be colour-heavy this month.
        await page.evaluate(() => {
            const scope = globalThis as unknown as {
                document: {
                    createElement(tag: string): {
                        textContent: string;
                        setAttribute(name: string, value: string): void;
                    };
                    body: { append(node: unknown): void };
                };
            };
            const node = scope.document.createElement('p');
            node.textContent = 'Unresolvable background';
            node.setAttribute(
                'style',
                'background-image:linear-gradient(90deg,#fff,#000);color:#777'
            );
            scope.document.body.append(node);
        });

        await expectNoA11yViolations(makeAxe());

        // The scan passed — and that is precisely the failure mode. Before this,
        // `analyze()`'s `incomplete` bucket was destructured away, so an
        // unmeasurable contrast pair left no trace anywhere in the report.
        const recorded = test
            .info()
            .annotations.filter((a) => a.type === 'axe-incomplete');
        expect(recorded).toHaveLength(1);
        expect(recorded[0].description).toContain('color-contrast');
    });
});
