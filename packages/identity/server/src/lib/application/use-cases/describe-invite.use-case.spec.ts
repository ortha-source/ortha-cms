import type { HashingService } from '../../auth/services/hashing.service';
import { InvalidInviteTokenError } from '../../domain/errors';
import type {
    InviteRepository,
    PendingInvite
} from '../../domain/invite.repository';
import { DescribeInviteUseCase } from './describe-invite.use-case';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN_ID = '22222222-2222-4222-8222-222222222222';
const RAW_TOKEN = 'e'.repeat(64);

/**
 * `DescribeInviteUseCase` — the pure read behind the accept-invite screen. Two
 * things are worth pinning: the lookup goes by digest, never by the raw token
 * (И-09), and the description that comes back is *only* what the screen shows —
 * email and name. Leaking the account id or its status would turn a public,
 * unauthenticated endpoint into a probe.
 *
 * Driven over test doubles for the ports; the unit is a lookup and a
 * projection, both DB-free decisions.
 */
describe('DescribeInviteUseCase', () => {
    interface Harness {
        useCase: DescribeInviteUseCase;
        /** Every token hash handed to the invite lookup, in order. */
        lookups: string[];
        /** Whether the token was ever consumed — it must not be. */
        consumed: boolean[];
    }

    function pendingInvite(): PendingInvite {
        return {
            tokenId: TOKEN_ID,
            userId: USER_ID,
            email: 'ada@example.com',
            name: 'Ada Lovelace'
        };
    }

    function harness(invite: PendingInvite | null): Harness {
        const lookups: string[] = [];
        const consumed: boolean[] = [];

        const hashing = {
            // A stand-in digest that is visibly not the raw token, so a test
            // can tell which of the two reached the repository.
            hashToken: (raw: string) => `sha256:${raw}`
        } as unknown as HashingService;

        const invites = {
            findPendingByTokenHash: async (tokenHash: string) => {
                lookups.push(tokenHash);
                return invite;
            },
            consume: async () => {
                consumed.push(true);
                return true;
            }
        } as unknown as InviteRepository;

        return {
            useCase: new DescribeInviteUseCase(hashing, invites),
            lookups,
            consumed
        };
    }

    it('resolves the invite by digest and shows only what the screen renders', async () => {
        const { useCase, lookups, consumed } = harness(pendingInvite());

        const description = await useCase.execute(RAW_TOKEN);

        expect(lookups).toEqual([`sha256:${RAW_TOKEN}`]);
        expect(lookups).not.toContain(RAW_TOKEN);
        expect(description).toEqual({
            email: 'ada@example.com',
            name: 'Ada Lovelace'
        });
        // No id, no status — nothing the invitee has no business seeing.
        expect(Object.keys(description).sort()).toEqual(['email', 'name']);
        // A pure read: opening the link twice, or refreshing, is harmless.
        expect(consumed).toEqual([]);
    });

    it('carries a missing display name through as null rather than inventing one', async () => {
        const { useCase } = harness({ ...pendingInvite(), name: null });

        await expect(useCase.execute(RAW_TOKEN)).resolves.toEqual({
            email: 'ada@example.com',
            name: null
        });
    });

    it('raises the one generic error for a token that resolves to nothing', async () => {
        // И-04: unknown, expired, already accepted, and revoked arrive here as
        // the same `null`, and leave as the same 404.
        const { useCase } = harness(null);

        await expect(useCase.execute(RAW_TOKEN)).rejects.toBeInstanceOf(
            InvalidInviteTokenError
        );
    });
});
