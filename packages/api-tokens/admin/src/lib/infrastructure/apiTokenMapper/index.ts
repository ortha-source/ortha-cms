import type {
    ApiToken,
    ApiTokenCreator,
    ApiTokenScope,
    ApiTokenStatus,
    ApiTokenSummary,
    CreatedApiToken
} from '../../domain/types/apiToken';
import { expiresWithinWindow } from '../../domain/apiTokenExpiry';

/** A token as `GET/POST /api/api-tokens` returns it (timestamps are ISO). */
export type ApiTokenResponse = {
    id: string;
    name: string;
    workspaceIds: string[];
    scope: ApiTokenScope;
    lookupPrefix: string;
    expiresAt: string | null;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    /**
     * Who minted it. Optional on the wire type because a server predating the
     * field omits it; the mapper reads that as "unknown", never as a guess.
     */
    createdBy?: ApiTokenCreator | null;
};

/** The page-wide summary as `GET /api/api-tokens` returns it. */
export type ApiTokenSummaryResponse = {
    active: number;
    expired: number;
    revoked: number;
    expiringSoon: number;
    nextExpiresAt: string | null;
};

/** The create response adds the one-time plaintext `secret`. */
export type CreatedApiTokenResponse = ApiTokenResponse & { secret: string };

/** Derives the display status from expiry/revocation (revoked wins). */
function statusOf(dto: ApiTokenResponse): ApiTokenStatus {
    if (dto.revokedAt) {
        return 'revoked';
    }
    if (dto.expiresAt && new Date(dto.expiresAt).getTime() <= Date.now()) {
        return 'expired';
    }
    return 'active';
}

/** Maps a token from the wire to the admin's model (timestamps → `Date`). */
export function toApiToken(dto: ApiTokenResponse): ApiToken {
    const status = statusOf(dto);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    return {
        id: dto.id,
        name: dto.name,
        workspaceIds: dto.workspaceIds,
        scope: dto.scope,
        lookupPrefix: dto.lookupPrefix,
        expiresAt,
        lastUsedAt: dto.lastUsedAt ? new Date(dto.lastUsedAt) : null,
        revokedAt: dto.revokedAt ? new Date(dto.revokedAt) : null,
        createdAt: new Date(dto.createdAt),
        status,
        expiringSoon: status === 'active' && expiresWithinWindow(expiresAt),
        createdBy: dto.createdBy ?? null
    };
}

/**
 * Maps the summary. A server predating it sends none; that reads as all
 * zeros rather than failing the page, since the list itself is still good.
 */
export function toApiTokenSummary(
    dto: ApiTokenSummaryResponse | undefined
): ApiTokenSummary {
    return {
        active: dto?.active ?? 0,
        expired: dto?.expired ?? 0,
        revoked: dto?.revoked ?? 0,
        expiringSoon: dto?.expiringSoon ?? 0,
        nextExpiresAt: dto?.nextExpiresAt ? new Date(dto.nextExpiresAt) : null
    };
}

/** Maps the create response, carrying the plaintext secret onto the model. */
export function toCreatedApiToken(
    dto: CreatedApiTokenResponse
): CreatedApiToken {
    return { ...toApiToken(dto), secret: dto.secret };
}
