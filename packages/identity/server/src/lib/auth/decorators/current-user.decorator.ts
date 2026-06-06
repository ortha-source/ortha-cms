import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicUser } from '../services/auth.service';

/**
 * An Express request after {@link AuthGuard} has run on a guarded route: the
 * authenticated {@link PublicUser} is attached as `user`. On a `@Public()`
 * route the guard sets nothing, so `user` is `undefined`.
 */
export interface AuthenticatedRequest extends Request {
    user?: PublicUser;
}

/**
 * Parameter decorator returning the {@link PublicUser} that {@link AuthGuard}
 * attached to the request. On a guarded route the user is always present (the
 * guard 401s otherwise); on a `@Public()` route it is `undefined`.
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): PublicUser | undefined => {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
        return request.user;
    }
);
