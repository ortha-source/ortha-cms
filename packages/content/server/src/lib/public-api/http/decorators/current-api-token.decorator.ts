import {
    createParamDecorator,
    InternalServerErrorException,
    type ExecutionContext
} from '@nestjs/common';
import type { ApiTokenRequest, PublicApiToken } from '../api-token-request';

/**
 * Parameter decorator returning the {@link PublicApiToken} that
 * {@link ApiTokenGuard} verified and attached. Use it only on routes carrying
 * that guard — without it the request carries no token, so this throws rather
 * than handing a handler an `undefined` caller identity.
 */
export const CurrentApiToken = createParamDecorator(
    (_data: unknown, context: ExecutionContext): PublicApiToken => {
        const request = context.switchToHttp().getRequest<ApiTokenRequest>();
        if (!request.apiToken) {
            throw new InternalServerErrorException(
                '@CurrentApiToken() used on a route without ApiTokenGuard.'
            );
        }
        return request.apiToken;
    }
);
