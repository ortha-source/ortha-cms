import type {
    ApiTokenList,
    ApiTokenScope,
    CreatedApiToken
} from '../../domain/types/apiToken';
import type { WorkspaceOption } from '../../domain/types/workspaceOption';
import type { ApiTokensListParams } from '../apiTokensKeys';

/** The shape the create-token dialog submits. */
export type CreateApiTokenInput = {
    /** Human label. */
    name: string;
    /** The workspace the token may read. */
    workspaceId: string;
    /** Read-only or full content access. */
    scope: ApiTokenScope;
    /** Absolute expiry as an ISO-8601 string; omit for a token that never expires. */
    expiresAt?: string;
};

/**
 * The port over the remote API-tokens management API — the single seam the
 * plugin talks to instead of `apiClient` directly. Every method returns the
 * admin's mapped models and normalizes failures to `ApiError`.
 * {@link httpApiTokenGateway} is the HTTP implementation.
 */
export type ApiTokenGateway = {
    /** Lists one page of tokens via `GET /api/api-tokens`. */
    list(params: ApiTokensListParams): Promise<ApiTokenList>;
    /**
     * Mints a token via `POST /api/api-tokens`. The result carries the one-time
     * plaintext `secret` — it is never returned again.
     */
    create(input: CreateApiTokenInput): Promise<CreatedApiToken>;
    /** Revokes a token via `DELETE /api/api-tokens/:id`. */
    revoke(id: string): Promise<void>;
    /** Lists every workspace (via `GET /api/workspaces`) for the selector. */
    listWorkspaceOptions(): Promise<WorkspaceOption[]>;
};
