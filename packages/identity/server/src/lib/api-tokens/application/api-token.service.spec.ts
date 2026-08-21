import type { DomainEvent, OutboxWriter, UnitOfWork } from '@orthacms/database';
import { HashingService } from '../../auth/services/hashing.service';
import { ApiTokenService } from './api-token.service';
import { UnknownWorkspaceError } from '../domain/unknown-workspace.error';
import type {
    ApiTokenRecord,
    DrizzleApiTokenRepository,
    NewApiToken
} from '../infrastructure/persistence/drizzle-api-token.repository';

/** Builds a stored record from an insert plus overridable envelope fields. */
function recordFrom(
    insert: NewApiToken,
    over: Partial<ApiTokenRecord> = {}
): ApiTokenRecord {
    return {
        id: 'token-1',
        workspaceIds: [...insert.workspaceIds],
        name: insert.name,
        tokenHash: insert.tokenHash,
        lookupPrefix: insert.lookupPrefix,
        scope: insert.scope,
        expiresAt: insert.expiresAt,
        createdBy: insert.createdBy,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        ...over
    };
}

describe('ApiTokenService', () => {
    const hashing = new HashingService();

    /** A `UnitOfWork` that just runs the callback — one logical transaction. */
    const uow = { run: (fn: () => Promise<unknown>) => fn() } as UnitOfWork;

    /** An outbox that collects appended events for assertion. */
    function makeOutbox() {
        const events: DomainEvent[] = [];
        return {
            events,
            outbox: {
                append: async (batch: DomainEvent[]) => {
                    events.push(...batch);
                }
            } as OutboxWriter
        };
    }

    /**
     * Builds the service over stubbed collaborators, exposing the outbox.
     * `known` seeds the workspace directory; omit it to leave the optional port
     * unbound, which is how the service behaves with no workspaces plugin.
     */
    function makeService(
        repo: DrizzleApiTokenRepository,
        known?: readonly string[]
    ) {
        const { events, outbox } = makeOutbox();
        const directory = known
            ? {
                  existing: async (ids: readonly string[]) =>
                      ids.filter((id) => known.includes(id))
              }
            : undefined;
        return {
            service: new ApiTokenService(repo, hashing, uow, outbox, directory),
            events
        };
    }

    /** A repo stub that records the last insert and serves a fixed record. */
    function makeRepo(row: ApiTokenRecord | null) {
        const touchLastUsed = jest.fn().mockResolvedValue(undefined);
        return {
            repo: {
                insert: jest.fn(async (v: NewApiToken) => recordFrom(v)),
                findByHash: jest.fn(async () => row),
                findById: jest.fn(),
                list: jest.fn(),
                revoke: jest.fn(),
                touchLastUsed
            } as unknown as DrizzleApiTokenRepository,
            touchLastUsed
        };
    }

    describe('mint', () => {
        it('returns a prefixed secret and stores only its hash', async () => {
            const { repo } = makeRepo(null);
            const { service } = makeService(repo);

            const { token, secret } = await service.mint({
                name: 'CI',
                workspaceIds: ['ws-1'],
                scope: 'read',
                createdBy: 'user-1'
            });

            expect(secret.startsWith('orthacms_')).toBe(true);
            const insert = (repo.insert as jest.Mock).mock.calls[0][0];
            // The raw secret is never persisted — only its SHA-256 hash.
            expect(insert.tokenHash).toBe(hashing.hashToken(secret));
            expect(insert.tokenHash).not.toContain(secret);
            expect(secret.startsWith(insert.lookupPrefix)).toBe(true);
            // The returned view carries no secret field of its own.
            expect(token).not.toHaveProperty('secret');
            expect(token.scope).toBe('read');
        });

        it('persists the whole workspace bucket', async () => {
            const { repo } = makeRepo(null);
            const { service } = makeService(repo);

            const { token } = await service.mint({
                name: 'multi',
                workspaceIds: ['ws-1', 'ws-2', 'ws-3'],
                scope: 'read',
                createdBy: 'user-1'
            });

            const insert = (repo.insert as jest.Mock).mock.calls[0][0];
            expect(insert.workspaceIds).toEqual(['ws-1', 'ws-2', 'ws-3']);
            expect(token.workspaceIds).toEqual(['ws-1', 'ws-2', 'ws-3']);
        });

        it('collapses duplicate workspace ids', async () => {
            const { repo } = makeRepo(null);
            const { service } = makeService(repo);

            await service.mint({
                name: 'dupes',
                workspaceIds: ['ws-1', 'ws-2', 'ws-1'],
                scope: 'read',
                createdBy: 'user-1'
            });

            const insert = (repo.insert as jest.Mock).mock.calls[0][0];
            expect(insert.workspaceIds).toEqual(['ws-1', 'ws-2']);
        });

        it('defaults a missing expiry to null (never expires)', async () => {
            const { repo } = makeRepo(null);
            const { service } = makeService(repo);
            await service.mint({
                name: 'forever',
                workspaceIds: ['ws-1'],
                scope: 'full',
                createdBy: 'user-1'
            });
            const insert = (repo.insert as jest.Mock).mock.calls[0][0];
            expect(insert.expiresAt).toBeNull();
        });

        it('emits api_token.created naming the actor and the bucket', async () => {
            // BUG-identity-server-01: minting wrote no audit event at all, so
            // the log could not account for a long-lived credential.
            const { repo } = makeRepo(null);
            const { service, events } = makeService(repo);

            const { secret } = await service.mint({
                name: 'CI',
                workspaceIds: ['ws-1', 'ws-2'],
                scope: 'read',
                createdBy: 'user-1',
                actor: { id: 'user-1', email: 'admin@example.com' }
            });

            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                kind: 'api_token.created',
                aggregateType: 'api_token',
                aggregateId: 'token-1',
                payload: {
                    name: 'CI',
                    scope: 'read',
                    workspaceIds: ['ws-1', 'ws-2'],
                    actor: { id: 'user-1', email: 'admin@example.com' }
                }
            });
            // The event must not become a second place the secret lives.
            const serialised = JSON.stringify(events[0]);
            expect(serialised).not.toContain(secret);
            expect(serialised).not.toContain(hashing.hashToken(secret));
        });

        it('falls back to createdBy when no actor is supplied', async () => {
            const { repo } = makeRepo(null);
            const { service, events } = makeService(repo);

            await service.mint({
                name: 'CI',
                workspaceIds: ['ws-1'],
                scope: 'read',
                createdBy: 'user-1'
            });

            expect(events[0].payload).toMatchObject({
                actor: { id: 'user-1', email: null }
            });
        });

        describe('workspace bucket validation', () => {
            const mintInput = (workspaceIds: string[]) => ({
                name: 'CI',
                workspaceIds,
                scope: 'read' as const,
                createdBy: 'user-1'
            });

            it('rejects a bucket naming a workspace that does not exist', async () => {
                // BUG-identity-server-06: `api_token_workspaces` has no
                // cross-plugin FK, so nothing stopped a typo from minting a
                // token scoped to nothing that reads as configured.
                const { repo } = makeRepo(null);
                const { service, events } = makeService(repo, ['ws-1']);

                await expect(
                    service.mint(mintInput(['ws-nope']))
                ).rejects.toBeInstanceOf(UnknownWorkspaceError);
                expect(repo.insert).not.toHaveBeenCalled();
                expect(events).toEqual([]);
            });

            it('rejects a bucket mixing real and phantom ids, naming only the phantoms', async () => {
                const { repo } = makeRepo(null);
                const { service } = makeService(repo, ['ws-1']);

                await expect(
                    service.mint(mintInput(['ws-1', 'ws-nope', 'ws-also-nope']))
                ).rejects.toMatchObject({
                    workspaceIds: ['ws-nope', 'ws-also-nope']
                });
                expect(repo.insert).not.toHaveBeenCalled();
            });

            it('accepts a bucket whose ids all exist', async () => {
                const { repo } = makeRepo(null);
                const { service } = makeService(repo, ['ws-1', 'ws-2']);

                await expect(
                    service.mint(mintInput(['ws-1', 'ws-2']))
                ).resolves.toBeDefined();
            });

            it('checks the deduped bucket, so a repeated bad id reports once', async () => {
                const { repo } = makeRepo(null);
                const { service } = makeService(repo, ['ws-1']);

                await expect(
                    service.mint(mintInput(['ws-nope', 'ws-nope']))
                ).rejects.toMatchObject({ workspaceIds: ['ws-nope'] });
            });

            it('skips the check entirely when no directory is bound', async () => {
                // With no workspaces plugin there is nothing to validate
                // against; failing every mint would be worse than the gap.
                const { repo } = makeRepo(null);
                const { service } = makeService(repo);

                await expect(
                    service.mint(mintInput(['ws-anything']))
                ).resolves.toBeDefined();
            });
        });
    });

    describe('revoke', () => {
        const stored = recordFrom({
            workspaceIds: ['ws-1'],
            name: 'temp',
            tokenHash: 'x'.repeat(64),
            lookupPrefix: 'orthacms_tmp',
            scope: 'full',
            expiresAt: null,
            createdBy: 'user-1'
        });

        /** A repo whose `revoke` reports `revoked` and whose read serves `row`. */
        function revokeRepo(revoked: boolean, row: ApiTokenRecord | null) {
            return {
                insert: jest.fn(),
                findByHash: jest.fn(),
                findById: jest.fn(async () => row),
                list: jest.fn(),
                revoke: jest.fn(async () => revoked),
                touchLastUsed: jest.fn()
            } as unknown as DrizzleApiTokenRepository;
        }

        it('emits api_token.revoked when a live token was killed', async () => {
            const { service, events } = makeService(revokeRepo(true, stored));

            await expect(
                service.revoke('token-1', {
                    id: 'user-9',
                    email: 'admin@example.com'
                })
            ).resolves.toBe(true);

            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                kind: 'api_token.revoked',
                aggregateType: 'api_token',
                aggregateId: 'token-1',
                payload: {
                    name: 'temp',
                    scope: 'full',
                    lookupPrefix: 'orthacms_tmp',
                    actor: { id: 'user-9', email: 'admin@example.com' }
                }
            });
        });

        it('emits nothing when the token was already revoked', async () => {
            // The route is idempotent, so a replayed DELETE must not append a
            // second event — the log records the act, not the attempt.
            const { service, events } = makeService(revokeRepo(false, stored));

            await expect(service.revoke('token-1')).resolves.toBe(false);
            expect(events).toEqual([]);
        });

        it('emits nothing for an unknown id', async () => {
            const { service, events } = makeService(revokeRepo(false, null));

            await expect(service.revoke('nope')).resolves.toBe(false);
            expect(events).toEqual([]);
        });
    });

    describe('verify', () => {
        const secret = 'orthacms_secret';
        const baseInsert: NewApiToken = {
            workspaceIds: ['ws-1', 'ws-2'],
            name: 't',
            tokenHash: hashing.hashToken(secret),
            lookupPrefix: 'orthacms_sec',
            scope: 'read',
            expiresAt: null,
            createdBy: 'user-1'
        };

        it('resolves a live token with its whole bucket, and touches last-used when stale', async () => {
            const { repo, touchLastUsed } = makeRepo(recordFrom(baseInsert));
            const { service } = makeService(repo);

            const result = await service.verify(secret);

            expect(result?.workspaceIds).toEqual(['ws-1', 'ws-2']);
            expect(touchLastUsed).toHaveBeenCalledWith(
                'token-1',
                expect.any(Date)
            );
        });

        it('rejects a revoked token', async () => {
            const { repo } = makeRepo(
                recordFrom(baseInsert, { revokedAt: new Date('2026-02-01Z') })
            );
            const { service } = makeService(repo);
            expect(await service.verify(secret)).toBeNull();
        });

        it('rejects an expired token', async () => {
            const { repo } = makeRepo(
                recordFrom(baseInsert, { expiresAt: new Date('2020-01-01Z') })
            );
            const { service } = makeService(repo);
            expect(await service.verify(secret)).toBeNull();
        });

        it('rejects an unknown token', async () => {
            const { repo } = makeRepo(null);
            const { service } = makeService(repo);
            expect(await service.verify(secret)).toBeNull();
        });

        it('does not touch last-used when it is recent', async () => {
            const { repo, touchLastUsed } = makeRepo(
                recordFrom(baseInsert, { lastUsedAt: new Date() })
            );
            const { service } = makeService(repo);
            await service.verify(secret);
            expect(touchLastUsed).not.toHaveBeenCalled();
        });
    });
});
