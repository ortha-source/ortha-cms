import type { HashingService } from '../../auth/services/hashing.service';
import { InvalidResetTokenError } from '../../domain/errors';
import type {
    PasswordResetRepository,
    PendingPasswordReset
} from '../../domain/password-reset.repository';
import { DescribePasswordResetUseCase } from './describe-password-reset.use-case';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN_ID = '33333333-3333-4333-8333-333333333333';
const RAW_TOKEN = 'd'.repeat(64);

/**
 * `DescribePasswordResetUseCase` — the invite screen's sibling, for the reset
 * link. The same two things hold: the lookup goes by digest rather than the raw
 * token (И-09), and the projection is exactly the address and name the screen
 * names back, so someone handed a link out-of-band can check it is for the
 * right account without the endpoint becoming a probe for live links (И-04).
 */
describe('DescribePasswordResetUseCase', () => {
    interface Harness {
        useCase: DescribePasswordResetUseCase;
        /** Every token hash handed to the reset lookup, in order. */
        lookups: string[];
        /** Whether the token was ever consumed — it must not be. */
        consumed: boolean[];
    }

    function pendingReset(): PendingPasswordReset {
        return {
            tokenId: TOKEN_ID,
            userId: USER_ID,
            email: 'ada@example.com',
            name: 'Ada Lovelace'
        };
    }

    function harness(reset: PendingPasswordReset | null): Harness {
        const lookups: string[] = [];
        const consumed: boolean[] = [];

        const hashing = {
            hashToken: (raw: string) => `sha256:${raw}`
        } as unknown as HashingService;

        const resets = {
            findPendingByTokenHash: async (tokenHash: string) => {
                lookups.push(tokenHash);
                return reset;
            },
            consume: async () => {
                consumed.push(true);
                return true;
            }
        } as unknown as PasswordResetRepository;

        return {
            useCase: new DescribePasswordResetUseCase(hashing, resets),
            lookups,
            consumed
        };
    }

    it('resolves the reset by digest and shows only what the screen renders', async () => {
        const { useCase, lookups, consumed } = harness(pendingReset());

        const description = await useCase.execute(RAW_TOKEN);

        expect(lookups).toEqual([`sha256:${RAW_TOKEN}`]);
        expect(lookups).not.toContain(RAW_TOKEN);
        expect(description).toEqual({
            email: 'ada@example.com',
            name: 'Ada Lovelace'
        });
        expect(Object.keys(description).sort()).toEqual(['email', 'name']);
        // A pure read: the link still works after the screen has rendered it.
        expect(consumed).toEqual([]);
    });

    it('carries a missing display name through as null rather than inventing one', async () => {
        const { useCase } = harness({ ...pendingReset(), name: null });

        await expect(useCase.execute(RAW_TOKEN)).resolves.toEqual({
            email: 'ada@example.com',
            name: null
        });
    });

    it('raises the one generic error for a token that resolves to nothing', async () => {
        const { useCase } = harness(null);

        await expect(useCase.execute(RAW_TOKEN)).rejects.toBeInstanceOf(
            InvalidResetTokenError
        );
    });
});
