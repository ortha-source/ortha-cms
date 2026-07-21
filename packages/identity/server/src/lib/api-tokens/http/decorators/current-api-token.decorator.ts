import {
    createParamDecorator,
    InternalServerErrorException,
    type ExecutionContext
} from '@nestjs/common';
import type { Request } from 'express';
import type { ApiTokenScope } from '../../domain/api-token-scope';

/**
 * The authenticated bearer-token principal {@link ApiTokenGuard} attaches to a
 * request. Carries only what downstream handlers need — the token's id, its
 * bound workspace, and its scope — never the secret.
 */
export interface ApiTokenPrincipal {
    id: string;
    workspaceId: string;
    scope: ApiTokenScope;
}

/**
 * An Express request after {@link ApiTokenGuard} has authenticated it: the
 * token principal is attached as `apiToken`, and its workspace is mirrored onto
 * `workspaceId` so the shared `@CurrentWorkspace()` decorator resolves it
 * without the membership-based `WorkspaceGuard`.
 */
export interface ApiTokenRequest extends Request {
    apiToken?: ApiTokenPrincipal;
    workspaceId?: string;
}

/**
 * Parameter decorator returning the {@link ApiTokenPrincipal} that
 * {@link ApiTokenGuard} attached. Use only on routes guarded by that guard —
 * without it the request carries no token, so this throws rather than hand a
 * handler an `undefined` principal.
 */
export const CurrentApiToken = createParamDecorator(
    (_data: unknown, context: ExecutionContext): ApiTokenPrincipal => {
        const request = context.switchToHttp().getRequest<ApiTokenRequest>();
        if (!request.apiToken) {
            throw new InternalServerErrorException(
                '@CurrentApiToken() used on a route without ApiTokenGuard.'
            );
        }
        return request.apiToken;
    }
);
