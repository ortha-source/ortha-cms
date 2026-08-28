import { InvalidUserStatusError } from '../../domain/errors';
import { UserAccountMapper, type UserAccountRow } from './user-account.mapper';

/**
 * `UserAccountMapper.toDomain` — the one seam between a `users` row and the
 * aggregate.
 *
 * Two things must hold every time a row is loaded:
 *
 * - **Reconstruction is not a mutation.** An account read from the database has
 *   not *done* anything, so it must arrive with no pending events and no
 *   persistence deltas. If rehydration raised events, every read would enqueue
 *   an outbox entry claiming a user was just activated, and every save would
 *   write columns nobody changed. A `pending` row — the un-accepted invite,
 *   with `password_hash` still `null` — is the shape most likely to tempt a
 *   mapper into "fixing" something, so it is the one pinned here.
 * - **An unrecognised `status` fails loudly.** The column is a Postgres enum,
 *   so a value outside it means a migration drifted or someone wrote by hand.
 *   Defaulting it to `pending` or `active` would turn that into a silent
 *   authorization decision; the error must come through the mapper untouched.
 */
describe('UserAccountMapper', () => {
    const USER_ID = '11111111-1111-4111-8111-111111111111';
    const HASH = `$2b$12$${'a'.repeat(53)}`;

    function mapper(): UserAccountMapper {
        return new UserAccountMapper();
    }

    function row(overrides: Partial<UserAccountRow> = {}): UserAccountRow {
        return {
            id: USER_ID,
            email: 'ada@example.com',
            status: 'active',
            passwordHash: HASH,
            ...overrides
        };
    }

    describe('reconstructing a row', () => {
        it('carries the row through to the aggregate', () => {
            const account = mapper().toDomain(row());

            expect(account.id.value).toBe(USER_ID);
            expect(account.email.value).toBe('ada@example.com');
            expect(account.status.value).toBe('active');
            expect(account.passwordHash?.value).toBe(HASH);
        });

        it('maps a pending row with no credential to a pending account', () => {
            const account = mapper().toDomain(
                row({ status: 'pending', passwordHash: null })
            );

            expect(account.status.isPending).toBe(true);
            expect(account.passwordHash).toBeNull();
        });

        it('raises no events for a pending row with no credential', () => {
            const account = mapper().toDomain(
                row({ status: 'pending', passwordHash: null })
            );

            expect(account.pullEvents()).toEqual([]);
        });

        it('records no persistence deltas for a freshly loaded row', () => {
            const account = mapper().toDomain(
                row({ status: 'pending', passwordHash: null })
            );

            expect(account.changes()).toEqual({
                statusChanged: false,
                credentialChanged: false
            });
        });

        it.each([['pending'], ['active'], ['disabled']])(
            'accepts the %s lifecycle status',
            (status) => {
                expect(mapper().toDomain(row({ status })).status.value).toBe(
                    status
                );
            }
        );
    });

    describe('an unrecognised status', () => {
        it.each([
            ['a status outside the enum', 'archived'],
            ['a case-shifted status', 'Active'],
            ['an empty status', '']
        ])(
            'surfaces %s as an error instead of swallowing it',
            (_label, status) => {
                expect(() => mapper().toDomain(row({ status }))).toThrow(
                    InvalidUserStatusError
                );
            }
        );

        it('names the offending value in the error', () => {
            expect(() =>
                mapper().toDomain(row({ status: 'archived' }))
            ).toThrow(/archived/);
        });
    });
});
