import { isUniqueViolation } from './unique-violation';

const SLUG_CONSTRAINT = 'workspaces_slug_unique';

/** A driver error as `pg` raises it, optionally wrapped `depth` times over. */
function pgError(
    fields: { code?: string; constraint?: string },
    depth = 0
): unknown {
    let error: unknown = { ...fields, message: 'duplicate key value' };
    for (let level = 0; level < depth; level += 1) {
        error = Object.assign(new Error('Failed query'), { cause: error });
    }
    return error;
}

/**
 * The other half of a read-then-write uniqueness check.
 *
 * The availability probe that runs before the insert is racy by construction —
 * two concurrent creates both read "free" and both proceed — so the unique
 * index is the only real arbiter, and the loser's rejection has to be
 * recognised *here* or it escapes as a 500 for what is an ordinary collision.
 *
 * Recognising it means walking a `cause` chain, because Drizzle wraps the
 * driver error and the nesting depth is the driver's business, not ours. Two
 * things follow, and both are asserted below: the walk must not care how deep
 * the fields are, and it must not care what shape the chain is — a cyclic
 * `cause` (a wrapper that references itself, or two errors that reference each
 * other) would otherwise spin forever inside a `catch` block, turning a 409
 * into a hung request holding an open transaction.
 */
describe('isUniqueViolation', () => {
    describe('matches', () => {
        it.each([[0], [1], [2], [5]])(
            'the slug constraint wrapped %i levels deep',
            (depth) => {
                expect(
                    isUniqueViolation(
                        pgError(
                            {
                                code: '23505',
                                constraint: SLUG_CONSTRAINT
                            },
                            depth
                        ),
                        SLUG_CONSTRAINT
                    )
                ).toBe(true);
            }
        );

        it('a violation reached through a cycle before the match', () => {
            const inner = pgError({
                code: '23505',
                constraint: SLUG_CONSTRAINT
            });
            const outer = Object.assign(new Error('Failed query'), {
                cause: inner
            });
            // A self-referencing wrapper still has to be looked *through*, not
            // just survived: bailing out on the first repeat would miss the
            // real violation sitting past it.
            Object.assign(inner as object, { cause: outer });

            expect(isUniqueViolation(outer, SLUG_CONSTRAINT)).toBe(true);
        });
    });

    describe('does not match', () => {
        it('another constraint violated with the same code', () => {
            // `memberships` has its own unique index. Mapping its violation to
            // `SlugTakenError` would report a slug collision for a duplicate
            // member — a 409 naming the wrong thing entirely.
            expect(
                isUniqueViolation(
                    pgError({
                        code: '23505',
                        constraint: 'memberships_workspace_id_user_id_unique'
                    }),
                    SLUG_CONSTRAINT
                )
            ).toBe(false);
        });

        it.each([
            ['a foreign-key violation', '23503'],
            ['a not-null violation', '23502'],
            ['a check violation', '23514']
        ])('%s on the same constraint name', (_label, code) => {
            expect(
                isUniqueViolation(
                    pgError({ code, constraint: SLUG_CONSTRAINT }),
                    SLUG_CONSTRAINT
                )
            ).toBe(false);
        });

        it('a code with no constraint, or a constraint with no code', () => {
            expect(
                isUniqueViolation(pgError({ code: '23505' }), SLUG_CONSTRAINT)
            ).toBe(false);
            expect(
                isUniqueViolation(
                    pgError({ constraint: SLUG_CONSTRAINT }),
                    SLUG_CONSTRAINT
                )
            ).toBe(false);
        });

        it.each([
            ['undefined', undefined],
            ['null', null],
            ['a string', 'duplicate key'],
            ['a number', 23505],
            ['a plain error', new Error('boom')]
        ])('%s', (_label, thrown) => {
            expect(isUniqueViolation(thrown, SLUG_CONSTRAINT)).toBe(false);
        });
    });

    describe('terminates', () => {
        it('on an error whose cause is itself', () => {
            const looping = Object.assign(new Error('Failed query'), {
                cause: undefined as unknown
            });
            looping.cause = looping;

            expect(isUniqueViolation(looping, SLUG_CONSTRAINT)).toBe(false);
        });

        it('on two errors that reference each other', () => {
            const first = Object.assign(new Error('a'), {
                cause: undefined as unknown
            });
            const second = Object.assign(new Error('b'), { cause: first });
            first.cause = second;

            expect(isUniqueViolation(first, SLUG_CONSTRAINT)).toBe(false);
        });
    });
});
