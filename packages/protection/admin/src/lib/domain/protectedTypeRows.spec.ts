import { describe, expect, it } from 'vitest';
import { protectedTypeRows } from './protectedTypeRows';
import { blocksEveryone, DEFAULT_PROTECTION_RULE } from './types';

const type = (
    name: string,
    over: Partial<{ kind: string; label: string; publishable: boolean }> = {}
) => ({
    name,
    kind: 'collection',
    label: name,
    publishable: true,
    ...over
});

const rule = (slug: string, over: Record<string, unknown> = {}) => ({
    ...DEFAULT_PROTECTION_RULE,
    id: `r-${slug}`,
    kind: 'collection',
    slug,
    ...over
});

describe('protectedTypeRows', () => {
    /**
     * The list is the grants. A granted type nobody has protected has to be
     * there, or there is no way to protect the first one — and the tab would
     * only ever show what somebody had already switched on.
     */
    it('lists a granted type that holds no rule', () => {
        const { rows } = protectedTypeRows(['article'], [type('article')], []);
        expect(rows).toEqual([
            {
                slug: 'article',
                kind: 'collection',
                label: 'article',
                rule: null
            }
        ]);
    });

    it('attaches the rule a granted type holds', () => {
        const { rows } = protectedTypeRows(
            ['article'],
            [type('article')],
            [rule('article', { enabled: true, requiredApprovals: 2 })]
        );
        expect(rows[0].rule?.requiredApprovals).toBe(2);
    });

    /**
     * Protection guards `draft → published`. A type that is always live has no
     * transition to hold, so offering a rule for it would offer one that could
     * never fire — and the entry editor already renders nothing for it.
     */
    it('leaves out a non-publishable type', () => {
        const { rows } = protectedTypeRows(
            ['article', 'settings'],
            [type('article'), type('settings', { publishable: false })],
            []
        );
        expect(rows.map((row) => row.slug)).toEqual(['article']);
    });

    it('leaves out a granted slug no registered type matches', () => {
        const { rows } = protectedTypeRows(['ghost'], [type('article')], []);
        expect(rows).toEqual([]);
    });

    /**
     * The API returns these deliberately — they are the rows an administrator
     * needs in order to remove them. Dropping them here would leave a rule
     * nobody can see and nobody can delete.
     */
    it('reports a rule whose type is no longer granted, rather than hiding it', () => {
        const { rows, orphans } = protectedTypeRows(
            ['article'],
            [type('article')],
            [rule('article'), rule('legacy')]
        );
        expect(rows).toHaveLength(1);
        expect(orphans.map((entry) => entry.slug)).toEqual(['legacy']);
    });

    it('orders rows by label so the list does not move between reads', () => {
        const { rows } = protectedTypeRows(
            ['zeta', 'alpha'],
            [
                type('zeta', { label: 'Zeta' }),
                type('alpha', { label: 'Alpha' })
            ],
            []
        );
        expect(rows.map((row) => row.label)).toEqual(['Alpha', 'Zeta']);
    });

    it('falls back to the slug when a type carries no label', () => {
        const { rows } = protectedTypeRows(
            ['article'],
            [type('article', { label: '' })],
            []
        );
        expect(rows[0].label).toBe('article');
    });
});

/**
 * ADR-0017 accepts that a one-person workspace blocks itself and requires the
 * interface to say so **when the rule is switched on**. This is the predicate
 * that decides; the dialog's spec pins that it is announced.
 */
describe('blocksEveryone', () => {
    it('is true for a lone member with four eyes required', () => {
        expect(
            blocksEveryone({ ...DEFAULT_PROTECTION_RULE, enabled: true }, 1)
        ).toBe(true);
    });

    it('is false once a second person can approve', () => {
        expect(
            blocksEveryone({ ...DEFAULT_PROTECTION_RULE, enabled: true }, 2)
        ).toBe(false);
    });

    it('is false when the author may approve their own version', () => {
        expect(
            blocksEveryone(
                {
                    ...DEFAULT_PROTECTION_RULE,
                    enabled: true,
                    requireOtherPerson: false
                },
                1
            )
        ).toBe(false);
    });

    /** A switched-off rule protects nothing, so it cannot block anybody. */
    it('is false while the rule is switched off', () => {
        expect(blocksEveryone(DEFAULT_PROTECTION_RULE, 1)).toBe(false);
    });
});
