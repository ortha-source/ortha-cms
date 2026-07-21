import { HashingService } from '../../auth/services/hashing.service';
import { ApiTokenService } from './api-token.service';
import type {
    ApiTokenRow,
    DrizzleApiTokenRepository,
    NewApiToken
} from '../infrastructure/persistence/drizzle-api-token.repository';

/** Builds a stored row from an insert plus overridable envelope fields. */
function rowFrom(insert: NewApiToken, over: Partial<ApiTokenRow> = {}): ApiTokenRow {
    return {
        id: 'token-1',
        workspaceId: insert.workspaceId,
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

    /** A repo stub that records the last insert and serves a fixed row. */
    function makeRepo(row: ApiTokenRow | null) {
        const touchLastUsed = jest.fn().mockResolvedValue(undefined);
        return {
            repo: {
                insert: jest.fn(async (v: NewApiToken) => rowFrom(v)),
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
            const service = new ApiTokenService(repo, hashing);

            const { token, secret } = await service.mint({
                name: 'CI',
                workspaceId: 'ws-1',
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

        it('defaults a missing expiry to null (never expires)', async () => {
            const { repo } = makeRepo(null);
            const service = new ApiTokenService(repo, hashing);
            await service.mint({
                name: 'forever',
                workspaceId: 'ws-1',
                scope: 'full',
                createdBy: 'user-1'
            });
            const insert = (repo.insert as jest.Mock).mock.calls[0][0];
            expect(insert.expiresAt).toBeNull();
        });
    });

    describe('verify', () => {
        const secret = 'orthacms_secret';
        const baseInsert: NewApiToken = {
            workspaceId: 'ws-1',
            name: 't',
            tokenHash: hashing.hashToken(secret),
            lookupPrefix: 'orthacms_sec',
            scope: 'read',
            expiresAt: null,
            createdBy: 'user-1'
        };

        it('resolves a live token and touches last-used when stale', async () => {
            const { repo, touchLastUsed } = makeRepo(rowFrom(baseInsert));
            const service = new ApiTokenService(repo, hashing);

            const result = await service.verify(secret);

            expect(result?.workspaceId).toBe('ws-1');
            expect(touchLastUsed).toHaveBeenCalledWith('token-1', expect.any(Date));
        });

        it('rejects a revoked token', async () => {
            const { repo } = makeRepo(
                rowFrom(baseInsert, { revokedAt: new Date('2026-02-01Z') })
            );
            const service = new ApiTokenService(repo, hashing);
            expect(await service.verify(secret)).toBeNull();
        });

        it('rejects an expired token', async () => {
            const { repo } = makeRepo(
                rowFrom(baseInsert, { expiresAt: new Date('2020-01-01Z') })
            );
            const service = new ApiTokenService(repo, hashing);
            expect(await service.verify(secret)).toBeNull();
        });

        it('rejects an unknown token', async () => {
            const { repo } = makeRepo(null);
            const service = new ApiTokenService(repo, hashing);
            expect(await service.verify(secret)).toBeNull();
        });

        it('does not touch last-used when it is recent', async () => {
            const { repo, touchLastUsed } = makeRepo(
                rowFrom(baseInsert, { lastUsedAt: new Date() })
            );
            const service = new ApiTokenService(repo, hashing);
            await service.verify(secret);
            expect(touchLastUsed).not.toHaveBeenCalled();
        });
    });
});
