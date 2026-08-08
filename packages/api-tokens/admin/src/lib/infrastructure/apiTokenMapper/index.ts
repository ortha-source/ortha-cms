import type {
    ApiToken,
    ApiTokenScope,
    ApiTokenStatus,
    CreatedApiToken
} from '../../domain/types/apiToken';

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
    return {
        id: dto.id,
        name: dto.name,
        workspaceIds: dto.workspaceIds,
        scope: dto.scope,
        lookupPrefix: dto.lookupPrefix,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        lastUsedAt: dto.lastUsedAt ? new Date(dto.lastUsedAt) : null,
        revokedAt: dto.revokedAt ? new Date(dto.revokedAt) : null,
        createdAt: new Date(dto.createdAt),
        status: statusOf(dto)
    };
}

/** Maps the create response, carrying the plaintext secret onto the model. */
export function toCreatedApiToken(
    dto: CreatedApiTokenResponse
): CreatedApiToken {
    return { ...toApiToken(dto), secret: dto.secret };
}
