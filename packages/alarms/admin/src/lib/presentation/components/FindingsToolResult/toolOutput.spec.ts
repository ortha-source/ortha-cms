import { ageBarWidth, oldestOf, readToolFindings } from './toolOutput';

const item = (overrides: Record<string, unknown> = {}) => ({
    title: 'Author is not published',
    rule: 'Relations point at published records',
    severity: 'warn',
    contentType: 'article',
    entryId: 'entry-1',
    openForDays: 4,
    ...overrides
});

const payload = (overrides: Record<string, unknown> = {}) => ({
    items: [item()],
    total: 14,
    bySeverity: { error: 2, warn: 5, info: 7 },
    page: 1,
    pageSize: 10,
    ...overrides
});

describe('readToolFindings', () => {
    it('reads a well-formed result', () => {
        const read = readToolFindings(payload());
        expect(read).not.toBeNull();
        expect(read?.total).toBe(14);
        expect(read?.bySeverity).toEqual({ error: 2, warn: 5, info: 7 });
        expect(read?.items[0]).toEqual({
            title: 'Author is not published',
            rule: 'Relations point at published records',
            severity: 'warn',
            contentType: 'article',
            entryId: 'entry-1',
            openForDays: 4
        });
    });

    it('ignores a mute left over from an older payload', () => {
        // Muting is gone. A transcript replayed from history still carries it,
        // and the renderer must simply not care rather than fall through to the
        // raw JSON over a key it no longer models.
        const read = readToolFindings(
            payload({
                items: [item({ muted: true, mutedReason: 'a stub on purpose' })]
            })
        );
        expect(read?.items).toHaveLength(1);
        expect(read?.items[0]).not.toHaveProperty('muted');
        expect(read?.items[0]).not.toHaveProperty('mutedReason');
    });

    // ---------------------------------------------------------------- refusal
    //
    // A transcript is replayed from stored history, so a result written by an
    // older build of the tool reaches today's renderer. Every one of these
    // returns `null` so `ToolStep` falls through to the raw payload it would
    // have shown anyway — a JSON blob is a far better outcome than a crashed
    // conversation.

    it('refuses anything that is not an object with items', () => {
        expect(readToolFindings(null)).toBeNull();
        expect(readToolFindings(undefined)).toBeNull();
        expect(readToolFindings('nope')).toBeNull();
        expect(readToolFindings(42)).toBeNull();
        expect(readToolFindings([])).toBeNull();
        expect(readToolFindings({})).toBeNull();
        expect(readToolFindings({ items: 'not an array' })).toBeNull();
    });

    it('drops a row whose severity this build does not know', () => {
        // Rendering it under the wrong severity would be worse than not
        // rendering it: the header's count comes from `bySeverity`, so the
        // total stays honest either way.
        const read = readToolFindings(
            payload({
                items: [item(), item({ severity: 'catastrophe' })]
            })
        );
        expect(read?.items).toHaveLength(1);
        expect(read?.total).toBe(14);
    });

    it('drops a row that is not an object', () => {
        const read = readToolFindings(
            payload({ items: [item(), null, 'x', 7] })
        );
        expect(read?.items).toHaveLength(1);
    });

    it('coerces missing scalars rather than rendering undefined', () => {
        const read = readToolFindings(
            payload({ items: [{ severity: 'error' }] })
        );
        expect(read?.items[0]).toEqual({
            title: '',
            rule: '',
            severity: 'error',
            contentType: '',
            entryId: '',
            openForDays: 0
        });
    });

    it('falls back to the page length when an older payload has no total', () => {
        // Reporting zero would make the header say "Nothing flagged" over a
        // list of findings — a contradiction on screen.
        const read = readToolFindings({ items: [item(), item()] });
        expect(read?.total).toBe(2);
    });

    it('defaults a missing severity tally to zeroes', () => {
        const read = readToolFindings({ items: [item()], total: 1 });
        expect(read?.bySeverity).toEqual({ error: 0, warn: 0, info: 0 });
    });

    it('survives a NaN or non-numeric count', () => {
        const read = readToolFindings(
            payload({
                total: 'many',
                bySeverity: { error: 'two', warn: null, info: 7 },
                items: [item({ openForDays: 'ages' })]
            })
        );
        expect(read?.total).toBe(1);
        expect(read?.bySeverity).toEqual({ error: 0, warn: 0, info: 7 });
        expect(read?.items[0].openForDays).toBe(0);
    });
});

describe('ageBarWidth', () => {
    it('scales against the oldest finding in the set', () => {
        expect(ageBarWidth(50, 100)).toBe(50);
        expect(ageBarWidth(100, 100)).toBe(100);
        expect(ageBarWidth(25, 100)).toBe(25);
    });

    it('gives a brand-new finding a visible floor rather than nothing', () => {
        // The row means "this exists and is new", not "this has no age".
        expect(ageBarWidth(0, 100)).toBe(4);
    });

    it('shows a full bar when every finding is the same age', () => {
        expect(ageBarWidth(7, 7)).toBe(100);
    });

    it('does not divide by zero when everything was flagged today', () => {
        expect(ageBarWidth(0, 0)).toBe(4);
        expect(Number.isFinite(ageBarWidth(0, 0))).toBe(true);
    });

    it('clamps a negative age instead of drawing a negative width', () => {
        expect(ageBarWidth(-5, 100)).toBe(4);
    });
});

describe('oldestOf', () => {
    it('finds the largest age', () => {
        expect(
            oldestOf([
                { openForDays: 3 },
                { openForDays: 94 },
                { openForDays: 12 }
            ] as never)
        ).toBe(94);
    });

    it('is zero for an empty set', () => {
        expect(oldestOf([])).toBe(0);
    });
});
