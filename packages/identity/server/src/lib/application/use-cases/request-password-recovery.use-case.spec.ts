import type { RateLimiter } from '../../infrastructure/throttling/rate-limiter';
import { PasswordRecoveryRegistry } from '../password-recovery.registry';
import type { PasswordRecoveryIssuer } from '../ports/password-recovery.port';
import {
    RECOVERY_ADDRESS_LIMIT,
    RequestPasswordRecoveryUseCase
} from './request-password-recovery.use-case';

/**
 * `RequestPasswordRecoveryUseCase` — the public half of self-service recovery
 * (ADR-0018 phase 2). What it owns, and so what is pinned here: the route is
 * absent without a mailer, the address is rate-limited by a digest rather than
 * in the clear, and the work runs off the request so nothing about the response
 * depends on whether an account uses the address.
 */
describe('RequestPasswordRecoveryUseCase', () => {
    function harness(
        options: { issuer?: PasswordRecoveryIssuer; allowed?: boolean } = {}
    ) {
        const issued: string[] = [];
        const keys: string[] = [];
        const registry = new PasswordRecoveryRegistry();
        const issuer: PasswordRecoveryIssuer = options.issuer ?? {
            available: true,
            issue: async (email) => {
                issued.push(email);
            }
        };
        registry.register(issuer);
        const limiter = {
            consume: async (key: string) => {
                keys.push(key);
                return {
                    allowed: options.allowed ?? true,
                    retryAfterMs: 0
                };
            }
        } as unknown as RateLimiter;
        return {
            useCase: new RequestPasswordRecoveryUseCase(registry, limiter),
            issued,
            keys
        };
    }

    it('is unavailable with no issuer registered', () => {
        const useCase = new RequestPasswordRecoveryUseCase(
            new PasswordRecoveryRegistry(),
            {} as RateLimiter
        );
        expect(useCase.isAvailable).toBe(false);
    });

    it('is unavailable when the issuer has no mailer behind it', () => {
        const { useCase } = harness({
            issuer: { available: false, issue: async () => undefined }
        });
        expect(useCase.isAvailable).toBe(false);
    });

    it('hands a normalised address to the issuer', async () => {
        const { useCase, issued } = harness();

        await useCase.execute('  Ada@Example.COM ');

        expect(issued).toEqual(['ada@example.com']);
    });

    it('keys the address limit on a digest, never the address itself', async () => {
        const { useCase, keys } = harness();

        await useCase.execute('ada@example.com');

        expect(keys).toHaveLength(1);
        expect(keys[0]).toMatch(/^identity:recovery:address:[0-9a-f]{64}$/);
        expect(keys[0]).not.toContain('ada');
        expect(RECOVERY_ADDRESS_LIMIT.limit).toBeGreaterThan(0);
    });

    it('drops a request over the address limit silently', async () => {
        const { useCase, issued } = harness({ allowed: false });

        await expect(
            useCase.execute('ada@example.com')
        ).resolves.toBeUndefined();
        expect(issued).toEqual([]);
    });

    it('returns from submit before the work has run', async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const issued: string[] = [];
        const { useCase } = harness({
            issuer: {
                available: true,
                issue: async (email) => {
                    await gate;
                    issued.push(email);
                }
            }
        });

        useCase.submit('ada@example.com');
        // The caller has its answer; the account has not been touched yet.
        expect(issued).toEqual([]);

        release();
        await useCase.drain();
        expect(issued).toEqual(['ada@example.com']);
    });

    it('swallows a failing issue, so the response is never the one that differs', async () => {
        const { useCase } = harness({
            issuer: {
                available: true,
                issue: async () => {
                    throw new Error('database down');
                }
            }
        });
        const error = jest
            .spyOn(
                (useCase as unknown as { logger: { error: () => void } })
                    .logger,
                'error'
            )
            .mockImplementation(() => undefined);

        expect(() => useCase.submit('ada@example.com')).not.toThrow();
        await useCase.drain();
        expect(error).toHaveBeenCalled();
    });
});
